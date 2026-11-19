import { describe, expect, it } from 'vitest';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import { INTERRUPTED_AFTER_MS, releaseInterruptedAlerts } from './recovery';

const now = new Date('2026-09-25T10:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const alert = (id: string) => ({
  id,
  userId: 'u1',
  instrumentId: 'i1',
  type: 'price_above' as const,
  threshold: 100,
  channels: ['discord'],
  status: 'active' as 'active' | 'triggered',
});

describe('releaseInterruptedAlerts', () => {
  it('alerte prise sans événement (arrêt pendant l’envoi) : remise en active', async () => {
    const store = new MemoryStore();
    store.alerts = [alert('a1')];
    await store.claimAlert('a1', minutesAgo(10));
    expect(await releaseInterruptedAlerts({ store, log: silentLogger, now })).toBe(1);
    expect(store.alerts[0]!.status).toBe('active');
  });

  it('alerte envoyée et consignée : reste déclenchée', async () => {
    const store = new MemoryStore();
    store.alerts = [alert('a1')];
    await store.claimAlert('a1', minutesAgo(10));
    await store.recordAlertEvent({ alertId: 'a1', userId: 'u1', value: 101, delivery: {} });
    expect(await releaseInterruptedAlerts({ store, log: silentLogger, now })).toBe(0);
    expect(store.alerts[0]!.status).toBe('triggered');
  });

  it('événement d’un déclenchement précédent seulement : interrompue', async () => {
    const store = new MemoryStore();
    store.alerts = [alert('a1')];
    await store.claimAlert('a1', minutesAgo(60));
    await store.recordAlertEvent({ alertId: 'a1', userId: 'u1', value: 101, delivery: {} });
    await store.rearmAlert('a1');
    await store.claimAlert('a1', minutesAgo(10));
    expect(await releaseInterruptedAlerts({ store, log: silentLogger, now })).toBe(1);
  });

  it('prise toute récente : peut-être en cours d’envoi ailleurs, on n’y touche pas', async () => {
    const store = new MemoryStore();
    store.alerts = [alert('a1')];
    await store.claimAlert('a1', new Date(now.getTime() - INTERRUPTED_AFTER_MS / 2));
    expect(await releaseInterruptedAlerts({ store, log: silentLogger, now })).toBe(0);
    expect(store.alerts[0]!.status).toBe('triggered');
  });
});
