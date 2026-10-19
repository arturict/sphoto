import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ErrorAlert, Loading } from '../../components/ui';
import { useAdminSessionKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { formatBytes, formatInteger } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import { adminKeys } from './keys';
import { TimeSeriesChart } from './TimeSeriesChart';

const ranges = [30, 90] as const;

export function Stats() {
  usePageTitle('Statistik');
  const adminKey = useAdminSessionKey();
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const analytics = useQuery({ queryKey: adminKeys.analytics(days), queryFn: () => adminApi.analytics(adminKey, days) });

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Zeitraum" className="flex gap-2">
        {ranges.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={days === range}
            onClick={() => setDays(range)}
            className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${days === range ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface hover:bg-sunken'}`}
          >
            {range} Tage
          </button>
        ))}
      </div>

      {analytics.isPending ? <Loading /> : null}
      {analytics.isError ? <ErrorAlert>{errorText(analytics.error)}</ErrorAlert> : null}
      {analytics.isSuccess ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <TimeSeriesChart
              title="Neue Registrierungen pro Tag"
              valueHeader="Registrierungen"
              kind="bars"
              points={analytics.data.signups.map((entry) => ({ date: entry.date, value: entry.count }))}
              formatValue={formatInteger}
            />
            <TimeSeriesChart
              title="Belegter Speicher pro Tag"
              valueHeader="Speicher"
              kind="line"
              points={analytics.data.storage.map((entry) => ({ date: entry.date, value: entry.bytes }))}
              formatValue={formatBytes}
            />
          </div>

          <section aria-labelledby="top-users-title">
            <h2 id="top-users-title" className="text-lg font-semibold">
              Benutzer mit dem meisten Speicher
            </h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-96 text-left text-sm" aria-label="Top-Benutzer nach Speicher">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">E-Mail-Adresse</th>
                    <th scope="col" className="px-4 py-3 font-medium">Belegt</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.data.topUsers.map((user) => (
                    <tr key={user.userId} className="border-b border-line last:border-0">
                      <th scope="row" className="px-4 py-3 font-medium break-all">
                        <Link to="/admin/users/$id" params={{ id: user.userId }} className="text-accent underline underline-offset-2">
                          {user.email}
                        </Link>
                      </th>
                      <td className="px-4 py-3">{formatBytes(user.usageBytes)}</td>
                    </tr>
                  ))}
                  {analytics.data.topUsers.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted">
                        Noch keine Nutzungsdaten.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
