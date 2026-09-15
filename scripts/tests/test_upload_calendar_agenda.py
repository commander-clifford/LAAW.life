"""Exercise data validation and upload failure handling without a network."""

from datetime import datetime, timedelta, timezone
import importlib.util
from io import StringIO
import json
from pathlib import Path
import ssl
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "upload-calendar-agenda.py"
SPEC = importlib.util.spec_from_file_location("upload_calendar_agenda", MODULE_PATH)
uploader = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = uploader
SPEC.loader.exec_module(uploader)

NOW = datetime(2026, 9, 16, 1, 0, tzinfo=timezone.utc)


def configuration_environment():
    return {
        "FTP_HOST": "ftp.example.com",
        "FTP_USERNAME": "calendar-user",
        "FTP_PASSWORD": "private-test-value",
        "FTP_CALENDAR_DIRECTORY": "/public_html/calendar-data",
    }


def agendas():
    return {
        location: {
            "generatedAt": NOW.isoformat(),
            "initialDateKey": "2026-09-15",
            "availableDateKeys": ["2026-09-15", "2026-09-16"],
            "timeZone": "America/Los_Angeles",
            "sourceCount": 8,
            "failedSourceCount": 0,
            "events": [],
        }
        for location in ("ivy-station", "hawthorne")
    }


class ConfigurationTests(unittest.TestCase):
    def test_requires_all_destination_and_credential_values(self):
        for key in configuration_environment():
            with self.subTest(key=key):
                environment = configuration_environment()
                del environment[key]
                with self.assertRaises(uploader.ConfigurationError):
                    uploader.read_configuration(environment)

    def test_destination_must_be_exact_calendar_directory(self):
        for directory in (
            "/", "/public_html", "calendar-data", "/public_html/../calendar-data",
            "/public_html//calendar-data", "/public_html/calendar-data/",
            "/public_html\\calendar-data", "/public_html/calendar-data\r\nDELE index.html",
        ):
            with self.subTest(directory=directory):
                environment = configuration_environment() | {"FTP_CALENDAR_DIRECTORY": directory}
                with self.assertRaises(uploader.ConfigurationError):
                    uploader.read_configuration(environment)

    def test_supports_account_relative_root_directory_without_rewriting(self):
        environment = configuration_environment() | {"FTP_CALENDAR_DIRECTORY": "/calendar-data"}
        self.assertEqual(uploader.read_configuration(environment).directory, "/calendar-data")

    def test_rejects_urls_and_unsupported_ports(self):
        for host in ("ftp://ftp.example.com", "https://example.com", "ftp.example.com:21"):
            with self.subTest(host=host), self.assertRaises(uploader.ConfigurationError):
                uploader.read_configuration(configuration_environment() | {"FTP_HOST": host})
        for port in ("990", "0", "65536", "not-a-number"):
            with self.subTest(port=port), self.assertRaises(uploader.ConfigurationError):
                uploader.read_configuration(configuration_environment() | {"FTP_PORT": port})

    def test_does_not_represent_credentials(self):
        configuration = uploader.read_configuration(configuration_environment())
        self.assertNotIn(configuration.username, repr(configuration))
        self.assertNotIn(configuration.password, repr(configuration))
        self.assertEqual(configuration.port, 21)


