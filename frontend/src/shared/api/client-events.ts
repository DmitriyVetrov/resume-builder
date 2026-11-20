import { apiRequest, type AccountSchemas } from './client';

type ClientEvent = AccountSchemas['ClientEvent'];
const CODE = /^[a-z0-9_.-]{1,64}$/;
const sent = new Set<string>();

/**
 * NFR-13, DD-P11-14: enums, a constrained code, a UUID and a timestamp, so nothing here can carry content.
 * Once per kind per page load, and a failed report is nobody's problem: this must never disturb what it reports on.
 */
export function reportClientEvent(type: ClientEvent['type'], code: string, resumeId: string | null, engineVersion: string | null) {
  const safeCode = CODE.test(code) ? code : 'unknown';
  const key = `${type}:${safeCode}:${resumeId}`;
  if (sent.has(key)) return;
  sent.add(key);
  const event: ClientEvent = { type, code: safeCode, resumeId, engineVersion, occurredAt: new Date().toISOString() };
  void apiRequest('/client-events', { method: 'POST', body: JSON.stringify({ events: [event] }) }).catch(() => {});
}

/** For tests only. */
export const resetClientEvents = () => sent.clear();
