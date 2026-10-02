#!/usr/bin/env python3
"""Run only the reviewed hotfix's named Vitest suites, without shell evaluation."""
import json
from pathlib import Path
import subprocess
import sys

manifest = json.loads(Path(sys.argv[1]).read_text())
tests = manifest.get('tests')
if not isinstance(tests, list) or not tests:
    raise ValueError('A hotfix needs reviewed focused test suites')
for test in tests:
    if not isinstance(test, str) or not test.startswith(('src/', 'app/')) or not test.endswith(('.test.ts', '.test.tsx')) or '..' in Path(test).parts or not Path(test).is_file():
        raise ValueError('Hotfix test paths must name existing application test suites')
subprocess.run(['npm', 'exec', '--', 'vitest', 'run', *tests], check=True)
