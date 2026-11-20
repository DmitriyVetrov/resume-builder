"""P03 static policy and checker sensitivity."""
import copy
import json
import re
import tempfile
import unittest
from pathlib import Path
from infra_helpers import ROOT, compose_config, image_for, images_lock, read, run, violations_compose, workflow_jobs


class StaticPolicy(unittest.TestCase):
    def assert_env_example_policy(self, path):
        sample = Path(path).read_text()
        for key in ('MONGO', 'AZURITE_BLOB', 'MAILPIT_SMTP', 'MAILPIT_UI'):
            self.assertRegex(sample, rf'(?m)^RESUMISER_{key}_PORT=\d+$')
        for line in sample.splitlines():
            self.assertNotRegex(line, r'AccountKey=|://[^/\s:]+:[^/@\s]+@|[A-Za-z0-9+/]{32,}={0,2}')
            if not line or line.startswith('#'):
                continue
            match = re.fullmatch(r'([A-Z0-9_]+)=(.*)', line)
            self.assertIsNotNone(match, line)
            value = match.group(2)
            allowed = value in ('UseDevelopmentStorage=true', 'change-me', '<set-in-key-vault>')
            allowed |= value.isdecimal() and 1 <= int(value) <= 65535
            allowed |= bool(re.fullmatch(r'(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}', value))
            self.assertTrue(allowed, f'unsafe env example value for {match.group(1)}')

    def assert_workflow_policy(self, path):
        text = Path(path).read_text()
        jobs = workflow_jobs(text)
        self.assertEqual(set(jobs), {'backend', 'frontend', 'e2e', 'integration', 'security'})
        self.assertRegex(text, r'(?m)^permissions:\s*\n\s+contents: read\s*$')
        self.assertNotRegex(text, r'pull_request_target|secrets\.|contents: write|write-all')
        for trigger in ('push:', 'pull_request:', 'workflow_dispatch:'):
            self.assertIn(trigger, text)
        for name, body in jobs.items():
            self.assertEqual(re.findall(r'(?m)^\s+run:\s*(.+)$', body), [f'scripts/ci/{name}.sh'])
            self.assertIn('runs-on: ubuntu-24.04', body)
            self.assertRegex(body, r'timeout-minutes:\s*\d+')
            self.assertEqual(body.count('actions/checkout@'), body.count('persist-credentials: false'))
            if name in ('backend', 'frontend'):
                self.assertNotRegex(body, r'(?m)^\s+needs:')
        action_lines = re.findall(r'(?m)^\s*-?\s*uses:\s*(.+)$', text)
        self.assertTrue(action_lines, 'workflow must contain pinned actions')
        for line in action_lines:
            self.assertRegex(line, r'^(actions/checkout|actions/setup-dotnet|actions/setup-node)@[0-9a-f]{40}\s+#\s+v\d')

    def assert_telemetry_policy(self, path):
        body = Path(path).read_text()
        self.assertTrue('DOTNET_CLI_TELEMETRY_OPTOUT=1' in body or 'source ' in body)
        self.assertTrue('REDOCLY_TELEMETRY=off' in body or 'source ' in body)
        self.assertNotRegex(body, r'codecov|coveralls|sonar|upload-artifact')

    def test_compose_structure_and_safety(self):
        config = compose_config()
        self.assertEqual(config.get('name'), 'resumiser')
        self.assertEqual([], violations_compose(config, images_lock()))
        self.assertIn('--replSet', str(config['services']['mongo'].get('command')))
        self.assertIn('rs0', str(config['services']['mongo'].get('command')))
        ports = sorted(int(p['published']) for s in config['services'].values() for p in s['ports'])
        self.assertEqual(ports, [1025, 8025, 10000, 27017])
        self.assertIn('--disableTelemetry', str(config['services']['azurite'].get('command')))
        mail = config['services']['mailpit']
        self.assertTrue(str(mail.get('environment', {}).get('MP_DISABLE_VERSION_CHECK', '')).lower() == 'true' or '--disable-version-check' in str(mail.get('command')))

    def test_web_compose_profile_and_base_pins(self):
        config = compose_config(profile='app')
        web = config['services']['web']
        self.assertEqual(web['image'], 'resumiser-p05-web:local')
        self.assertEqual(web['build']['context'], str(ROOT / 'frontend'))
        self.assertEqual(web['ports'][0]['host_ip'], '127.0.0.1')
        self.assertEqual(web['ports'][0]['published'], '8080')
        self.assertIn('resumiser', web['networks'])
        self.assertTrue(web['healthcheck']['test'])
        dockerfile = read('frontend/Dockerfile')
        for key in ('NODE_BUILD', 'NGINX_WEB'):
            self.assertIn(images_lock()[key], dockerfile)
        self.assertIn('bash "$ROOT/docs/phases/P05/tests/image-check.sh"', read('scripts/ci/frontend.sh'))

    def test_compose_negative_mutations(self):
        base = {'networks': {'default': {}}, 'volumes': {'data': {}}, 'services': {n: {'image': 'x/y:1@sha256:' + 'a'*64, 'healthcheck': {'test': ['CMD', 'true']}, 'networks': {'default': {}}, 'ports': [{'host_ip': '127.0.0.1'}], 'volumes': [{'type': 'volume', 'source': 'data'}]} for n in ('mongo', 'azurite', 'mailpit')}}
        lock = {'X': 'x/y:1@sha256:' + 'a'*64}
        self.assertEqual([], violations_compose(base, lock))
        cases = [('healthcheck', lambda c: c['services']['mongo'].pop('healthcheck')), ('digest', lambda c: c['services']['mongo'].update(image='x/y:1')), ('host-ip', lambda c: c['services']['mongo']['ports'][0].update(host_ip='0.0.0.0')), ('named-volume', lambda c: c['services']['mongo']['volumes'][0].update(type='bind')), ('networks', lambda c: c['networks'].update(other={})), ('privilege', lambda c: c['services']['mongo'].update(privileged=True)), ('credential-env', lambda c: c['services']['mongo'].update(environment={'PASSWORD': 'fictional'}))]
        for expected, mutate in cases:
            with self.subTest(expected=expected):
                model = copy.deepcopy(base)
                mutate(model)
                self.assertIn(expected, violations_compose(model, lock))
        for expected, mutate in (
            ('image-lock', lambda c: c['services']['mongo'].update(image='x/other:1@sha256:' + 'b'*64)),
            ('host-ip', lambda c: c['services']['mongo']['ports'][0].pop('host_ip')),
            ('privilege', lambda c: c['services']['mongo'].update(network_mode='host')),
            ('docker-socket', lambda c: c['services']['mongo']['volumes'].append({'type': 'bind', 'source': '/var/run/docker.sock'})),
            ('credential-value', lambda c: c['services']['mongo'].update(environment={'MONGO_URI': 'mongodb://user:fictional@localhost/db'})),
        ):
            with self.subTest(expected=expected):
                model = copy.deepcopy(base)
                mutate(model)
                self.assertIn(expected, violations_compose(model, lock))

    def test_images_lock_and_playwright_version(self):
        entries = images_lock()
        for repo in ('mongo', 'azurite', 'mailpit', 'ryuk', 'playwright', 'gitleaks', 'osv-scanner', 'actionlint', 'shellcheck', 'oasdiff'):
            self.assertTrue(image_for(repo))
        version = json.loads(read('tests/e2e/package.json'))['devDependencies']['@playwright/test']
        self.assertRegex(image_for('playwright'), rf':v{re.escape(version)}-')

    def test_environment_and_ignore_rules(self):
        self.assert_env_example_policy(ROOT / '.env.example')
        for path, expected in (('.env', 0), ('.env.local', 0), ('.env.example', 1)):
            self.assertEqual(run('git', 'check-ignore', '-q', path).returncode, expected)

    def test_environment_negative_mutations(self):
        base = read('.env.example')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / '.env.example'
            path.write_text(base)
            self.assert_env_example_policy(path)
            for label, mutation in (
                ('account key', base + '\nFICTIONAL_STORAGE=AccountKey=' + 'A' * 40 + '\n'),
                ('missing placeholder', base + '\nFICTIONAL_PASSWORD=real-looking-secret\n'),
            ):
                with self.subTest(label=label):
                    path.write_text(mutation)
                    with self.assertRaises(AssertionError):
                        self.assert_env_example_policy(path)

            self.assertEqual(run('git', 'init', '-q', cwd=root).returncode, 0)
            ignore = root / '.gitignore'
            ignore.write_text(read('.gitignore'))
            for name in ('.env', '.env.local'):
                self.assertEqual(run('git', 'check-ignore', '-q', name, cwd=root).returncode, 0)
            self.assertEqual(run('git', 'check-ignore', '-q', '.env.example', cwd=root).returncode, 1)
            ignore.write_text('# environment rules removed\n')
            for name in ('.env', '.env.local'):
                with self.subTest(name=name):
                    self.assertEqual(run('git', 'check-ignore', '-q', name, cwd=root).returncode, 1)

    def test_manifest_and_tooling_policy(self):
        backend = read('backend/Directory.Packages.props')
        for name in ('xunit.v3', 'Microsoft.NET.Test.Sdk', 'Testcontainers.MongoDb'):
            self.assertIn(name, backend)
        self.assertNotRegex(backend, r'Version="[^" ]*[~^*][^" ]*"')
        for path in ('frontend/package.json', 'tests/e2e/package.json'):
            package = json.loads(read(path))
            self.assertTrue(package.get('private'))
            for version in {**package.get('dependencies', {}), **package.get('devDependencies', {})}.values():
                self.assertRegex(version, r'^\d+\.\d+\.\d+(?:-[\w.-]+)?$')
        front = json.loads(read('frontend/package.json'))
        self.assertEqual(front['type'], 'module')
        for name in ('vitest', 'jsdom', '@testing-library/react', '@testing-library/jest-dom'):
            self.assertIn(name, {**front.get('dependencies', {}), **front.get('devDependencies', {})})
        e2e = json.loads(read('tests/e2e/package.json'))
        self.assertEqual(set(e2e.get('devDependencies', {})), {'@playwright/test', '@axe-core/playwright'})
        self.assertIn('ADR-041', read('docs/blueprint/DECISION-REGISTER.md'))

    def test_backend_lock_and_frontend_typescript_policy(self):
        sdk = json.loads(read('backend/global.json'))['sdk']
        self.assertRegex(sdk['version'], r'^10\.0\.3\d\d$')
        self.assertEqual(sdk['rollForward'], 'latestPatch')
        props = read('backend/Directory.Build.props')
        for item in ('net10.0', 'TreatWarningsAsErrors', 'RestorePackagesWithLockFile'):
            self.assertIn(item, props)
        packages = read('backend/Directory.Packages.props')
        self.assertIn('ManagePackageVersionsCentrally', packages)
        for project in (ROOT / 'backend').rglob('*.csproj'):
            with self.subTest(project=project.name):
                self.assertTrue((project.parent / 'packages.lock.json').exists())
                self.assertNotRegex(project.read_text(), r'<PackageReference[^>]*\bVersion=')
        nuget = read('backend/nuget.config')
        self.assertIn('<clear', nuget)
        self.assertIn('packageSourceMapping', nuget)
        configs = list((ROOT / 'frontend').glob('tsconfig*.json'))
        self.assertTrue(configs, 'ARTIFACT_MISSING frontend/tsconfig*.json')
        joined = '\n'.join(path.read_text() for path in configs)
        for flag in ('strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes'):
            self.assertRegex(joined, rf'"{flag}"\s*:\s*true')

    def test_playwright_harness_policy(self):
        config = read('tests/e2e/playwright.config.ts')
        for item in ('chromium', 'firefox', 'webkit', 'forbidOnly', 'retries: 0', '127.0.0.1'):
            self.assertIn(item, config)

    def test_generated_paths_are_ignored(self):
        for path in ('frontend/dist/x', 'frontend/node_modules/x', 'tests/e2e/node_modules/x',
                     'tests/e2e/test-results/x', 'tests/e2e/playwright-report/x',
                     'backend/tests/ResumeBuilder.Toolchain.Tests/bin/x',
                     'backend/tests/ResumeBuilder.Toolchain.Tests/obj/x'):
            with self.subTest(path=path):
                self.assertEqual(run('git', 'check-ignore', '-q', path).returncode, 0)

    def test_rejected_test_framework_is_detectable(self):
        rejected = {'moq', 'fluentassertions', 'jest', '@jest/globals', 'ts-jest', 'babel-jest', 'jest-environment-jsdom', 'cypress'}
        front = json.loads(read('frontend/package.json'))
        present = set(front.get('dependencies', {})) | set(front.get('devDependencies', {}))
        self.assertFalse({name.lower() for name in present} & rejected)
        self.assertNotIn('@testing-library/jest-dom', rejected)
        mutant = dict(front.get('devDependencies', {}), Moq='1.0.0')
        self.assertIn('moq', {name.lower() for name in mutant} & rejected)

    def test_ci_telemetry_and_upload_policy(self):
        for path in sorted((ROOT / 'scripts/ci').glob('*.sh')):
            with self.subTest(path=path.name):
                self.assert_telemetry_policy(path)
        self.assertTrue(list((ROOT / 'scripts/ci').glob('*.sh')), 'ARTIFACT_MISSING scripts/ci/*.sh')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, 'script.sh')
            path.write_text('export DOTNET_CLI_TELEMETRY_OPTOUT=1 REDOCLY_TELEMETRY=off\n')
            self.assert_telemetry_policy(path)
            path.write_text('export REDOCLY_TELEMETRY=off\n')
            with self.assertRaises(AssertionError):
                self.assert_telemetry_policy(path)

    def test_workflow_policy(self):
        self.assert_workflow_policy(ROOT / '.github/workflows/ci.yml')

    def test_workflow_negative(self):
        base = read('.github/workflows/ci.yml')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp, 'ci.yml')
            path.write_text(base)
            self.assert_workflow_policy(path)
            mutations = {
                'tag-pinned action': base.replace('actions/checkout@' + re.search(r'actions/checkout@([0-9a-f]{40})', base).group(1), 'actions/checkout@v4'),
                'write permission': base.replace('contents: read', 'contents: write', 1),
                'checkout credentials': base.replace('persist-credentials: false', 'persist-credentials: true', 1),
                'frontend dependency': base.replace('  frontend:\n', '  frontend:\n    needs: backend\n', 1),
                'pull request target': base.replace('  pull_request:', '  pull_request_target:', 1),
                'secret reference': base.replace('github.ref', 'secrets.FICTIONAL_TOKEN', 1),
            }
            for label, mutated in mutations.items():
                with self.subTest(label=label):
                    self.assertNotEqual(mutated, base)
                    path.write_text(mutated)
                    with self.assertRaises(AssertionError):
                        self.assert_workflow_policy(path)

    def test_scripts_and_manifests(self):
        for name in ('preflight', 'local', 'backend', 'frontend', 'e2e', 'integration', 'security'):
            script = read(f'scripts/ci/{name}.sh')
            self.assertTrue(script.startswith('#!/usr/bin/env bash'))
            self.assertIn('set -euo pipefail', '\n'.join(script.splitlines()[:10]))
            self.assertNotIn('@sha256:', script)
            self.assertNotIn('\r', script)
        integration = read('scripts/ci/integration.sh')
        self.assertIn('docs/phases/P02/tests/suite.cmd', integration)
        self.assertIn('npm_config_ignore_scripts=true', integration)
        self.assertIn('resumiser-ci', integration)
        self.assertIn('--wait-timeout 120', integration)
        self.assertIn('down -v', integration)
        for path in ('frontend/package.json', 'tests/e2e/package.json'):
            package = json.loads(read(path))
            for group in ('dependencies', 'devDependencies'):
                for version in package.get(group, {}).values():
                    self.assertNotRegex(version, r'^[~^*]|\*$')
        front = json.loads(read('frontend/package.json'))
        for script in ('lint', 'typecheck', 'test', 'build', 'preview'):
            self.assertIn(script, front['scripts'])
        self.assertIn('vitest run', front['scripts']['test'])

    def test_docs_and_adrs(self):
        for path in ('infrastructure/README.md', 'backend/README.md', 'frontend/README.md', 'tests/e2e/README.md'):
            read(path)
        self.assertIn('Status: **Accepted**', read('docs/blueprint/decisions/ADR-041-test-tooling.md'))
