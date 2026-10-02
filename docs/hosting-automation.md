# Reviewed HostGator release automation — issue #12

## Recommendation

Keep HostGator provisionally and automate the existing static release. This is an engineering recommendation, not a cost claim: the account renewal price, measured traffic/bandwidth and support experience still need the owner's records. The site needs static HTTPS hosting and refreshed public calendar JSON; no application server or database is required. Changing DNS solely to avoid file dragging adds migration risk that the prepared workflow can avoid.

Evidence checked October 2, 2026: public HTTPS returned 200 with Apache headers; A record 162.241.144.16; nameservers ns8543.hostgator.com and ns8544.hostgator.com. Repository: Next static export, root-domain routes, Apache `.htaccess`/404 behavior, preserved `/og/`, GA4, an external tip link and device-local preferences; no first-party form or sign-in backend. Domain registration/billing, actual document root, TLS renewal configuration, CDN, storage quotas and paid plan details remain unverified. Do not infer those from the public DNS.

| Option | Fit, preview and recovery | Cost and cutover considerations |
| --- | --- | --- |
| Keep HostGator | Existing Apache rules, domain and calendar updater; verified FTPS available as a documented provider option. Encrypted pre-change backups and changed-byte checks prepared here. GitHub Pages continues as the separate preview. | Existing account invoice unknown. No DNS migration. File transfers can expose mixed versions briefly; assets-first order reduces risk, and backups enable recovery. |
| Cloudflare Pages | Static assets on a global network, Git integration, preview deployments and rollback support. Rewrite Apache rules to provider equivalents; replace the calendar-only FTPS updater with deployment/upload integration. | Free plan documented at 500 builds/month, 20,000 files and 25 MiB/file; refreshing twice hourly by full build would exceed that build count. Assess a separate data refresh path before migrating. Custom-domain/DNS and certificate cutover must be rehearsed. |
| Vercel | Git previews, CDN and rollback; Next hosting is convenient but server features are unnecessary here. Calendar refresh still needs redesign. | Pro currently $20/month platform fee with one deploying seat and usage credit, plus possible usage/add-ons. Hobby use restrictions must be assessed against actual site use; donations alone are allowed. DNS migration and redirect parity still required. |
| GitHub Pages | Keep the current v2-dev preview, with existing quality checks. Static hosting provides an escape path for artifacts. | Published bandwidth/site limits and commercial-purpose restrictions make it a preview choice pending evaluation, rather than a proposed production switch. |

