#!/usr/bin/env python3
"""Publish only the generated public agenda using explicit, verified FTPS."""

import contextlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import ftplib
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import ssl
import sys
from uuid import uuid4
from zoneinfo import ZoneInfo


AGENDA_FILE = Path(__file__).resolve().parents[1] / "public/calendar-data/agendas.json"
DESTINATION_NAME = "agendas.json"
EXPECTED_SOURCE_COUNTS = {"ivy-station": 8, "hawthorne": 8}
EXPECTED_LOCATIONS = set(EXPECTED_SOURCE_COUNTS)
MAXIMUM_BYTES = 10_000_000
DAY_CARD_COUNT = 7


class ConfigurationError(ValueError):
    """A safe-to-display error about missing or invalid configuration."""


class AgendaError(ValueError):
    """A safe-to-display error about the generated public agenda."""


@dataclass(frozen=True)
class UploadConfiguration:
    host: str
    username: str = field(repr=False)
    password: str = field(repr=False)
    directory: str
    port: int = 21


def read_configuration(environment):
    values = {}
    for name in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD", "FTP_CALENDAR_DIRECTORY"):
        value = environment.get(name, "")
        if not value or not value.strip() or any(character in value for character in "\r\n\0"):
            raise ConfigurationError(f"Set a valid {name} before uploading.")
        values[name] = value

    host = values["FTP_HOST"]
    if any(character.isspace() or character in "/\\:@?#" for character in host):
        raise ConfigurationError("FTP_HOST must be a hostname, without a URL scheme or port.")

    directory = values["FTP_CALENDAR_DIRECTORY"]
    path = PurePosixPath(directory)
    # A dedicated account can be jailed directly into calendar-data. Only allow
    # its FTP root after that account scope has been explicitly verified.
    confirmed_calendar_root = (
        directory == "/" and environment.get("FTP_CALENDAR_ACCOUNT_ROOT") == "true"
    )
    if (
        not directory.startswith("/")
        or str(path) != directory
        or ".." in path.parts
        or "\\" in directory
        or (path.name != "calendar-data" and not confirmed_calendar_root)
    ):
        raise ConfigurationError(
            "FTP_CALENDAR_DIRECTORY must end in /calendar-data, or be / for a confirmed calendar-only account."
        )

    try:
        port = int(environment.get("FTP_PORT") or "21")
    except ValueError:
        raise ConfigurationError("FTP_PORT must be a numeric explicit FTPS port.") from None
    if not 1 <= port <= 65535 or port == 990:
        raise ConfigurationError("Use an explicit FTPS port, normally 21; implicit FTPS is unsupported.")

    return UploadConfiguration(host, values["FTP_USERNAME"], values["FTP_PASSWORD"], directory, port)


def read_agenda_payload(path=AGENDA_FILE, now=None):
    """Reject incomplete or old generation before opening an FTP connection."""
    with path.open("rb") as agenda_file:
        payload = agenda_file.read(MAXIMUM_BYTES + 1)
    return validate_agenda_payload(payload, now)


