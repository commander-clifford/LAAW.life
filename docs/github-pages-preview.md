# Public v2 preview on GitHub Pages

Preview address: [commander-clifford.github.io/LAAW.life](https://commander-clifford.github.io/LAAW.life/).
The preview follows **`v2-dev`**, while `main` remains the default branch.
The HostGator site at `laaw.life` and its FTPS upload workflow are separate.
See the [V2 closeout record](release-2026-09-16-v2.md) for release verification
and publication status.

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
Creating a GitHub tag or release does not trigger this workflow or deploy
HostGator. Production full-site uploads remain a separate operation.

## Required repository setting

Use **GitHub Actions** as the Pages build source. Keep the `github-pages`
environment's deployment branch policies limited to one exact `v2-dev` branch
entry. This allows preview deployments and prevents other branches from
replacing them. Retain the environment's other settings. The Pages API can
retain `source.branch: main` metadata when
`build_type` is `workflow`; the workflow trigger and environment branch policy
control this Actions deployment.

Keep `main` as the default branch for production calendar scheduling. Promoting
reviewed source into `main` does not change the preview's `v2-dev` deployment
policy. Verify that policy before changing the Pages configuration.

## Calendar freshness in the preview

Every preview build regenerates the public calendar JSON. After deployment, the
browser reads it from the preview's own `calendar-data/agendas.json` path.
Push a reviewed change or run the manual rebuild above to update the preview's
calendar snapshot.

There is currently **no scheduled Pages refresh**. The registered
`refresh-calendar.yml` helper has no schedule and runs only when dispatched
manually with `v2-dev` selected. GitHub schedules use the default `main` branch;
the separate production-calendar workflow on that branch updates HostGator,
not the Pages preview.
Do not claim an automatic refresh cadence for this preview.

The separate main-only FTP data-refresh workflow is enabled. Its
[verified scheduled run on September 16](https://github.com/commander-clifford/LAAW.life/actions/runs/35090646732)
updated HostGator's JSON and passed exact public HTTPS verification. Its
30-minute target does not apply to Pages, and GitHub scheduling can be delayed.
No HostGator credentials, uploads, or refresh activation are needed for Pages.
