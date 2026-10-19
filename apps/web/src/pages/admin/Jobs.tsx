import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorAlert, Loading, StatusBadge } from '../../components/ui';
import { useAdminSessionKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { usePageTitle } from '../../lib/use-page-title';
import { JobsTable } from './JobsTable';
import { adminKeys } from './keys';

const taskLabels: Record<string, string> = {
  deletions: 'Löschungen',
  cancellations: 'Kündigungen',
  'cancellation-reminders': 'Kündigungs-Erinnerungen',
  usage: 'Speichernutzung erfassen',
  health: 'Gesundheitsprüfung',
  cleanup: 'Aufräumen',
};

export function Jobs() {
  usePageTitle('Aufträge');
  const adminKey = useAdminSessionKey();
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: adminKeys.jobs, queryFn: () => adminApi.jobs(adminKey) });
  const maintenance = useMutation({
    mutationKey: ['admin', 'maintenance'],
    mutationFn: () => adminApi.runMaintenance(adminKey),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="maintenance-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="maintenance-title" className="text-lg font-semibold">
          Wartung
        </h2>
        <p className="mt-1 text-sm text-muted">Führt die Wartungsaufgaben sofort aus: Löschungen, Kündigungen, Erinnerungen, Nutzungserfassung, Gesundheitsprüfung und Aufräumen.</p>
        <Button className="mt-4" pending={maintenance.isPending} onClick={() => maintenance.mutate()}>
          Wartung jetzt ausführen
        </Button>
        {maintenance.isError ? (
          <div className="mt-4">
            <ErrorAlert>{errorText(maintenance.error)}</ErrorAlert>
          </div>
        ) : null}
        {maintenance.isSuccess ? (
          <div className="mt-4" role="status">
            <h3 className="font-semibold">Ergebnis</h3>
            {maintenance.data.tasks.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Es gab keine Aufgaben.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {maintenance.data.tasks.map((task) => (
                  <li key={task.task} className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={task.ok ? 'ok' : 'danger'}>{task.ok ? 'OK' : 'Fehler'}</StatusBadge>
                    <span className="font-medium">{taskLabels[task.task] ?? task.task}</span>
                    <span className="text-muted">{task.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="jobs-title">
        <h2 id="jobs-title" className="text-lg font-semibold">
          Letzte Aufträge
        </h2>
        <div className="mt-3">
          {jobs.isPending ? <Loading /> : null}
          {jobs.isError ? <ErrorAlert>{errorText(jobs.error)}</ErrorAlert> : null}
          {jobs.isSuccess ? <JobsTable jobs={jobs.data} showUser /> : null}
        </div>
      </section>
    </div>
  );
}