class PayloadTests(unittest.TestCase):
    def validate(self, data, now=NOW):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "agendas.json"
            payload = json.dumps(data).encode()
            path.write_bytes(payload)
            self.assertEqual(uploader.read_agenda_payload(path, now), payload)

    def test_accepts_complete_current_data_using_pacific_dates(self):
        self.validate(agendas())

    def test_refuses_missing_location_or_failed_feed(self):
        data = agendas()
        del data["hawthorne"]
        with self.assertRaises(uploader.AgendaError):
            self.validate(data)
        data = agendas()
        data["hawthorne"]["failedSourceCount"] = 1
        with self.assertRaises(uploader.AgendaError):
            self.validate(data)

    def test_refuses_stale_future_and_unzoned_timestamps(self):
        for timestamp in (
            (NOW - timedelta(hours=3)).isoformat(),
            (NOW + timedelta(minutes=6)).isoformat(),
            "2026-09-16T01:00:00", None,
        ):
            with self.subTest(timestamp=timestamp):
                data = agendas()
                data["ivy-station"]["generatedAt"] = timestamp
                with self.assertRaises(uploader.AgendaError):
                    self.validate(data)

    def test_refuses_missing_tomorrow(self):
        data = agendas()
        data["hawthorne"]["availableDateKeys"] = ["2026-09-15"]
        with self.assertRaises(uploader.AgendaError):
            self.validate(data)

    def test_refuses_non_json_and_oversized_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "agendas.json"
            path.write_bytes(b"<html>error</html>")
            with self.assertRaises(uploader.AgendaError):
                uploader.read_agenda_payload(path, NOW)
            path.write_bytes(b" " * 11)
            with patch.object(uploader, "MAXIMUM_BYTES", 10), self.assertRaises(uploader.AgendaError):
                uploader.read_agenda_payload(path, NOW)


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.configuration = uploader.read_configuration(configuration_environment())
        self.payload = b'{"sample":"agenda"}'
        self.ftp = Mock()
        self.ftp.size.return_value = len(self.payload)
        self.factory = Mock(return_value=self.ftp)

    def upload(self):
        uploader.upload_agenda(self.configuration, self.payload, self.factory)

    def test_encrypts_control_and_data_then_verifies_before_atomic_replacement(self):
        self.upload()
        context = self.factory.call_args.kwargs["context"]
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertEqual(
            [call[0] for call in self.ftp.method_calls],
            ["connect", "auth", "login", "prot_p", "cwd", "storbinary", "size", "rename", "quit", "close"],
        )
        self.ftp.cwd.assert_called_once_with("/public_html/calendar-data")
        command, stream = self.ftp.storbinary.call_args.args
        temporary_name = command.removeprefix("STOR ")
        self.assertRegex(temporary_name, r"^\.agendas-[a-f0-9]{32}\.json$")
        self.assertEqual(stream.getvalue(), self.payload)
        self.ftp.size.assert_called_once_with(temporary_name)
        self.ftp.rename.assert_called_once_with(temporary_name, "agendas.json")
        self.ftp.delete.assert_not_called()

    def test_partial_transfer_keeps_published_file_and_cleans_only_temporary_file(self):
        self.ftp.storbinary.side_effect = OSError("transfer interrupted")
        with self.assertRaises(OSError):
            self.upload()
        self.ftp.rename.assert_not_called()
        self.assertRegex(self.ftp.delete.call_args.args[0], r"^\.agendas-[a-f0-9]{32}\.json$")
        self.ftp.close.assert_called_once()

    def test_failed_size_check_never_replaces_published_file(self):
        self.ftp.size.return_value = len(self.payload) - 1
        with self.assertRaises(uploader.AgendaError):
            self.upload()
        self.ftp.rename.assert_not_called()
        self.ftp.delete.assert_called_once()

    def test_rename_failure_does_not_delete_published_file(self):
        self.ftp.rename.side_effect = uploader.ftplib.error_perm("rename denied")
        with self.assertRaises(uploader.ftplib.error_perm):
            self.upload()
        self.assertNotEqual(self.ftp.delete.call_args.args[0], "agendas.json")

    def test_tls_failure_sends_no_credentials_or_file(self):
        self.ftp.auth.side_effect = ssl.SSLCertVerificationError("invalid certificate")
        with self.assertRaises(ssl.SSLCertVerificationError):
            self.upload()
        self.ftp.login.assert_not_called()
        self.ftp.storbinary.assert_not_called()
        self.ftp.delete.assert_not_called()
        self.ftp.close.assert_called_once()

    def test_main_sanitizes_server_errors(self):
        stderr = StringIO()
        with (
            patch.dict(uploader.os.environ, configuration_environment(), clear=True),
            patch.object(uploader, "read_agenda_payload", return_value=self.payload),
            patch.object(uploader, "upload_agenda", side_effect=OSError("private-test-value")),
            patch("sys.stderr", stderr),
        ):
            self.assertEqual(uploader.main(), 1)
        self.assertNotIn("private-test-value", stderr.getvalue())
        self.assertIn("could not be confirmed", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
