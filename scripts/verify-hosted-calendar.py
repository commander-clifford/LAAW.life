#!/usr/bin/env python3
"""Confirm that visitors receive the exact freshly generated calendar payload."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from uuid import uuid4


SPEC = importlib.util.spec_from_file_location(
    "calendar_uploader", Path(__file__).with_name("upload-calendar-agenda.py")
)
uploader = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = uploader
SPEC.loader.exec_module(uploader)

PUBLIC_URL = "https://laaw.life/calendar-data/agendas.json"


class VerificationError(ValueError):
    """A safe-to-display error about the public calendar response."""


def verify_hosted_payload(expected, url=PUBLIC_URL, opener=urlopen):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.username or parsed.password:
        raise VerificationError("The public calendar verification URL must use HTTPS without credentials.")
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.append(("calendar-verification", uuid4().hex))
    request = Request(
        urlunsplit(parsed._replace(query=urlencode(query))),
        headers={
            "Cache-Control": "no-cache",
            "Accept": "application/json",
            "User-Agent": "LAAW-calendar-verification/1.0",
        },
    )
    try:
        response = opener(request, timeout=20)
    except HTTPError as error:
        raise VerificationError(f"The public calendar URL returned HTTP {error.code} instead of JSON.") from None
    with response:
        if response.status != 200 or urlsplit(response.geturl()).scheme != "https":
            raise VerificationError("The public calendar URL did not return a successful HTTPS response.")
        if response.headers.get_content_type() != "application/json":
            raise VerificationError("The public calendar URL is not serving JSON; check the document root and routing.")
        actual = response.read(uploader.MAXIMUM_BYTES + 1)
    if actual != expected:
        raise VerificationError("The hosted calendar does not match the fresh upload; check the destination and cache.")
    return json.loads(actual)


def main(arguments=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=PUBLIC_URL)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--expected", type=Path, default=uploader.AGENDA_FILE)
    source.add_argument("--from-ftp", action="store_true",
                        help="Read the existing agenda over FTPS and verify its public URL without uploading.")
    parser.add_argument("--attempts", type=int, choices=range(1, 5), default=4)
    args = parser.parse_args(arguments)
    try:
        if args.from_ftp:
            configuration = uploader.read_configuration(os.environ)
            expected = uploader.validate_agenda_payload(uploader.read_remote_agenda(configuration))
        else:
            expected = uploader.read_agenda_payload(args.expected)
    except (uploader.ConfigurationError, uploader.AgendaError) as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        print("The expected calendar could not be read. Check the file or FTPS connection settings.", file=sys.stderr)
        return 1

    for attempt in range(args.attempts):
        try:
            agendas = verify_hosted_payload(expected, args.url)
            for location, agenda in sorted(agendas.items()):
                print(f"Verified hosted {location}: generatedAt={agenda['generatedAt']}")
            return 0
        except VerificationError as error:
            message = str(error)
        except Exception:
            # Network/server exceptions may include private connection details.
            message = "The public calendar could not be verified over HTTPS."
        if attempt + 1 < args.attempts:
            time.sleep(5)
    print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
