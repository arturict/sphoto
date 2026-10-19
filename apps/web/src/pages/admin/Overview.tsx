import type { InstanceHealth } from '@sphoto/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Card, ErrorAlert, Loading, StatusBadge } from '../../components/ui';
import { useAdminSessionKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { formatBytes, formatChf, formatDateTime, formatInteger } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import { adminKeys } from './keys';

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card as="article" aria-label={label}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
    </Card>
  );
}

function Health({ instance }: { instance: InstanceHealth }) {
  if (instance.ok === null) return <StatusBadge tone="neutral">Unbekannt</StatusBadge>;
  return instance.ok ? <StatusBadge tone="ok">In Ordnung</StatusBadge> : <StatusBadge tone="danger">Gestört</StatusBadge>;
}

const instanceLabel = { free: 'Free-Server', paid: 'Paid-Server' } as const;
const dash = (value: number | null, format: (n: number) => string) => (value === null ? '–' : format(value));

export function Overview() {
  usePageTitle('Übersicht');
  const adminKey = useAdminSessionKey();
  const overview = useQuery({ queryKey: adminKeys.overview, queryFn: () => adminApi.overview(adminKey) });

  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorAlert>{errorText(overview.error)}</ErrorAlert>;
  const { data } = overview;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Kennzahlen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Benutzer" value={formatInteger(data.users.total)} detail={`Free ${data.users.free}, Basic ${data.users.basic}, Pro ${data.users.pro}`} />
          <Stat label="Monatlicher Umsatz (MRR)" value={formatChf(data.mrrChf)} />
          <Stat label="Löschungen vorgemerkt" value={formatInteger(data.pendingDeletions)} />
          <Stat label="Kündigungen vorgemerkt" value={formatInteger(data.pendingCancellations)} />
          <Stat label="Fehlgeschlagene Aufträge" value={formatInteger(data.failedJobs)} />
        </div>
        {data.failedJobs > 0 ? (
          <p className="mt-3 text-sm">
            <Link to="/admin/jobs" className="font-medium text-accent underline underline-offset-2">
              Aufträge ansehen
            </Link>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="instances-title">
        <h2 id="instances-title" className="text-xl font-semibold">
          Foto-Server
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-176 text-left text-sm" aria-label="Zustand der Immich-Instanzen">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Instanz</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Latenz</th>
                <th scope="col" className="px-4 py-3 font-medium">Letzte Prüfung</th>
                <th scope="col" className="px-4 py-3 font-medium">Benutzer</th>
                <th scope="col" className="px-4 py-3 font-medium">Belegung</th>
                <th scope="col" className="px-4 py-3 font-medium">Fotos</th>
                <th scope="col" className="px-4 py-3 font-medium">Videos</th>
              </tr>
            </thead>
            <tbody>
              {data.instances.map((instance) => (
                <tr key={instance.instance} className="border-b border-line last:border-0 align-top">
                  <th scope="row" className="px-4 py-3 font-medium">
                    {instanceLabel[instance.instance]}
                    <span className="block break-all text-xs font-normal text-muted">{instance.url}</span>
                  </th>
                  <td className="px-4 py-3">
                    <Health instance={instance} />
                    {instance.error ? <span className="mt-1 block text-xs text-danger-text">{instance.error}</span> : null}
                  </td>
                  <td className="px-4 py-3">{dash(instance.latencyMs, (ms) => `${formatInteger(ms)} ms`)}</td>
                  <td className="px-4 py-3">{instance.checkedAt ? formatDateTime(instance.checkedAt) : '–'}</td>
                  <td className="px-4 py-3">{formatInteger(instance.users)}</td>
                  <td className="px-4 py-3">{dash(instance.usageBytes, formatBytes)}</td>
                  <td className="px-4 py-3">{dash(instance.photos, formatInteger)}</td>
                  <td className="px-4 py-3">{dash(instance.videos, formatInteger)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
