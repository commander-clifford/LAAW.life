# Calendar refresh on the FTP-hosted site

The initial site upload includes `calendar-data/agendas.json`. The browser reads
that same-origin file for current daily events. A static FTP upload cannot run
the calendar generator itself, so the prepared GitHub Actions workflow refreshes
only this file every 15 minutes. It does not rebuild or upload the website.

**The workflow is disabled until its repository variable is explicitly enabled.**
No host credentials or destination have been assumed. GitHub Pages refreshes are
separate and do not change the copy served by laaw.life.

## Confirm at launch

1. Identify the FTP account and the actual laaw.life document root in the current
   upload client or HostGator account. Upload the complete reviewed site first,
   including its `calendar-data` folder. Verify the public JSON URL works.
2. Confirm that the account supports **explicit FTP over TLS**, normally port 21,
   using a hostname whose TLS certificate validates. This script does not support
   SFTP, implicit FTPS on port 990, unencrypted FTP, or a certificate-validation
   bypass. It uses passive transfers with encryption on both connections.
3. Record the exact absolute FTP path to the uploaded `calendar-data` directory.
   It might be `/public_html/calendar-data` or `/calendar-data` for an account
   restricted to the site's root. These are examples, not the verified path.
   Prefer a dedicated FTP account restricted to the actual `calendar-data`
   folder. For that verified account, its FTP-visible directory is `/` and
   `FTP_CALENDAR_ACCOUNT_ROOT` must be `true`. Otherwise the script requires an
   existing directory ending in `/calendar-data`, with no trailing slash. It
   never guesses the document root or creates directories.
4. Confirm permission to upload a temporary file, query its size, and rename it
   over `agendas.json` in that directory. A rename failure stops the refresh; the
   script never deletes the published file to work around a host restriction.

## Configure GitHub Actions after those details are confirmed

Add these **repository Actions secrets** through GitHub's settings. Do not put
credentials in source files, commit messages, or the conversation.

| Secret | Value |
| --- | --- |
| `FTP_HOST` | Verified FTPS hostname only, without a scheme, path, or port |
| `FTP_USERNAME` | FTP account username |
| `FTP_PASSWORD` | FTP account password |

Add these **repository Actions variables**:

| Variable | Value |
| --- | --- |
| `FTP_CALENDAR_DIRECTORY` | Exact absolute FTP path ending in `/calendar-data` |
| `FTP_CALENDAR_ACCOUNT_ROOT` | `true` only after verifying the FTP account is restricted directly to `calendar-data`; use directory `/` for this account |
| `FTP_PORT` | Optional explicit FTPS port; blank means `21` |
| `FTP_CALENDAR_REFRESH_ENABLED` | Set to `true` only when ready to start uploads |

The workflow file and generator must be on `main`, which must be the default
branch for scheduled runs. Keep the enable variable unset or `false` during
setup. Run **Refresh FTP-hosted calendar data** manually from `main` with mode
`preflight` first: it verifies the TLS login and reads the existing file, then
compares that file to the public HTTPS response without uploading anything.
After preflight succeeds, run mode `refresh` for the first authorized upload.
Manual refresh does not require the schedule-enable variable. Confirm the run
and its public verification succeed for both locations, then set
`FTP_CALENDAR_REFRESH_ENABLED` to `true`. Verify a later scheduled run succeeds.

## How refreshes fail safely

- Each run checks the application and uploader, then generates both locations
  from their public calendar feeds. A failed feed stops the run before uploading.
- The uploader requires generation within the last two hours and date coverage
  for today and tomorrow in Pacific time.
- It uploads to a unique temporary filename, checks the remote byte count, and
  renames the complete file to `agendas.json`. Interrupted transfers leave the
  prior published file in place. It never uploads HTML, scripts, or `_next` assets.
- A separate HTTPS check verifies that the public URL serves the exact fresh
  JSON for both locations. An HTML fallback, older cached file, failed request,
  or wrong destination fails the run even if FTP reported a successful upload.
- Credentials are confined to the FTPS preflight or upload step, and server error text
  is suppressed to avoid exposing account details in logs.
- GitHub schedules can be delayed, and public-repository schedules can be
  disabled after prolonged repository inactivity. The 15-minute schedule is a
  target, not a guarantee. Keep Actions failure notifications enabled and check
  the latest successful run if the agenda reports a refresh issue.

To pause refreshes, set `FTP_CALENDAR_REFRESH_ENABLED` to `false`. This does not
delete the last successful agenda. Restoring a prior website backup may also
require pausing this workflow until that version is compatible with the JSON.

For a temporary manual refresh, run `npm run calendar:generate` locally and use
the existing FTP client to replace only `public/calendar-data/agendas.json` in
the verified remote calendar directory. The file should be regenerated and
uploaded together; the original build's data will eventually age out.

## Local validation (no network upload)

```sh
python3 -B -m unittest discover -s scripts/tests -p 'test_*.py'
```

The tests use a mock FTP client. They cover path validation, TLS protection,
missing feeds, Pacific-date coverage, stale payloads, partial transfers, size
mismatches, rename failures, and sanitized errors. The uploader itself makes
remote changes when run with complete configuration; do not run it as a test.

Protocol and scheduling references: [Python FTPS documentation](https://docs.python.org/3/library/ftplib.html#ftplib.FTP_TLS),
[GitHub scheduled workflow documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