def validate_agenda_payload(payload, now=None):
    if not payload or len(payload) > MAXIMUM_BYTES:
        raise AgendaError("The generated agenda is empty or exceeds the upload size limit.")
    try:
        agendas = json.loads(payload)
    except (ValueError, UnicodeError):
        raise AgendaError("The generated agenda is not valid JSON.") from None
    if not isinstance(agendas, dict) or set(agendas) != EXPECTED_LOCATIONS:
        raise AgendaError("The generated agenda must contain both configured locations.")

    current_time = now or datetime.now(timezone.utc)
    local_date = current_time.astimezone(ZoneInfo("America/Los_Angeles")).date()
    required_dates = {
        (local_date + timedelta(days=day_offset)).isoformat()
        for day_offset in range(DAY_CARD_COUNT)
    }
    for location_id, agenda in agendas.items():
        if not isinstance(agenda, dict):
            raise AgendaError("The generated agenda has an invalid location record.")
        source_count = agenda.get("sourceCount")
        if (
            type(source_count) is not int
            or source_count != EXPECTED_SOURCE_COUNTS[location_id]
            or type(agenda.get("failedSourceCount")) is not int
            or agenda["failedSourceCount"] != 0
        ):
            raise AgendaError("Every public calendar feed must succeed before an upload.")
        if agenda.get("timeZone") != "America/Los_Angeles" or not isinstance(agenda.get("events"), list):
            raise AgendaError("The generated agenda has an invalid timezone or event list.")
        available_dates = agenda.get("availableDateKeys")
        if (
            not isinstance(available_dates, list)
            or not all(isinstance(date, str) for date in available_dates)
            or not required_dates.issubset(available_dates)
        ):
            raise AgendaError(
                "The generated agenda must cover today and the next six days in Pacific time."
            )
        try:
            generated_at = datetime.fromisoformat(agenda["generatedAt"].replace("Z", "+00:00"))
            if generated_at.utcoffset() is None:
                raise ValueError("Timestamp needs a timezone")
            age = current_time - generated_at
        except (KeyError, AttributeError, TypeError, ValueError):
            raise AgendaError("The generated agenda needs a valid generation timestamp.") from None
        if age < -timedelta(minutes=5) or age > timedelta(hours=2):
            raise AgendaError("Regenerate calendar data before uploading; its timestamp is not current.")
    return payload


def read_remote_agenda(configuration, ftp_factory=ftplib.FTP_TLS):
    """Verify an account and directory by reading, never writing, its agenda."""
    ftp = ftp_factory(context=ssl.create_default_context(), timeout=45)
    chunks = []
    size = 0

    def receive(chunk):
        nonlocal size
        size += len(chunk)
        if size > MAXIMUM_BYTES:
            raise AgendaError("The hosted agenda exceeds the size limit.")
        chunks.append(chunk)

    try:
        ftp.connect(configuration.host, configuration.port)
        ftp.auth()
        ftp.login(configuration.username, configuration.password)
        ftp.prot_p()
        ftp.cwd(configuration.directory)
        ftp.retrbinary(f"RETR {DESTINATION_NAME}", receive)
        with contextlib.suppress(*ftplib.all_errors):
            ftp.quit()
        return b"".join(chunks)
    finally:
        ftp.close()


def upload_agenda(configuration, payload, ftp_factory=ftplib.FTP_TLS):
    """Transfer to a temporary name, verify its size, then rename in one directory."""
    temporary_name = f".agendas-{uuid4().hex}.json"
    context = ssl.create_default_context()
    ftp = ftp_factory(context=context, timeout=45)
    transfer_started = False
    try:
        ftp.connect(configuration.host, configuration.port)
        ftp.auth()
        ftp.login(configuration.username, configuration.password)
        ftp.prot_p()
        ftp.cwd(configuration.directory)
        transfer_started = True
        ftp.storbinary(f"STOR {temporary_name}", BytesIO(payload))
        if ftp.size(temporary_name) != len(payload):
            raise AgendaError("The uploaded temporary agenda failed its size check.")
        # Never delete the existing published file to make a rename succeed.
        ftp.rename(temporary_name, DESTINATION_NAME)
        transfer_started = False
        with contextlib.suppress(*ftplib.all_errors):
            ftp.quit()
    except Exception:
        if transfer_started:
            with contextlib.suppress(*ftplib.all_errors):
                ftp.delete(temporary_name)
        raise
    finally:
        ftp.close()


def main():
    try:
        configuration = read_configuration(os.environ)
        payload = read_agenda_payload()
        upload_agenda(configuration, payload)
    except (ConfigurationError, AgendaError) as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        # Server responses can contain account details. Do not log them or emit
        # a traceback; the upload can be retried safely after host verification.
        print(
            "Calendar upload could not be confirmed. Check the generated file, FTPS certificate, "
            "credentials, exact directory, and rename permissions. No plain FTP fallback was attempted.",
            file=sys.stderr,
        )
        return 1
    print("Uploaded current calendar agendas.json over verified FTPS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
