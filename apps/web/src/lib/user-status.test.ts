import { describe, expect, it } from 'vitest';
import { deriveUserStatus } from './user-status';

const base = { status: 'active', deletionDueAt: null, cancellationDueAt: null } as const;

describe('deriveUserStatus', () => {
  it('is active without pending changes', () => {
    expect(deriveUserStatus(base)).toEqual({ kind: 'active', label: 'Aktiv' });
  });

  it('reports a cancelled subscription with its date', () => {
    expect(deriveUserStatus({ ...base, cancellationDueAt: '2026-11-02T09:00:00.000Z' })).toEqual({
      kind: 'cancelled',
      label: 'Gekündigt, Wechsel am 02.11.2026',
    });
  });

  it('reports a running migration', () => {
    expect(deriveUserStatus({ ...base, status: 'migrating' }).kind).toBe('migrating');
  });

  it('lets a scheduled deletion outrank migration and cancellation', () => {
    const status = deriveUserStatus({ status: 'migrating', deletionDueAt: '2026-11-05T09:00:00.000Z', cancellationDueAt: '2026-11-02T09:00:00.000Z' });
    expect(status).toEqual({ kind: 'deletion', label: 'Löschung am 05.11.2026' });
  });

  it('lets a deleted account outrank everything', () => {
    expect(deriveUserStatus({ status: 'deleted', deletionDueAt: '2026-11-05T09:00:00.000Z', cancellationDueAt: null }).kind).toBe('deleted');
  });
});
