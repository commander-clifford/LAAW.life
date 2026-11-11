# Branch and release workflow

Use this lightweight promotion flow for LAAW.life. The repository already
separates the GitHub Pages preview from HostGator production; keep that split.

## Branches and pull requests

- `main` is the production source of record and the source of the scheduled
  HostGator calendar-data refresh. A merge does not upload the full website.
- `v2-dev` is the integration and public-preview branch. Its successful Pages
  workflow publishes the preview, not laaw.life.
- Make individual changes on short-lived topic branches. Open draft pull
  requests into `v2-dev`; run the repository checks and review the preview
  before including the work in a production release.
- Promote a verified preview with a short-lived `release/<description>` branch
  based on the exact successful Pages commit, then a pull request into `main`.
  Avoid unrelated local changes. Record the preview commit and validation in
  the pull request. Preserve the preview commit ancestry with a merge commit,
  rather than rewriting the long-lived branches or squashing their history.
- Do not merge until checks are green and the production release is authorized.
  Verify the remote merge SHA. Build production from that clean merged revision.
- After a production-only hotfix, merge the fix back into `v2-dev` through a pull
  request before the next release. Do not force-push either long-lived branch.

## Production release gate

Follow [the HostGator release and rollback guide](hostgator-release.md).
Use Node.js 24, empty Pages/base-path overrides, the existing production GA4
measurement ID, and newly generated calendar data. Run `npm run release:check`,
all Python uploader safeguards, and `npm run calendar:check-public`. Package the
same unchanged export only after validation. Record its SHA-256 and source SHA.

Before upload, verify the domain-specific document root and save a complete
private backup, including hidden files and the existing Apache configuration.
Pause the scheduled calendar uploader only for the coordinated upload window.
Preserve host-managed files, original `/og/`, old hashed assets for rollback,
and compatible calendar JSON. Upload assets before route files and the homepage
last, or use a verified atomic directory switch when available.

After upload, verify public routes, missing-page status, assets, responsive UI,
GA4, unchanged OG hash, current Pacific-day cards, and calendar-refresh behavior.
Resume the uploader's prior enabled state only after verification. Record the
actual production outcome separately from the PR and Pages deployment. If a
release fails, restore the complete pre-release snapshot using the guide.

## November 2026 promotion source

The requested preview is `v2-dev` at
`3fab06e37b6853b0f9d17ca787c2219c4888003a`, published by
[Pages run 39327826315](https://github.com/commander-clifford/LAAW.life/actions/runs/39327826315)
from [PR #39](https://github.com/commander-clifford/LAAW.life/pull/39).
At preparation, `main` was `e32d7aabaa847d8b998b58269313cfb78c94b0fc`;
the preview was 15 commits ahead, with no divergence. This promotion keeps the
existing feed generation, FTP uploader, calendar schema, Apache baseline and OG
source unchanged. Separate local calendar/feedback patches are not part of this
preview promotion. This section identifies the candidate, not a completed upload.
