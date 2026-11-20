"""Live smoke for the isolated P03 Compose project."""
import json
import smtplib
import time
import urllib.error
import urllib.request
import unittest
from infra_helpers import image_for, run

PROJECT = ('docker', 'compose', '-p', 'resumiser-ci')


def docker(*args):
    result = run(*PROJECT, *args)
    assert result.returncode == 0, result.stderr or result.stdout
    return result.stdout.strip()


def port(service, container_port):
    value = docker('port', service, str(container_port))
    assert value.startswith('127.0.0.1:'), value
    return int(value.rsplit(':', 1)[1])


def assert_replica_set(prefix):
    command = 'const s=rs.status(); if(s.set!=="rs0"||s.myState!==1||s.members.length!==1) quit(3); const r=db.getSiblingDB("resumiser_smoke").smoke.insertOne({fictional:true},{writeConcern:{w:"majority"}}); if(!r.acknowledged) quit(4);'
    result = run(*prefix, 'mongosh', '--quiet', '--eval', command)
    assert result.returncode == 0, result.stdout + result.stderr


class ComposeSmoke(unittest.TestCase):
    def test_services_healthy(self):
        expected = {'mongo', 'azurite', 'mailpit'}
        deadline = time.monotonic() + 30
        while True:
            output = docker('ps', '-a', '--format', 'json')
            self.assertTrue(output, 'ENV_MISSING compose project resumiser-ci is not up')
            rows = [json.loads(line) for line in output.splitlines()] if output.startswith('{') else json.loads(output)
            self.assertEqual({row['Service'] for row in rows}, expected)
            states = {}
            for row in rows:
                inspected = run('docker', 'inspect', '--format', '{{json .State}}', row['ID'])
                self.assertEqual(inspected.returncode, 0, inspected.stderr or inspected.stdout)
                state = json.loads(inspected.stdout)
                self.assertIn('Health', state, f"{row['Service']} has no healthcheck")
                states[row['Service']] = (state['Running'], state['Health']['Status'])
            if all(running and health == 'healthy' for running, health in states.values()):
                return
            if time.monotonic() >= deadline:
                self.fail(f'Compose services did not become running and healthy: {states}')
            time.sleep(.5)

    def test_replica_set_and_majority_write(self):
        assert_replica_set((*PROJECT, 'exec', '-T', 'mongo'))

    def test_mongo_without_replica_set_fails(self):
        import os
        name = f'resumiser-ci-norepl-{os.getpid()}'
        image = image_for('mongo')
        started = run('docker', 'run', '-d', '--name', name, image)
        self.assertEqual(started.returncode, 0, started.stdout + started.stderr)
        try:
            for _ in range(60):
                ping = run('docker', 'exec', name, 'mongosh', '--quiet', '--eval', 'db.runCommand({ping:1})')
                if ping.returncode == 0:
                    break
                time.sleep(.5)
            else:
                self.fail('standalone MongoDB did not become ready in 30 seconds')
            with self.assertRaises(AssertionError):
                assert_replica_set(('docker', 'exec', name))
        finally:
            run('docker', 'rm', '-f', name)

    def test_mailpit_delivery(self):
        smtp = port('mailpit', 1025)
        ui = port('mailpit', 8025)
        subject = f'resumiser-smoke-{time.time_ns()}'
        with smtplib.SMTP('127.0.0.1', smtp, timeout=5) as client:
            client.sendmail('smoke@example.test', ['inbox@example.test'], f'From: smoke@example.test\nTo: inbox@example.test\nSubject: {subject}\n\nfictional\n')
        for _ in range(20):
            with urllib.request.urlopen(f'http://127.0.0.1:{ui}/api/v1/messages', timeout=5) as response:
                if subject in response.read().decode():
                    return
            time.sleep(.5)
        self.fail('Mailpit did not show the smoke message')

    def test_azurite_responds(self):
        blob = port('azurite', 10000)
        try:
            response = urllib.request.urlopen(f'http://127.0.0.1:{blob}/devstoreaccount1?comp=list', timeout=5)
        except urllib.error.HTTPError as exc:
            response = exc
        self.assertIn('Azurite', response.headers.get('Server', ''))
