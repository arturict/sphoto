import type { PortalMe } from '@sphoto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorAlert, Notice } from '../../components/ui';
import { errorText } from '../../lib/api';
import { portalApi, portalMeKey } from '../../lib/endpoints';
import { formatDate } from '../../lib/format';

const jobKindLabel = { upgrade: 'Das Upgrade', downgrade: 'Der Wechsel auf den Free-Plan', export: 'Der Export' } as const;

export function Banners({ me }: { me: PortalMe }) {
  const queryClient = useQueryClient();
  const cancelDeletion = useMutation({
    mutationFn: portalApi.cancelDeletion,
    onSettled: () => queryClient.invalidateQueries({ queryKey: portalMeKey }),
  });

  const job = me.latestJob;
  const migrationJob = job && job.kind !== 'export' && (job.status === 'queued' || job.status === 'running') ? job : null;

  return (
    <div className="flex flex-col gap-3">
      {me.migrating ? (
        <Notice tone="info" title="Deine Fotos werden umgezogen">
          <p>
            Das kann einige Minuten dauern.
            {migrationJob && migrationJob.total > 0 ? ` Fortschritt: ${migrationJob.done} von ${migrationJob.total}.` : ''} Diese Seite aktualisiert sich automatisch.
          </p>
        </Notice>
      ) : null}

      {job?.status === 'failed' ? (
        <ErrorAlert>
          <p className="font-semibold">{jobKindLabel[job.kind]} ist fehlgeschlagen.</p>
          {job.error ? <p className="mt-1">{job.error}</p> : null}
        </ErrorAlert>
      ) : null}

      {me.cancellationDueAt ? (
        <Notice tone="warn">
          <p>
            Dein Abo ist beendet. Du wechselst am {formatDate(me.cancellationDueAt)} auf den Free-Plan. Es wird nichts gelöscht. Exportiere deine Fotos oder schliesse ein neues Abo ab, wenn
            du den vollen Speicher behalten möchtest.
          </p>
        </Notice>
      ) : null}

      {me.deletionDueAt ? (
        <Notice tone="warn">
          <p>Dein Konto wird am {formatDate(me.deletionDueAt)} gelöscht. Bis dahin kannst du die Löschung abbrechen.</p>
          <Button variant="secondary" className="mt-3" pending={cancelDeletion.isPending} onClick={() => cancelDeletion.mutate()}>
            Löschung abbrechen
          </Button>
          {cancelDeletion.isError ? (
            <div className="mt-3">
              <ErrorAlert>{errorText(cancelDeletion.error)}</ErrorAlert>
            </div>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}
