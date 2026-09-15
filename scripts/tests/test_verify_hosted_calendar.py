"""Check that an upload cannot be called successful based on FTP alone."""

from email.message import Message
import importlib.util
from io import StringIO
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, Mock, patch
from urllib.error import HTTPError


SPEC = importlib.util.spec_from_file_location(
    "verify_hosted_calendar", Path(__file__).resolve().parents[1] / "verify-hosted-calendar.py"
)
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


class HostedCalendarTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.dumps({location: {"generatedAt": "2026-09-15T12:00:00.000Z"}
                                   for location in ("ivy-station", "hawthorne")}).encode()
        self.response = MagicMock()
        self.response.__enter__.return_value = self.response
        self.response.status = 200
        self.response.geturl.return_value = verifier.PUBLIC_URL
        self.response.headers = Message()
        self.response.headers["Content-Type"] = "application/json; charset=utf-8"
        self.response.read.return_value = self.payload
        self.opener = Mock(return_value=self.response)

    def test_accepts_exact_payload_for_both_locations_with_cache_bypass(self):
        result = verifier.verify_hosted_payload(self.payload, opener=self.opener)
        self.assertEqual(set(result), {"ivy-station", "hawthorne"})
        request = self.opener.call_args.args[0]
        self.assertIn("calendar-verification=", request.full_url)
        self.assertEqual(request.get_header("Cache-control"), "no-cache")

    def test_rejects_homepage_fallback_even_with_http_200(self):
        self.response.headers.replace_header("Content-Type", "text/html")
        self.response.read.return_value = b"<html>Old site</html>"
        with self.assertRaisesRegex(verifier.VerificationError, "not serving JSON"):
            verifier.verify_hosted_payload(self.payload, opener=self.opener)

    def test_rejects_older_partial_or_changed_payload(self):
        for actual in (b'{}', self.payload.replace(b"12:00", b"11:00"), self.payload[:-1]):
            self.response.read.return_value = actual
            with self.subTest(actual=actual), self.assertRaises(verifier.VerificationError):
                verifier.verify_hosted_payload(self.payload, opener=self.opener)

    def test_rejects_failed_or_insecure_response(self):
        self.response.status = 503
        with self.assertRaises(verifier.VerificationError):
            verifier.verify_hosted_payload(self.payload, opener=self.opener)
        self.response.status = 200
        self.response.geturl.return_value = "http://laaw.life/calendar-data/agendas.json"
        with self.assertRaises(verifier.VerificationError):
            verifier.verify_hosted_payload(self.payload, opener=self.opener)

    def test_reports_http_failure_without_response_details(self):
        self.opener.side_effect = HTTPError(verifier.PUBLIC_URL, 406, "private server detail", {}, None)
        with self.assertRaisesRegex(verifier.VerificationError, "HTTP 406 instead of JSON"):
            verifier.verify_hosted_payload(self.payload, opener=self.opener)

    def test_retry_recovers_when_public_cache_catches_up(self):
        with (
            patch.object(verifier.uploader, "read_agenda_payload", return_value=self.payload),
            patch.object(verifier, "verify_hosted_payload", side_effect=[
                verifier.VerificationError("Not current yet"), json.loads(self.payload),
            ]) as verify,
            patch.object(verifier.time, "sleep") as sleep,
            patch("sys.stdout", StringIO()),
        ):
            self.assertEqual(verifier.main(["--attempts", "2"]), 0)
            self.assertEqual(verify.call_count, 2)
            sleep.assert_called_once_with(5)

    def test_failure_is_reported_without_network_exception_details(self):
        stderr = StringIO()
        with (
            patch.object(verifier.uploader, "read_agenda_payload", return_value=self.payload),
            patch.object(verifier, "verify_hosted_payload", side_effect=OSError("private account detail")),
            patch("sys.stderr", stderr),
        ):
            self.assertEqual(verifier.main(["--attempts", "1"]), 1)
        self.assertNotIn("private account detail", stderr.getvalue())
        self.assertIn("could not be verified", stderr.getvalue())

    def test_preflight_reads_remote_payload_without_uploading(self):
        with (
            patch.object(verifier.uploader, "read_configuration") as configuration,
            patch.object(verifier.uploader, "read_remote_agenda", return_value=self.payload) as read,
            patch.object(verifier.uploader, "validate_agenda_payload", return_value=self.payload) as validate,
            patch.object(verifier.uploader, "upload_agenda") as upload,
            patch.object(verifier, "verify_hosted_payload", return_value=json.loads(self.payload)) as verify,
            patch("sys.stdout", StringIO()),
        ):
            self.assertEqual(verifier.main(["--from-ftp", "--attempts", "1"]), 0)
            read.assert_called_once_with(configuration.return_value)
            validate.assert_called_once_with(self.payload)
            verify.assert_called_once_with(self.payload, verifier.PUBLIC_URL)
            upload.assert_not_called()


if __name__ == "__main__":
    unittest.main()
