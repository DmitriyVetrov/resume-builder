"""CI script behavior, including failure propagation."""
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from infra_helpers import ROOT, read, run


class Scripts(unittest.TestCase):
    def make_integration_fixture(self, root, suite_text, main='local'):
        ci = root / 'scripts/ci'
        ci.mkdir(parents=True)
        for name in ('integration.sh', 'common.sh'):
            shutil.copy2(ROOT / 'scripts/ci' / name, ci / name)
        suite = root / 'docs/phases/P02/tests/suite.cmd'
        suite.parent.mkdir(parents=True)
        suite.write_text(suite_text)
        self.assertEqual(run('git', 'init', '-q', '-b', 'fixture', cwd=root).returncode, 0)
        self.assertEqual(run('git', 'add', '.', cwd=root).returncode, 0)
        committed = run('git', '-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'fixture', cwd=root)
        self.assertEqual(committed.returncode, 0, committed.stderr)
        if main == 'local':
            self.assertEqual(run('git', 'branch', 'main', cwd=root).returncode, 0)
        elif main == 'remote':
            self.assertEqual(run('git', 'update-ref', 'refs/remotes/origin/main', 'HEAD', cwd=root).returncode, 0)
        return ci / 'integration.sh'

    def test_integration_uses_remote_main_without_fetch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = self.make_integration_fixture(root, 'exit 17\n', main='remote')
            result = run('bash', str(script), cwd=root)
            self.assertEqual(result.returncode, 17, result.stdout + result.stderr)
            self.assertEqual(run('git', 'show-ref', '--verify', '--quiet', 'refs/heads/main', cwd=root).returncode, 0)

    def test_integration_requires_main_reference(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = self.make_integration_fixture(root, 'touch must-not-run\n', main='none')
            result = run('bash', str(script), cwd=root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('main reference required', result.stdout + result.stderr)
            self.assertFalse((root / 'must-not-run').exists())

    def test_integration_preserves_path_and_detaches_suite_stdin(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            marker = root / 'last-ran'
            suite = f'test "${{PATH%%:*}}" = "{tmp}"\nread -r swallowed || true\ntouch {marker}\nexit 17\n'
            script = self.make_integration_fixture(root, suite)
            result = run('bash', str(script), cwd=root, env={**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH']})
            self.assertEqual(result.returncode, 17, result.stdout + result.stderr)
            self.assertTrue(marker.exists(), 'suite command consumed following lines from stdin')

    def test_integration_does_not_consume_suite_lines_as_stdin(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            marker = root / 'last-ran'
            script = self.make_integration_fixture(root, f'read -r swallowed || true\ntouch {marker}\nexit 17\n')
            result = run('bash', str(script), cwd=root)
            self.assertEqual(result.returncode, 17, result.stdout + result.stderr)
            self.assertTrue(marker.exists(), 'suite command consumed following lines from stdin')

    def test_locked_restore_rejects_mismatched_central_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp, 'backend')
            shutil.copytree(ROOT / 'backend', target, ignore=shutil.ignore_patterns('bin', 'obj'))
            props = target / 'Directory.Packages.props'
            original = props.read_text()
            self.assertIn('Version="3.2.1"', original)
            props.write_text(original.replace('Version="3.2.1"', 'Version="3.2.0"', 1))
            result = run('dotnet', 'restore', 'ResumeBuilder.slnx', '--locked-mode', cwd=target, timeout=120)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertRegex(result.stdout + result.stderr, r'(?i)lock|NU1004')

    def test_security_scans_all_backend_lockfiles(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ci = root / 'scripts/ci'
            ci.mkdir(parents=True)
            for name in ('security.sh', 'common.sh'):
                shutil.copy2(ROOT / 'scripts/ci' / name, ci / name)
            (root / 'infrastructure').mkdir()
            (root / 'infrastructure/images.lock').write_text(read('infrastructure/images.lock'))
            for name in ('one', 'two'):
                lock = root / 'backend' / name / 'packages.lock.json'
                lock.parent.mkdir(parents=True)
                lock.write_text('{}')
            bin_dir = root / 'bin'
            bin_dir.mkdir()
            for name, body in {'python3': 'exit 0', 'git': 'echo "$TEST_ROOT"', 'docker': 'printf "%s\\n" "$*" >> "$TEST_LOG"'}.items():
                stub = bin_dir / name
                stub.write_text('#!/bin/sh\n' + body + '\n')
                stub.chmod(0o755)
            log = root / 'docker.log'
            env = {**os.environ, 'PATH': str(bin_dir) + os.pathsep + os.environ['PATH'], 'TEST_ROOT': str(root), 'TEST_LOG': str(log)}
            result = run('bash', str(ci / 'security.sh'), cwd=root, env=env)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            calls = log.read_text()
            for name in ('one', 'two'):
                self.assertIn(f'--lockfile=/work/backend/{name}/packages.lock.json', calls)
            for lock in (root / 'backend').rglob('packages.lock.json'):
                self.assertIn(f'--lockfile=/work/{lock.relative_to(root)}', calls)
            for lock in (root / 'backend').rglob('packages.lock.json'):
                lock.unlink()
            log.unlink()
            result = run('bash', str(ci / 'security.sh'), cwd=root, env=env)
            self.assertNotEqual(result.returncode, 0, 'empty backend lockfile list passed')

    def test_security_source_enumerates_backend_lockfiles(self):
        source = read('scripts/ci/security.sh')
        self.assertRegex(source, r'find[^\n]*backend')
        self.assertIn('packages.lock.json', source)

    def test_phase_suite_reports_job_failure_and_runs_infrastructure_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'suite.cmd').write_text(read('docs/phases/P03/tests/suite.cmd'))
            for name, body in (('bash', '#!/bin/sh\necho local >> "$TEST_LOG"\nexit 7\n'),
                               ('python3', '#!/bin/sh\necho infrastructure >> "$TEST_LOG"\nexit 0\n')):
                stub = root / name
                stub.write_text(body)
                stub.chmod(0o755)
            log = root / 'calls'
            result = run('/bin/bash', str(root / 'suite.cmd'), cwd=root,
                         env={**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH'], 'TEST_LOG': str(log)})
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(log.read_text().splitlines(), ['local', 'infrastructure'])

    def test_local_runner_exists_and_rejects_unknown_job(self):
        read('scripts/ci/local.sh')
        result = run('bash', str(ROOT / 'scripts/ci/local.sh'), 'nosuchjob', cwd='/')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('nosuchjob', result.stdout + result.stderr)

    def test_local_runner_is_cwd_independent_and_reports_each_job(self):
        script = read('scripts/ci/local.sh')
        with tempfile.TemporaryDirectory() as tmp:
            ci = Path(tmp, 'scripts', 'ci')
            ci.mkdir(parents=True)
            (ci / 'local.sh').write_text(script)
            (ci / 'common.sh').write_text(read('scripts/ci/common.sh'))
            (ci / 'preflight.sh').write_text('#!/bin/bash\necho preflight >> "$TEST_LOG"\n')
            (ci / 'preflight.sh').chmod(0o755)
            for name in ('security', 'backend', 'frontend', 'e2e', 'integration'):
                (ci / f'{name}.sh').write_text(f'#!/bin/bash\necho {name} >> "$TEST_LOG"\n' + ('exit 3\n' if name == 'security' else 'exit 0\n'))
                (ci / f'{name}.sh').chmod(0o755)
            log = Path(tmp, 'calls')
            env = dict(os.environ, TEST_LOG=str(log))
            result = run('bash', str(ci / 'local.sh'), cwd='/', env=env)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(log.read_text().splitlines(), ['preflight', 'security', 'backend', 'frontend', 'e2e', 'integration'])
            output = result.stdout + result.stderr
            for name in ('security', 'backend', 'frontend', 'e2e', 'integration'):
                self.assertIn(name, output)
            self.assertIn('FAIL', output)
            result = run('bash', str(ci / 'local.sh'), 'frontend', cwd='/', env=env)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(log.read_text().splitlines()[-2:], ['preflight', 'frontend'])

    def test_preflight_fails_when_dotnet_missing(self):
        read('scripts/ci/preflight.sh')
        with tempfile.TemporaryDirectory() as tmp:
            bin_dir = Path(tmp)
            for directory in os.environ['PATH'].split(os.pathsep):
                for item in Path(directory).iterdir() if Path(directory).is_dir() else ():
                    if item.name != 'dotnet' and item.is_file() and os.access(item, os.X_OK) and not (bin_dir / item.name).exists():
                        (bin_dir / item.name).symlink_to(item)
            result = run('bash', 'scripts/ci/preflight.sh', env={**os.environ, 'PATH': str(bin_dir), 'DOTNET_ROOT': ''})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('dotnet', result.stdout + result.stderr)

    def test_preflight_reference_machine(self):
        read('scripts/ci/preflight.sh')
        result = run('bash', 'scripts/ci/preflight.sh')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_preflight_rejects_old_node(self):
        read('scripts/ci/preflight.sh')
        with tempfile.TemporaryDirectory() as tmp:
            node = Path(tmp, 'node')
            node.write_text('#!/bin/sh\necho v22.11.0\n')
            node.chmod(0o755)
            result = run('bash', 'scripts/ci/preflight.sh', env={**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH']})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('node', (result.stdout + result.stderr).lower())

    def test_job_scripts_propagate_failure(self):
        for job, tool, failing in (('backend', 'dotnet', 'test'), ('frontend', 'npm', 'test'), ('e2e', 'docker', 'run')):
            with self.subTest(job=job), tempfile.TemporaryDirectory() as tmp:
                read(f'scripts/ci/{job}.sh')
                stub = Path(tmp, tool)
                stub.write_text(f'#!/bin/bash\n[[ " $* " == *" {failing} "* ]] && exit 19\nexit 0\n')
                stub.chmod(0o755)
                env = {**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH']}
                result = run('bash', f'scripts/ci/{job}.sh', env=env, timeout=60)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_integration_references_contract_suite_and_cleans_up(self):
        script = read('scripts/ci/integration.sh')
        self.assertIn('docs/phases/P02/tests/suite.cmd', script)
        self.assertIn('trap', script)
        self.assertIn('down -v', script)
        self.assertIn('resumiser-ci', script)

    def test_integration_stops_at_failed_contract_line(self):
        read('scripts/ci/integration.sh')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ci = root / 'scripts/ci'
            ci.mkdir(parents=True)
            for source in (ROOT / 'scripts/ci').rglob('*'):
                if source.is_file():
                    target = ci / source.relative_to(ROOT / 'scripts/ci')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
            suite = root / 'docs/phases/P02/tests/suite.cmd'
            suite.parent.mkdir(parents=True)
            marker = root / 'third-line-ran'
            suite.write_text(f'true\nfalse\ntouch {marker}\n')
            self.assertEqual(run('git', 'init', '-q', '-b', 'main', cwd=root).returncode, 0)
            self.assertEqual(run('git', 'add', '.', cwd=root).returncode, 0)
            committed = run('git', '-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'fixture', cwd=root)
            self.assertEqual(committed.returncode, 0, committed.stderr)
            docker_log = root / 'docker-calls'
            stub = root / 'docker'
            stub.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"\nexit 0\n')
            stub.chmod(0o755)
            result = run('bash', str(ci / 'integration.sh'), cwd=root,
                         env={**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH'], 'TEST_DOCKER_LOG': str(docker_log)})
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(marker.exists(), 'contract suite continued after a failed line')
            if docker_log.exists():
                self.assertNotIn('up', docker_log.read_text())

    def test_no_compose_residue(self):
        for kind, args in (('container', ('ps', '-a')), ('volume', ('volume', 'ls')), ('network', ('network', 'ls'))):
            with self.subTest(kind=kind):
                result = run('docker', *args, '--filter', 'label=com.docker.compose.project=resumiser-ci', '--format', '{{.ID}}')
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), '')
