#!/usr/bin/env python3
"""Reviewed static export release over certificate-verified explicit FTPS.

Backups stay on the runner, never under the public document root. No pruning.
"""
import argparse
import ftplib
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import ssl
import sys
import subprocess
import tarfile
from io import BytesIO
from urllib.request import Request, urlopen
from urllib.parse import quote
from uuid import uuid4

OG_HASH = '89498f5e44981f74607672dbfffb8c98800e20c5d36b350590b73c2d5ede343f'
MAX_BACKUP = 500_000_000
MAX_FILE = 20_000_000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(name):
    path = PurePosixPath(name)
    if not name or str(path) != name or path.is_absolute() or '..' in path.parts or any(c in name for c in '\r\n\0\\'):
        raise ValueError('Invalid release path')
    return name


def allowed_export(name):
    path = PurePosixPath(name)
    if name.startswith('_next/static/'):
        return path.suffix in ('.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.svg')
    return path.suffix in ('.html', '.txt') and (len(path.parts) == 1 or path.parts[0] in ('ivy', 'hawthorne', '_not-found', '404'))


def preserved(name):
    return name == '.htaccess' or name.startswith(('og/', 'calendar-data/')) or name == '.nojekyll'


def release_files(root, selected=None):
    root = Path(root)
    all_files = {}
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Export must not contain symlinks')
        if path.is_file():
            name = safe_path(path.relative_to(root).as_posix())
            if not preserved(name):
                if not allowed_export(name) or path.stat().st_size > MAX_FILE:
                    raise ValueError('Export contains an unexpected or oversized file')
                all_files[name] = path.read_bytes()
    if 'index.html' not in all_files or not any(n.startswith('_next/static/') for n in all_files):
        raise ValueError('A complete verified domain-root export is required')
    if selected is not None:
        if not selected or not all(isinstance(n, str) for n in selected):
            raise ValueError('Hotfix must list affected exported files')
        for name in selected:
            safe_path(name)
            if name not in all_files or name.startswith('_next/'):
                raise ValueError('Hotfix lists a missing or protected file')
        route_parents = {str(PurePosixPath(n).parent) for n in selected if n.endswith('.html')}
        all_files = {n: b for n, b in all_files.items() if n in selected or n.startswith('_next/static/') or
                     (n.endswith('.txt') and str(PurePosixPath(n).parent) in route_parents)}
    # New hashed dependencies precede payloads, HTML follows, homepage last.
    return dict(sorted(all_files.items(), key=lambda item: (
        0 if item[0].startswith('_next/static/') else 3 if item[0] == 'index.html' else 2 if item[0].endswith('.html') else 1,
        item[0],
    )))


def read_remote(ftp, name):
    chunks = []
    total = 0
    def receive(chunk):
        nonlocal total
        total += len(chunk)
        if total > MAX_FILE:
            raise ValueError('Remote file exceeds backup size limit')
        chunks.append(chunk)
    ftp.retrbinary('RETR ' + name, receive)
    return b''.join(chunks)


def snapshot(ftp, destination):
    destination = Path(destination)
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    records = {}
    total = 0

    def visit(directory=''):
        nonlocal total
        for name, facts in ftp.mlsd(directory or '.'):
            if name in ('.', '..') or facts.get('type') in ('cdir', 'pdir'):
                continue
            relative = safe_path(f'{directory}/{name}' if directory else name)
            kind = facts.get('type')
            if kind == 'dir':
                visit(relative)
            elif kind == 'file':
                data = read_remote(ftp, relative)
                total += len(data)
                if total > MAX_BACKUP:
                    raise ValueError('Backup exceeds reviewed size limit')
                path = destination / 'files' / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                path.chmod(0o600)
                records[relative] = digest(data)
            else:
                raise ValueError('Backup contains unsupported remote file type')
    visit()
    if records.get('og/index.html') != OG_HASH or 'index.html' not in records:
        raise ValueError('Destination does not match the preserved production site')
    (destination / 'manifest.json').write_text(json.dumps(records, indent=2))
    return records


def ensure_parent(ftp, name):
    parts = PurePosixPath(name).parts[:-1]
    for length in range(1, len(parts) + 1):
        directory = '/'.join(parts[:length])
        try:
            ftp.mkd(directory)
        except ftplib.error_perm:
            # Existing directory is acceptable; permission failures still fail cwd.
            current = ftp.pwd()
            ftp.cwd(directory)
            ftp.cwd(current)


def replace(ftp, name, data):
    ensure_parent(ftp, name)
    parent = str(PurePosixPath(name).parent)
    temporary = (parent + '/' if parent != '.' else '') + '.release-' + uuid4().hex
    try:
        ftp.storbinary('STOR ' + temporary, BytesIO(data))
        if digest(read_remote(ftp, temporary)) != digest(data):
            raise ValueError('Transferred file checksum mismatch')
        ftp.rename(temporary, name)
    finally:
        try:
            ftp.delete(temporary)
        except ftplib.error_perm:
            pass


def restore(ftp, backup, records, touched):
    # Dependencies before payloads and pages, mirroring release order.
    for name in touched:
        if name in records:
            data = (Path(backup) / 'files' / name).read_bytes()
            if digest(data) != records[name]:
                raise ValueError('Rollback backup checksum mismatch')
            replace(ftp, name, data)
        elif not name.startswith('_next/static/'):
            ftp.delete(name)


