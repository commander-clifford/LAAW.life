# Public v2 preview on GitHub Pages

Preview address: [commander-clifford.github.io/LAAW.life](https://commander-clifford.github.io/LAAW.life/).
The preview follows **`v2-dev`**, while `main` remains the default branch.
The HostGator site at `laaw.life` and its FTPS upload workflow are separate.

## What publishes

- A push to `v2-dev` runs the quality job, builds a second export with the Pages
  base path, runs browser smoke tests against that artifact, and publishes it.
- Pull requests targeting `main` or `v2-dev` run quality checks without publishing.
- For a manual preview rebuild, run the existing `deploy-pages.yml` workflow and
  select `v2-dev`. The GitHub CLI equivalent is:

  ```sh
  gh workflow run deploy-pages.yml --ref v2-dev
  ```

Only the verified `out/` artifact is published. Next's internal `.next` output
is never uploaded, and no custom domain is attached to the preview.

## Required repository setting

Use **GitHub Actions** as the Pages build source. In the `github-pages`
environment's deployment branch policies, replace the `main` branch entry with
one exact `v2-dev` branch entry. This allows preview deployments and prevents
an older workflow still on `main` from replacing them. Retain the environment's
other settings. The Pages API can retain `source.branch: main` metadata when
`build_type` is `workflow`; the workflow trigger and environment branch policy
control this Actions deployment.

Changing the default branch or merging the preview into `main` is not required.
Apply and verify the environment setting before the first preview publication.

## Calendar freshness in the preview

Every preview build regenerates the public calendar JSON. After deployment, the
browser reads it from the preview's own `calendar-data/agendas.json` path.
Push a reviewed change or run the manual rebuild above to update the preview's
calendar snapshot.

There is currently **no scheduled Pages refresh**. GitHub scheduled workflows
run from the default branch, which is still `main` and has no calendar-refresh
dispatcher. The manual `refresh-calendar.yml` helper on `v2-dev` has no schedule
and is not a replacement for registering a future default-branch dispatcher.
Do not claim an automatic refresh cadence for this preview.

The prepared FTP data-refresh workflow remains disabled and main-only. No
HostGator credentials, uploads, or refresh activation are needed for Pages.
