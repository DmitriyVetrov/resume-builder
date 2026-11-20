"""Pinned scanner configuration and basic sensitivity controls."""
import re
import os
import tomllib
import tempfile
from pathlib import Path
import unittest
from infra_helpers import image_for, read, run


class Scanners(unittest.TestCase):
    def test_contract_waivers_are_exact_and_contract_scan_only(self):
        waivers = tomllib.loads(read('osv-scanner.toml'))['IgnoredVulns']
        expected = {'GHSA-qxc2-j82w-r537', 'GHSA-f23m-r3pf-42rh',
                    'GHSA-r5fr-rjxr-66jc', 'GHSA-xxjr-mmjv-4gpg',
                    'GHSA-g3hv-75wg-m249', 'GHSA-w5hq-g745-h8pq'}
        self.assertEqual({entry['id'] for entry in waivers}, expected)
        self.assertEqual(len(waivers), len(expected))
        for entry in waivers:
            self.assertEqual(str(entry['ignoreUntil']), '2026-11-17')
            self.assertIn('P02 contract-test dev dependency only', entry['reason'])
        script = read('scripts/ci/security.sh')
        contract_lines = [line for line in script.splitlines() if 'scan ' in line and '--lockfile=' in line]
        self.assertEqual(len(contract_lines), 2)
        self.assertIn('tests/contract/package-lock.json', contract_lines[0])
        self.assertIn('--config=/work/osv-scanner.toml', contract_lines[0])
        self.assertNotIn('--config=', contract_lines[1])

    def test_scanners_are_pinned(self):
        for name in ('gitleaks', 'osv-scanner', 'shellcheck', 'actionlint'):
            self.assertRegex(image_for(name), r'@sha256:[0-9a-f]{64}$')
        script = read('scripts/ci/security.sh')
        for name in ('GITLEAKS', 'OSV_SCANNER', 'ACTIONLINT'):
            self.assertIn(name, script)
        self.assertIn('$(image SHELLCHECK)', script)

    def test_actionlint_rejects_mutated_workflow(self):
        image = image_for('actionlint')
        workflow = read('.github/workflows/ci.yml')
        self.assertIn('runs-on: ubuntu-24.04', workflow)
        with tempfile.TemporaryDirectory() as tmp:
            # The scanner image runs as an unprivileged user.
            os.chmod(tmp, 0o755)
            file = Path(tmp, 'ci.yml')
            file.write_text(workflow)
            clean = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, '/work/ci.yml')
            self.assertEqual(clean.returncode, 0, clean.stdout + clean.stderr)
            file.write_text(workflow.replace('runs-on: ubuntu-24.04', 'run-on: ubuntu-24.04', 1))
            bad = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, '/work/ci.yml')
            self.assertNotEqual(bad.returncode, 0)
            self.assertIn('run-on', bad.stdout + bad.stderr)

    def test_gitleaks_configuration_extends_defaults(self):
        config = read('.gitleaks.toml')
        self.assertRegex(config, r'\[extend\]')
        self.assertRegex(config, r'useDefault\s*=\s*true')
        self.assertNotRegex(config, r'paths\s*=\s*\[\s*"(?:\.\*|\^\.\*\$|\*\*)"')

    def test_dependency_scan_and_update_config(self):
        script = read('scripts/ci/security.sh')
        self.assertIn('$(image OSV_SCANNER)', script)
        self.assertIn('--lockfile=', script)
        config = read('.github/dependabot.yml')
        for directory in ('/frontend', '/tests/contract', '/tests/e2e', '/backend'):
            self.assertIn(directory, config)
        for ecosystem in ('npm', 'nuget', 'github-actions'):
            self.assertIn(ecosystem, config)
        if (Path(__file__).resolve().parents[2] / 'osv-scanner.toml').exists():
            waivers = read('osv-scanner.toml')
            for section in waivers.split('[[IgnoredVulns]]')[1:]:
                for field in ('id', 'reason', 'ignoreUntil'):
                    self.assertRegex(section, rf'(?m)^\s*{field}\s*=')

    def test_shellcheck_detects_unquoted_variable(self):
        image = image_for('shellcheck')
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp, 'a.sh')
            file.write_text('#!/bin/sh\necho "$1"\n')
            clean = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, '/work/a.sh')
            self.assertEqual(clean.returncode, 0, clean.stdout + clean.stderr)
            file.write_text('#!/bin/sh\necho $1\n')
            bad = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, '/work/a.sh')
            self.assertNotEqual(bad.returncode, 0)
            self.assertIn('SC2086', bad.stdout + bad.stderr)

    def test_gitleaks_detects_planted_token(self):
        import random
        image = image_for('gitleaks')
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp, 'config.txt')
            file.write_text('ordinary fictional text\n')
            control = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, 'dir', '/work', '--no-banner')
            self.assertEqual(control.returncode, 0, control.stdout + control.stderr)
            alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            rng = random.Random(20261103)
            token = 'gh' + 'p_' + ''.join(rng.choice(alphabet) for _ in range(36))
            file.write_text('auth=' + token + '\n')
            planted = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, 'dir', '/work', '--no-banner')
            self.assertNotEqual(planted.returncode, 0)
            self.assertIn('leaks found: 1', (planted.stdout + planted.stderr).lower())

    def test_osv_detects_known_vulnerable_lock(self):
        import json
        image = image_for('osv-scanner')
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp, 'package-lock.json')
            base = {'name': 'fictional-scan', 'version': '1.0.0', 'lockfileVersion': 3,
                    'packages': {'': {'name': 'fictional-scan', 'version': '1.0.0', 'dependencies': {'is-number': '7.0.0'}},
                                 'node_modules/is-number': {'version': '7.0.0'}}}
            file.write_text(json.dumps(base))
            clean = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, 'scan', '--lockfile=/work/package-lock.json')
            self.assertEqual(clean.returncode, 0, clean.stdout + clean.stderr)
            base['packages']['']['dependencies'] = {'lodash': '4.17.20'}
            base['packages'].pop('node_modules/is-number')
            base['packages']['node_modules/lodash'] = {'version': '4.17.20'}
            file.write_text(json.dumps(base))
            bad = run('docker', 'run', '--rm', '-v', f'{tmp}:/work:ro', image, 'scan', '--lockfile=/work/package-lock.json')
            self.assertEqual(bad.returncode, 1, bad.stdout + bad.stderr)
            self.assertIn('lodash', bad.stdout + bad.stderr)