def verify_live(files, origin='https://laaw.life'):
    for name, data in files.items():
        # Only check changed files, including their dependency bytes.
        request = Request(origin + '/' + quote(name, safe='/') + '?release=' + uuid4().hex,
                          headers={'Cache-Control': 'no-cache'})
        with urlopen(request, timeout=45) as response:
            if response.url.split('/')[2] != 'laaw.life' or digest(response.read()) != digest(data):
                raise ValueError('Public release checksum mismatch')


def seal_backup(backup, output, passphrase):
    if len(passphrase) < 32:
        raise ValueError('Set a strong protected backup encryption passphrase')
    archive = Path(str(backup) + '.tar.gz')
    try:
        with tarfile.open(archive, 'w:gz') as bundle:
            bundle.add(backup, arcname='production-backup')
        archive.chmod(0o600)
        subprocess.run(['gpg', '--batch', '--yes', '--pinentry-mode', 'loopback',
                        '--passphrase-fd', '0', '--symmetric', '--cipher-algo', 'AES256',
                        '--output', str(output), str(archive)],
                       input=passphrase.encode(), capture_output=True, check=True)
    finally:
        archive.unlink(missing_ok=True)


def deploy(ftp, files, backup, verify=verify_live, seal=None):
    records = snapshot(ftp, backup)
    if seal:
        seal()
    changed = {n: data for n, data in files.items() if records.get(n) != digest(data)}
    for name in changed:
        if name.startswith('_next/static/') and name in records:
            raise ValueError('Refusing to overwrite an existing hashed asset')
    touched = []
    try:
        for name, data in changed.items():
            if name.startswith('_next/static/') and name in records:
                raise ValueError('Refusing to overwrite an existing hashed asset')
            # Record the attempted replacement so even ambiguous rename failure rolls back.
            touched.append(name)
            replace(ftp, name, data)
        verify(changed)
    except Exception:
        restore(ftp, backup, records, touched)
        raise
    return records, touched


def configuration(environment):
    required = ['SITE_FTP_HOST', 'SITE_FTP_USERNAME', 'SITE_FTP_PASSWORD', 'SITE_FTP_DIRECTORY', 'SITE_BACKUP_PASSPHRASE']
    for key in required:
        if not environment.get(key) or any(c in environment[key] for c in '\r\n\0'):
            raise ValueError('Missing or invalid protected site connection setting')
    host = environment['SITE_FTP_HOST']
    if any(c.isspace() or c in '/\\:@?#' for c in host):
        raise ValueError('Host must be a hostname')
    directory = environment['SITE_FTP_DIRECTORY']
    if not directory.startswith('/') or directory == '/' or str(PurePosixPath(directory)) != directory or '..' in PurePosixPath(directory).parts or '\\' in directory:
        raise ValueError('Set the verified absolute domain document root, not the FTP root')
    port = int(environment.get('SITE_FTP_PORT') or 21)
    if not 1 <= port <= 65535 or port == 990:
        raise ValueError('An explicit FTPS port is required')
    if environment.get('SITE_RELEASE_ENABLED') != 'true':
        raise ValueError('Site releases are disabled')
    return host, port, directory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--export', default='out')
    parser.add_argument('--backup', required=True)
    parser.add_argument('--hotfix-manifest')
    parser.add_argument('--encrypted-backup')
    parser.add_argument('--restore', help='Restore files from a private backup instead of releasing')
    args = parser.parse_args()
    ftp = None
    try:
        selected = None
        if args.hotfix_manifest:
            selected = json.loads(Path(args.hotfix_manifest).read_text())['files']
        files = release_files(args.export, selected) if not args.restore else None
        host, port, directory = configuration(os.environ)
        ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
        ftp.connect(host, port)
        ftp.auth()
        ftp.login(os.environ['SITE_FTP_USERNAME'], os.environ['SITE_FTP_PASSWORD'])
        ftp.prot_p()
        ftp.cwd(directory)
        seal = lambda: seal_backup(args.backup, args.encrypted_backup or (args.backup + '.tar.gz.gpg'), os.environ['SITE_BACKUP_PASSPHRASE'])
        if args.restore:
            source = Path(args.restore)
            records = json.loads((source / 'manifest.json').read_text())
            if not isinstance(records, dict) or records.get('og/index.html') != OG_HASH:
                raise ValueError('Invalid rollback manifest')
            restoration = {}
            for name, checksum in records.items():
                safe_path(name)
                if preserved(name) or not allowed_export(name):
                    continue
                data = (source / 'files' / name).read_bytes()
                if digest(data) != checksum or not allowed_export(name):
                    raise ValueError('Invalid rollback file')
                restoration[name] = data
            restoration = dict(sorted(restoration.items(), key=lambda item: (
                0 if item[0].startswith('_next/static/') else 3 if item[0] == 'index.html' else 2 if item[0].endswith('.html') else 1, item[0])))
            deploy(ftp, restoration, args.backup, seal=seal)
        else:
            deploy(ftp, files, args.backup, seal=seal)
    except Exception:
        print('Release failed. Inspect the private rollback backup; restore may also have failed. No plaintext fallback was attempted.', file=sys.stderr)
        return 1
    finally:
        if ftp:
            ftp.close()
    print('Verified changed production bytes over HTTPS. Preserved calendar, OG and host rules.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
