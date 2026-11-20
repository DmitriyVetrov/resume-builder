"""Shared, dependency-free P03 test helpers."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    file = ROOT / path
    if not file.exists():
        raise AssertionError(f"ARTIFACT_MISSING {path}")
    return file.read_text()


def run(*args, cwd=ROOT, env=None, timeout=180):
    try:
        return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as exc:
        raise AssertionError(f"ENV_MISSING {args[0]}") from exc


def images_lock():
    entries = {}
    for line in read('infrastructure/images.lock').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        assert re.fullmatch(r'[A-Z_]+=[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}', line), line
        name, image = line.split('=', 1)
        assert name not in entries, f'duplicate image {name}'
        entries[name] = image
    return entries


def image_for(repo):
    matches = [v for v in images_lock().values() if v.split(':')[0].split('/')[-1] == repo]
    assert len(matches) == 1, f'images.lock needs one {repo}, found {len(matches)}'
    return matches[0]


def compose_config(*, profile=None):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.env') as env_file:
        env = {k: v for k, v in os.environ.items() if not k.startswith('RESUMISER_')}
        args = ['docker', 'compose', '--env-file', env_file.name]
        if profile:
            args.extend(['--profile', profile])
        result = run(*args, 'config', '--format', 'json', env=env)
        assert result.returncode == 0, f'Compose config failed: {result.stderr}'
        assert 'variable is not set' not in result.stderr
        return json.loads(result.stdout)


def violations_compose(config, lock):
    errors = []
    services = config.get('services', {})
    if set(services) != {'mongo', 'azurite', 'mailpit'}:
        errors.append('services')
    if len(config.get('networks', {})) != 1:
        errors.append('networks')
    for name, service in services.items():
        image = service.get('image', '')
        if not re.fullmatch(r'[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}', image):
            errors.append('digest')
        if image not in lock.values():
            errors.append('image-lock')
        hc = service.get('healthcheck', {})
        if not hc.get('test') or hc.get('test') == ['NONE'] or hc.get('disable'):
            errors.append('healthcheck')
        if service.get('privileged') or service.get('network_mode') == 'host' or service.get('pid') == 'host':
            errors.append('privilege')
        if len(service.get('networks', {})) != 1:
            errors.append('service-network')
        for port in service.get('ports', []):
            if port.get('host_ip') != '127.0.0.1':
                errors.append('host-ip')
        for mount in service.get('volumes', []):
            if 'docker.sock' in mount.get('source', ''):
                errors.append('docker-socket')
            if name in ('mongo', 'azurite') and (mount.get('type') != 'volume' or mount.get('source') not in config.get('volumes', {})):
                errors.append('named-volume')
        for key, value in service.get('environment', {}).items():
            if re.search(r'pass|secret|token|api_?key|account_?key|credential', key, re.I) and str(value) not in ('change-me', '<set-in-key-vault>'):
                errors.append('credential-env')
            if re.search(r'AccountKey=|password=|://[^/\s:]+:[^/@\s]+@', str(value), re.I):
                errors.append('credential-value')
    return errors


def workflow_jobs(text):
    jobs = {}
    current = None
    in_jobs = False
    for line in text.splitlines():
        if line == 'jobs:':
            in_jobs = True
            continue
        if in_jobs and re.match(r'^\S', line):
            break
        match = re.match(r'^  ([a-z][a-z0-9-]*):\s*$', line)
        if in_jobs and match:
            current = match.group(1)
            jobs[current] = []
        elif current:
            jobs[current].append(line)
    return {key: '\n'.join(lines) for key, lines in jobs.items()}
