import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ErrorAlert, Loading, TextField } from '../../components/ui';
import { useAdminSessionKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { formatBytes, formatDate, formatGb } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import { adminKeys } from './keys';
import { UserStatusBadge } from './StatusBadges';

const instanceLabel = { free: 'Free', paid: 'Paid' } as const;
const tierLabel = { free: 'Free', basic: 'Basic', pro: 'Pro' } as const;

export function Users() {
  usePageTitle('Benutzer');
  const adminKey = useAdminSessionKey();
  const [search, setSearch] = useState('');
  const users = useQuery({ queryKey: adminKeys.users, queryFn: () => adminApi.users(adminKey) });

  if (users.isPending) return <Loading />;
  if (users.isError) return <ErrorAlert>{errorText(users.error)}</ErrorAlert>;

  const needle = search.trim().toLowerCase();
  const visible = needle ? users.data.filter((user) => user.email.toLowerCase().includes(needle)) : users.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-md">
        <TextField label="Nach E-Mail-Adresse suchen" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <p role="status" className="text-sm text-muted">
        {visible.length} von {users.data.length} Benutzern
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-208 text-left text-sm" aria-label="Benutzer">
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">E-Mail-Adresse</th>
              <th scope="col" className="px-4 py-3 font-medium">Plan</th>
              <th scope="col" className="px-4 py-3 font-medium">Instanz</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Belegt / Kontingent</th>
              <th scope="col" className="px-4 py-3 font-medium">Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 font-medium break-all">
                  <Link to="/admin/users/$id" params={{ id: user.id }} className="text-accent underline underline-offset-2">
                    {user.email}
                  </Link>
                </th>
                <td className="px-4 py-3">{tierLabel[user.tier]}</td>
                <td className="px-4 py-3">{instanceLabel[user.instance]}</td>
                <td className="px-4 py-3">
                  <UserStatusBadge user={user} />
                </td>
                <td className="px-4 py-3">{user.usedBytes === null ? '–' : formatBytes(user.usedBytes)} / {formatGb(user.quotaGb)}</td>
                <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Keine Benutzer gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
