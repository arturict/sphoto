import type { AdminUser } from '@sphoto/shared';
import { formatDate } from './format';

export type UserStatusKind = 'active' | 'migrating' | 'cancelled' | 'deletion' | 'deleted';

export interface DerivedUserStatus {
  kind: UserStatusKind;
  label: string;
}

// A scheduled deletion outranks a running migration, which outranks a cancelled subscription.
export function deriveUserStatus(user: Pick<AdminUser, 'status' | 'deletionDueAt' | 'cancellationDueAt'>): DerivedUserStatus {
  if (user.status === 'deleted') return { kind: 'deleted', label: 'Gelöscht' };
  if (user.deletionDueAt) return { kind: 'deletion', label: `Löschung am ${formatDate(user.deletionDueAt)}` };
  if (user.status === 'migrating') return { kind: 'migrating', label: 'Umzug läuft' };
  if (user.cancellationDueAt) return { kind: 'cancelled', label: `Gekündigt, Wechsel am ${formatDate(user.cancellationDueAt)}` };
  return { kind: 'active', label: 'Aktiv' };
}