Sources: [HostGator secure transfer](https://www.hostgator.com/help/article/secure-ftp-sftp-and-ftps), [Cloudflare limits](https://developers.cloudflare.com/pages/platform/limits/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [Cloudflare rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/), [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

SFTP is preferred if the account has suitable scoped SSH access and verified host keys. HostGator documents account/plan-specific SFTP ports and control-panel credentials. The existing production updater already uses certificate-verified explicit FTPS, so this draft implements that known protocol without widening privileges to a control-panel SSH account. A separate full-site account/root must be confirmed; a calendar-only account is insufficient. No plaintext fallback is supported.

## Setup requiring human review

1. Approve this keep-or-migrate recommendation and release approach. No host, DNS, secret or production setting has been changed by this draft.
2. Confirm the exact domain document root in the account, secure transfer capability and certificate, existing production-only files and original OG hash. It must be an absolute non-root path. Run a separately approved read-only connection rehearsal before enabling uploads. This work did not access the hosting account.
3. Create `production-hostgator` with required human reviewers, no self approval/bypass, and deployment branch restricted to main. The environment lookup returned 404 during preparation, so its existence/protection could not be verified. Store SITE_FTP_HOST, SITE_FTP_USERNAME, SITE_FTP_PASSWORD and a random SITE_BACKUP_PASSPHRASE of at least 32 characters as protected environment secrets. Store SITE_FTP_DIRECTORY and optional SITE_FTP_PORT as environment variables. Never put values in source or PRs.
4. Keep repository variable SITE_RELEASE_ENABLED unset/false until the setup and rehearsal are approved. Set it true only as a separately approved activation step. The workflow has only a manual trigger and requires main. A branch push, PR, merge alone or schedule cannot publish the full site.
5. Preserve calendar updater compatibility. Both workflows use the `ftp-calendar-refresh` concurrency group, preventing overlap. An incompatible agenda/schema change requires pausing and coordinating the updater before release. Full release preserves existing calendar JSON, OG files and `.htaccess`; changes to those are separate reviewed operations.

## Full release

After approved code is on main, manually run Reviewed HostGator site release with mode full. It runs all application checks, transfer safeguards, build/export verification and browser checks before the protected environment approval. It uploads only allowed generated site files. Symlinks, unexpected files and oversized exports are rejected.

Before writing, it snapshots the entire verified document root to a private runner directory, checks the preserved OG hash, encrypts the backup with GPG AES256, and fails before upload if encryption fails. Only the encrypted archive is stored as a workflow artifact; plaintext production files are never uploaded to GitHub artifacts. Per-file backup limit 20 MB; total 500 MB. Accounts exceeding these bounds need reviewed adjustments.

New hashed assets upload first; payloads then route HTML; homepage last. Each file is staged, read back and checksum-verified before rename. Existing hashed names with different bytes are rejected. Unknown production files and old hashes are retained. Current managed route files are replaced, with no broad delete/mirror operation. Removing obsolete routes needs a separate reviewed cleanup.

Changed file bytes are checked over public HTTPS. Transfer or changed-byte failure triggers automatic restoration of touched files; recovery failures are reported and preserve the encrypted backup. Later calendar verification failure needs maintainer assessment; it is not represented as a confirmed release.

## Urgent focused hotfix

Keep a narrow reviewed code PR and merge only after human approval. Commit a docs/releases/*.json manifest containing `files` (affected exported HTML/payload paths) and `tests` (existing focused Vitest suites). Manually select hotfix mode and that committed manifest. Focused suites replace unrelated application/browser checks; the full static build and transfer safeguards still run because changed HTML must reference a coherent export. Associated route payloads and generated hashes are included automatically. Review the manifest before approving publication.

The workflow only publishes the exact reviewed main SHA. Production is reconciled to reviewed source before the upload, so an unreviewed production-only patch cannot drift from main. A broader emergency path from unmerged code is not enabled by this draft.

## Rollback and recovery

Download the encrypted backup artifact and decrypt it locally with GPG using the protected backup passphrase (interactive prompt). Inspect its manifest and checksums. With the same reviewed protected connection settings, run scripts/deploy-hostgator.py with `--restore` pointing at the extracted production-backup folder and `--backup` naming a new private backup directory. The tool first snapshots/encrypts the current site, then restores backed-up managed HTML/payloads and dependencies, with public checksum verification. It preserves calendar, OG, host rules and unrelated production files. Newly introduced routes or a provider-internal corruption may need separate manual recovery; this restore operation does not purge unknown paths.

This command is a production write and requires explicit human authorization. Cyberduck using verified SFTP/FTPS remains an interim manual backup/recovery option; it is not required for automated releases. A failed automatic restoration requires maintainer inspection before retrying. Backups should be retained securely beyond the 30-day artifact retention when needed.

## If migration is later approved

Rehearse on a provider preview domain first: routes, 404s, OG hash, analytics, HTTPS, mobile interactions, calendar refresh and rollback. Back up current files and DNS/MX/TXT records; reduce only relevant DNS TTL after approval. Keep HostGator active, perform the approved domain/certificate cutover, then verify public records and the application. If verification fails, restore previous A/CNAME/nameserver settings while the old host remains active. Do not move email records or cancel hosting during the initial cutover.

## Validation and limits

37 Python safeguards pass, including assets-first selection, preservation, backup-before-write, failed encryption preventing writes, ambiguous transfer rollback, live verification rollback, hashed collisions and unsafe/unexpected paths. Application/browser CI provides the normal release check. Secure transfer account login, document root, actual reviewer enforcement, real backup encryption on the runner and a live upload have not been exercised. Issue #12 is prepared for review, not activated or fully accepted as a proven production deployment.
