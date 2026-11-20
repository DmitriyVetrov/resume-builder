// P13 step 7: real-stack data for the restore drill. usage, from the repository root: node qa-drill.mjs setup|purge|check <stateFile>
// Talks to the API as proxy.mjs does: cookies, CSRF header, keyed writes. Prints IDs only.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Straight to the API with the headers proxy.mjs adds; the connection comes from the trusted 127.0.0.1. (fetch refuses port 4190.)
const BASE = 'http://127.0.0.1:5090/api/v1';
const FORWARDED = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '127.0.0.1' };
const [mode, stateFile] = process.argv.slice(2);
const jar = new Map();

async function call(method, path, { body, headers = {}, form } = {}) {
  const h = { ...FORWARDED, ...headers, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
  const xsrf = [...jar].find(([k]) => k.endsWith('XSRF-TOKEN'));
  if (method !== 'GET' && xsrf) h['X-XSRF-TOKEN'] = xsrf[1];
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const response = await fetch(BASE + path, { method, headers: h, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  const text = await response.text();
  return { status: response.status, etag: response.headers.get('etag'), json: text ? JSON.parse(text) : null };
}

const expect = (result, status, what) => { if (result.status !== status) { console.error(what, result.status, JSON.stringify(result.json)); process.exit(1); } return result; };
const keyed = etag => ({ 'If-Match': etag, 'Idempotency-Key': randomUUID() });

async function login(email, password) {
  expect(await call('GET', '/session'), 200, 'session');
  expect(await call('POST', '/auth/login', { body: { email, password } }), 200, 'login');
}

if (mode === 'setup') {
  const email = `qa-drill-${Date.now()}@example.invalid`;
  const password = 'correct-horse-battery-9';
  expect(await call('GET', '/session'), 200, 'session');
  expect(await call('POST', '/auth/sign-up', { body: { email, password } }), 202, 'sign-up');
  await login(email, password);
  const document = JSON.parse(readFileSync('tests/fixtures/resumes/one-page.json', 'utf8'));
  const ids = [];
  for (const title of ['Drill purged', 'Drill kept']) {
    const created = expect(await call('POST', '/resumes', { body: { source: 'document', document: { ...document, title }, copyPhotoFromResumeId: null }, headers: { 'Idempotency-Key': randomUUID() } }), 201, 'create');
    const form = new FormData();
    form.append('file', new Blob([readFileSync('tests/fixtures/resumes/photo-600.jpg')], { type: 'image/jpeg' }), 'photo.jpg');
    expect(await call('POST', `/resumes/${created.json.id}/photo`, { form, headers: keyed(`"${created.json.version}"`) }), 200, 'photo');
    ids.push(created.json.id);
  }
  writeFileSync(stateFile, JSON.stringify({ email, password, purged: ids[0], kept: ids[1] }));
  console.log(`setup purged=${ids[0]} kept=${ids[1]}`);
} else if (mode === 'purge') {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  await login(state.email, state.password);
  const current = expect(await call('GET', `/resumes/${state.purged}`), 200, 'get');
  const trashed = expect(await call('DELETE', `/resumes/${state.purged}`, { headers: keyed(current.etag) }), 200, 'trash');
  const etag = trashed.etag ?? `"${trashed.json.version}"`;
  const purged = await call('POST', `/resumes/${state.purged}/purge`, { headers: keyed(etag) });
  if (purged.status !== 204 && purged.status !== 200) expect(purged, 204, 'purge');
  console.log(`purge ${state.purged} status=${purged.status}; get after=${(await call('GET', `/resumes/${state.purged}`)).status}`);
} else if (mode === 'check') {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  await login(state.email, state.password);
  const purged = await call('GET', `/resumes/${state.purged}`);
  const kept = await call('GET', `/resumes/${state.kept}`);
  const keptPhoto = kept.json?.photo ? await fetch(`${BASE}/resumes/${state.kept}/photo/master`, { headers: { ...FORWARDED, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } }) : null;
  console.log(`check purged=${purged.status} kept=${kept.status} keptPhotoMaster=${keptPhoto?.status ?? 'none'}`);
} else {
  console.error('usage: setup|purge|check <stateFile>');
  process.exit(2);
}
