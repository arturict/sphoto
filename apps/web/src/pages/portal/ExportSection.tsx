import type { PortalMe } from '@sphoto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorAlert } from '../../components/ui';
import { errorText } from '../../lib/api';
import { exportPartUrl, portalApi, portalMeKey } from '../../lib/endpoints';
import { formatBytes, formatDate } from '../../lib/format';

export function ExportSection({ me }: { me: PortalMe }) {
  const queryClient = useQueryClient();
  const requestExport = useMutation({
    mutationFn: portalApi.requestExport,
    onSettled: () => queryClient.invalidateQueries({ queryKey: portalMeKey }),
  });

  const job = me.latestJob;
  const running = job?.kind === 'export' && (job.status === 'queued' || job.status === 'running');
  const disabled = running || me.nextExportAt !== null || me.migrating;

  let reason: string | null = null;
  if (running && job) reason = job.total > 0 ? `Dein Export wird erstellt: ${job.done} von ${job.total} Archiven fertig.` : 'Dein Export wird vorbereitet.';
  else if (me.nextExportAt) reason = `Der nächste Export ist ab dem ${formatDate(me.nextExportAt)} möglich.`;
  else if (me.migrating) reason = 'Während des Umzugs ist kein Export möglich.';

  const latest = me.latestExport;

  return (
    <section aria-labelledby="export-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="export-title" className="text-lg font-semibold">
        Foto-Export
      </h2>
      <p className="mt-1 text-sm text-muted">Lade deine ganze Bibliothek als ZIP-Archive herunter. Die Archive stehen eine begrenzte Zeit zum Download bereit.</p>

      <div className="mt-4">
        <Button disabled={disabled} pending={requestExport.isPending} aria-describedby={reason ? 'export-reason' : undefined} onClick={() => requestExport.mutate()}>
          Export anfordern
        </Button>
        {reason ? (
          <p id="export-reason" role="status" className="mt-2 text-sm text-muted">
            {reason}
          </p>
        ) : null}
        {running && job && job.total > 0 ? (
          <div
            role="progressbar"
            aria-label="Export-Fortschritt"
            aria-valuemin={0}
            aria-valuemax={job.total}
            aria-valuenow={job.done}
            aria-valuetext={`${job.done} von ${job.total} Archiven`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-sunken ring-1 ring-line"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((job.done / job.total) * 100)}%` }} />
          </div>
        ) : null}
      </div>

      {requestExport.isError ? (
        <div className="mt-3">
          <ErrorAlert>{errorText(requestExport.error)}</ErrorAlert>
        </div>
      ) : null}

      {latest ? (
        <div className="mt-6">
          <h3 className="font-semibold">Letzter Export</h3>
          <p className="mt-1 text-sm text-muted">
            Erstellt am {formatDate(latest.createdAt)}, verfügbar bis {formatDate(latest.expiresAt)}.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {latest.parts.map((part) => (
              <li key={part.index} className="rounded-lg border border-line p-3">
                <a href={exportPartUrl(latest.id, part.index)} download className="font-medium text-accent underline underline-offset-2">
                  {`Teil ${part.index + 1} herunterladen (${formatBytes(part.sizeBytes)})`}
                </a>
                <p className="mt-1 break-all text-xs text-muted">
                  SHA-256: <code>{part.sha256}</code>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
