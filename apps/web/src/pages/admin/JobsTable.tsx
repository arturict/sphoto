import type { JobInfo } from '@sphoto/shared';
import { StatusBadge } from '../../components/ui';
import { formatDateTime } from '../../lib/format';

type JobRow = JobInfo & { userEmail: string | null };

const kindLabel = { upgrade: 'Upgrade', downgrade: 'Wechsel auf Free', export: 'Export' } as const;
const statusLabel = { queued: 'Wartet', running: 'Läuft', succeeded: 'Erledigt', failed: 'Fehlgeschlagen' } as const;
const statusTone = { queued: 'neutral', running: 'info', succeeded: 'ok', failed: 'danger' } as const;

export function JobsTable({ jobs, showUser }: { jobs: JobRow[]; showUser: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-176 text-left text-sm" aria-label="Aufträge">
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Art</th>
            {showUser ? <th scope="col" className="px-4 py-3 font-medium">Benutzer</th> : null}
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Fortschritt</th>
            <th scope="col" className="px-4 py-3 font-medium">Fehler</th>
            <th scope="col" className="px-4 py-3 font-medium">Erstellt</th>
            <th scope="col" className="px-4 py-3 font-medium">Beendet</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-line align-top last:border-0">
              <td className="px-4 py-3 font-medium">{kindLabel[job.kind]}</td>
              {showUser ? <td className="px-4 py-3 break-all">{job.userEmail ?? '–'}</td> : null}
              <td className="px-4 py-3">
                <StatusBadge tone={statusTone[job.status]}>{statusLabel[job.status]}</StatusBadge>
              </td>
              <td className="px-4 py-3">{job.total > 0 ? `${job.done} von ${job.total}` : '–'}</td>
              <td className="px-4 py-3 text-danger-text">{job.error ?? ''}</td>
              <td className="px-4 py-3">{formatDateTime(job.createdAt)}</td>
              <td className="px-4 py-3">{job.finishedAt ? formatDateTime(job.finishedAt) : '–'}</td>
            </tr>
          ))}
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={showUser ? 7 : 6} className="px-4 py-6 text-center text-muted">
                Keine Aufträge vorhanden.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
