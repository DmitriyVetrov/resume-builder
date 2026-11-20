// T-SP-02 against the real API: failed logins for one account, each from a different client address. Prints statuses only.
const BASE = 'http://127.0.0.1:5090/api/v1';
const jar = new Map();
async function call(method, path, body, ip) {
  const headers = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': ip, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
  const xsrf = [...jar].find(([k]) => k.endsWith('XSRF-TOKEN'));
  if (method !== 'GET' && xsrf) headers['X-XSRF-TOKEN'] = xsrf[1];
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(BASE + path, { method, headers, body: body && JSON.stringify(body) });
  for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
  const text = await response.text();
  return { status: response.status, retryAfter: response.headers.get('retry-after'), code: text ? JSON.parse(text).code ?? '' : '' };
}
const email = `qa-stuffing-${Date.now()}@example.invalid`;
await call('GET', '/session', null, '198.51.100.1');
console.log('sign-up', (await call('POST', '/auth/sign-up', { email, password: 'correct-horse-battery-9' }, '198.51.100.1')).status);
for (let attempt = 1; attempt <= 7; attempt++) {
  const ip = `203.0.113.${attempt}`;
  const result = await call('POST', '/auth/login', { email, password: `wrong-guess-${attempt}` }, ip);
  console.log(`attempt ${attempt} from ${ip}: ${result.status} ${result.code} retry-after=${result.retryAfter ?? '-'}`);
}
const right = await call('POST', '/auth/login', { email, password: 'correct-horse-battery-9' }, '203.0.113.99');
console.log(`correct password during back-off from 203.0.113.99: ${right.status} ${right.code} retry-after=${right.retryAfter ?? '-'}`);
