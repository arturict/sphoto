import { StatusBadge } from '../../components/ui';
import { deriveUserStatus, type UserStatusKind } from '../../lib/user-status';
import type { AdminUser } from '@sphoto/shared';

const tones = { active: 'ok', migrating: 'info', cancelled: 'warn', deletion: 'danger', deleted: 'neutral' } as const satisfies Record<UserStatusKind, string>;

export function UserStatusBadge({ user }: { user: Pick<AdminUser, 'status' | 'deletionDueAt' | 'cancellationDueAt'> }) {
  const status = deriveUserStatus(user);
  return <StatusBadge tone={tones[status.kind]}>{status.label}</StatusBadge>;
}
