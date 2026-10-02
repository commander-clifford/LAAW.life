import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('site_release', Path(__file__).resolve().parents[1] / 'deploy-hostgator.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class FakeFTP:
    def __init__(self):
        self.files = {'index.html': b'old', 'og/index.html': b'original', '.htaccess': b'host', 'calendar-data/agendas.json': b'calendar', 'verification.txt': b'owned'}
        self.order = []

    def mlsd(self, directory):
        prefix = '' if directory == '.' else directory + '/'
        seen = set()
        for name in list(self.files):
            if name.startswith(prefix):
                tail = name[len(prefix):]
                child = tail.split('/')[0]
                if child not in seen:
                    seen.add(child)
                    yield child, {'type': 'dir' if '/' in tail else 'file'}

    def retrbinary(self, command, callback):
        callback(self.files[command[5:]])

    def storbinary(self, command, source):
        self.files[command[5:]] = source.read()

    def rename(self, source, target):
        self.order.append(target)
        self.files[target] = self.files.pop(source)

    def delete(self, name):
        if name in self.files:
            del self.files[name]
        else:
            import ftplib
            raise ftplib.error_perm('550 missing')

    def mkd(self, directory):
        pass


class SiteReleaseTests(unittest.TestCase):
    def test_asset_first_selection_preserves_host_calendar_og(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ['index.html', 'ivy/index.html', 'ivy/index.txt', '_next/static/a.js', '.htaccess', 'og/index.html', 'calendar-data/agendas.json']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'new')
            files = release.release_files(root, ['ivy/index.html', 'ivy/index.txt'])
            self.assertEqual(list(files), ['_next/static/a.js', 'ivy/index.txt', 'ivy/index.html'])
            with self.assertRaises(ValueError):
                release.release_files(root, ['.htaccess'])

    def test_backup_precedes_write_and_preserves_unknown_files(self):
        ftp = FakeFTP()
        with tempfile.TemporaryDirectory() as tmp, patch.object(release, 'OG_HASH', release.digest(b'original')):
            backup = Path(tmp) / 'backup'
            release.deploy(ftp, {'_next/static/new.js': b'asset', 'index.html': b'new'}, backup, lambda _: None)
            self.assertEqual((backup / 'files' / 'index.html').read_bytes(), b'old')
            self.assertEqual(ftp.order, ['_next/static/new.js', 'index.html'])
            self.assertEqual(ftp.files['verification.txt'], b'owned')
            self.assertEqual(ftp.files['calendar-data/agendas.json'], b'calendar')

    def test_live_failure_restores_old_page(self):
        ftp = FakeFTP()
        def fail(_):
            raise ValueError('verification failed')
        with tempfile.TemporaryDirectory() as tmp, patch.object(release, 'OG_HASH', release.digest(b'original')):
            with self.assertRaises(ValueError):
                release.deploy(ftp, {'index.html': b'new'}, Path(tmp) / 'backup', fail)
            self.assertEqual(ftp.files['index.html'], b'old')

    def test_unrecognized_root_does_not_write(self):
        ftp = FakeFTP()
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                release.deploy(ftp, {'index.html': b'new'}, Path(tmp) / 'backup', lambda _: None)
            self.assertEqual(ftp.order, [])

    def test_collision_does_not_replace_hashed_asset(self):
        ftp = FakeFTP()
        ftp.files['_next/static/a.js'] = b'old asset'
        with tempfile.TemporaryDirectory() as tmp, patch.object(release, 'OG_HASH', release.digest(b'original')):
            with self.assertRaises(ValueError):
                release.deploy(ftp, {'_next/static/a.js': b'different'}, Path(tmp) / 'backup', lambda _: None)
            self.assertEqual(ftp.order, [])

    def test_backup_sealing_failure_prevents_any_write(self):
        ftp = FakeFTP()
        def fail():
            raise ValueError('encryption failed')
        with tempfile.TemporaryDirectory() as tmp, patch.object(release, 'OG_HASH', release.digest(b'original')):
            with self.assertRaises(ValueError):
                release.deploy(ftp, {'index.html': b'new'}, Path(tmp) / 'backup', lambda _: None, seal=fail)
            self.assertEqual(ftp.order, [])

    def test_transfer_failure_restores_attempted_page(self):
        ftp = FakeFTP()
        calls = 0
        original = ftp.rename
        def fail_after_replace(source, target):
            nonlocal calls
            calls += 1
            original(source, target)
            if calls == 1:
                raise ValueError('ambiguous transfer failure')
        ftp.rename = fail_after_replace
        with tempfile.TemporaryDirectory() as tmp, patch.object(release, 'OG_HASH', release.digest(b'original')):
            with self.assertRaises(ValueError):
                release.deploy(ftp, {'index.html': b'new'}, Path(tmp) / 'backup', lambda _: None)
            self.assertEqual(ftp.files['index.html'], b'old')

    def test_unexpected_export_file_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'index.html').write_text('site')
            (root / '.env').write_text('private')
            with self.assertRaises(ValueError):
                release.release_files(root)

    def test_traversal_rejected(self):
        for name in ['../secret', '/root', 'a//b', 'a\nSTOR other']:
            with self.assertRaises(ValueError):
                release.safe_path(name)


if __name__ == '__main__':
    unittest.main()
