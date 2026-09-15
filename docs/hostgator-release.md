# Publish and roll back laaw.life

## Production target

`https://laaw.life/` is served by HostGator Apache. On 2026-09-15 its response
matched the original single-file HTML exactly. GitHub Pages at
`https://commander-clifford.github.io/LAAW.life/` and the configured Sites project
are separate deployments; publishing either does not update the custom domain.
Keep the current domain and build for the domain root (`PAGES_BASE_PATH` empty).

## Prepare a reviewed release

1. Finish the engineering and screenshot-based design reviews in the current
   working checkout, retaining its existing changes.
2. Run `PAGES_BASE_PATH= npm run release:check`, then
   `npm run calendar:check-public`. Confirm the generated agenda includes the
   next business day's expected events in Pacific time.
3. Package the same, unchanged export:

   ```sh
   node scripts/package-hostgator-release.mjs /tmp/laaw-life-release-2026-09-15.tar.gz
   tar -tzf /tmp/laaw-life-release-2026-09-15.tar.gz
   ```

   The package contains the **contents of `out/`** at its root, including
   `.htaccess`, `_next/`, both location routes, `404.html`, and `og/index.html`.
   A SHA-256 sidecar identifies the archive. The script rejects a Pages-prefixed
   export, a changed OG page, missing assets, or an existing destination file.
   Never upload `.next/`, source, dependencies, or the archive itself into the
   public document root.

## Upload through the existing HostGator account

1. Confirm the document root configured specifically for `laaw.life` in
   HostGator. Do not infer it from the account's primary domain. Use the existing
   authenticated connection or file manager. HostGator documents
   [explicit FTPS over TLS on port 21](https://www.hostgator.com/help/article/secure-ftp-sftp-and-ftps).
   Verify this account's FTP hostname, TLS certificate, and exact domain
   directory before uploading; keep credentials out of
   commands, files, logs, and source control.
2. Download a dated backup of that complete document root, including hidden
   files and the existing `.htaccess`, to a location outside public hosting.
   Record the domain root and the backup location. Inspect existing rewrite,
   HTTPS, and host-specific rules before replacing them. Preserve necessary
   host rules, but remove the old catch-all that serves the homepage for every
   path. The supplied `.htaccess` is a root-domain Apache static-site baseline,
   not proof that the host permits every override.
3. Extract the release locally, or stage it **outside the live document root**
   using the host's file manager. Enable hidden-file visibility. Upload all
   `_next/` assets first, then the route files and `og/`. Upload HTML/payload
   files as a coordinated release and the homepage last. Prefer a host-supported
   atomic directory switch when available; file-by-file FTP is not atomic, so
   keep this interval short. Do not delete unrelated domain verification or
   host-managed files. Retain old hashed `_next` assets through the rollback
   window for visitors with an already-open page.
4. Activate the reviewed Apache configuration only after the route files are
   present. `DirectorySlash On` resolves `/ivy`, `/hawthorne`, and `/og` through
   their trailing-slash directories. `ErrorDocument 404 /404.html` returns the
   designed missing-page response with a 404 status. Disable inherited fallback
   handling; a missing URL must not return the homepage with status 200.

## Verify the public release

- Request `/`, `/ivy/`, `/hawthorne/`, `/og`, `/og/`, and a new nonexistent URL.
  Verify HTTPS, route content, status codes, and CSS/JavaScript MIME types.
- `/og` must resolve publicly to the original page. After following redirects,
  its raw response SHA-256 must be
  `89498f5e44981f74607672dbfffb8c98800e20c5d36b350590b73c2d5ede343f`.
  Its source is `ebaef508f02993c7d3747cc3ce276fda6ff7a592:index.html`, also
  identical to `09a21f415c2483ee251b6d0195f11733cf5b1140:dist/index.html`.
  It has inline CSS and absolute Google Calendar URLs, requiring no local
  companion assets. Preserve it unaltered, including its historic calendar
  configuration; the v2 calendar configuration is separate.
- Check both calendars anonymously on a narrow and a wide viewport. Confirm
  the subtle footer OG link opens the original document, keyboard navigation
  works, and the current Pacific date and expected events are visible.
- Confirm the calendar refresh process updates **HostGator** before calling
  freshness complete. The GitHub Pages refresh workflow alone cannot update
  this domain. Follow [calendar refresh setup](calendar-refresh.md), then record
  the active schedule, latest successful update, and a recovery path; static
  builds contain a finite agenda window.

## Rollback

If routes, assets, or calendars fail after the switch, restore the saved live
document-root contents and original `.htaccess` through the same authenticated
connection (or switch back to the backed-up directory). Restore prior HTML and
its assets together. Check `/` and both original embedded calendars, then
compare the homepage with the saved pre-release hash. Remove only files added
by the failed release using its archive listing; retain unrelated host files.
Do not reset the working checkout to perform a hosting rollback.

The `v1.0.0` Git tag is the older Next.js/GitHub Pages conversion, so it is not
the authoritative backup of the currently hosted original single-file site.

Apache reference: [directory indexes and trailing slashes](https://httpd.apache.org/docs/2.4/mod/mod_dir.html),
[custom error documents](https://httpd.apache.org/docs/2.4/mod/core.html#errordocument).
