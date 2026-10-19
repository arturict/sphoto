import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { Button } from '../../components/ui';
import { AdminKeyContext, clearAdminKey, useAdminKey } from '../../lib/admin-key';
import { usePageTitle } from '../../lib/use-page-title';
import { AdminGate } from './AdminGate';

const tabs = [
  { to: '/admin', label: 'Übersicht', exact: true },
  { to: '/admin/users', label: 'Benutzer', exact: false },
  { to: '/admin/jobs', label: 'Aufträge', exact: false },
  { to: '/admin/stats', label: 'Statistik', exact: false },
] as const;

export function AdminLayout() {
  usePageTitle('Administration');
  const key = useAdminKey();
  const queryClient = useQueryClient();

  if (key === null) return <AdminGate />;

  function logout() {
    clearAdminKey();
    queryClient.removeQueries({ queryKey: ['admin'] });
  }

  return (
    <AdminKeyContext.Provider value={key}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Administration</h1>
          <Button variant="secondary" onClick={logout}>
            Abmelden
          </Button>
        </div>
        <nav aria-label="Administration" className="flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.exact }}
              className="-mb-px whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-fg data-[status=active]:border-accent data-[status=active]:font-semibold data-[status=active]:text-fg"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </AdminKeyContext.Provider>
  );
}
