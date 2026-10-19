import type { PortalMe } from '@sphoto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Button, ErrorAlert } from '../../components/ui';
import { errorText } from '../../lib/api';
import { portalApi, portalMeKey } from '../../lib/endpoints';

export function DeleteAccount({ me }: { me: Pick<PortalMe, 'deletionDueAt'> }) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deletion = useMutation({
    mutationFn: portalApi.deleteAccount,
    onSuccess: async () => {
      dialogRef.current?.close();
      await queryClient.invalidateQueries({ queryKey: portalMeKey });
    },
  });

  return (
    <section aria-labelledby="danger-title" className="rounded-2xl border border-danger-text/40 bg-surface p-5 sm:p-6">
      <h2 id="danger-title" className="text-lg font-semibold text-danger-text">
        Gefahrenzone
      </h2>
      {me.deletionDueAt ? (
        <p className="mt-1 text-sm text-muted">Die Löschung deines Kontos ist bereits vorgemerkt. Du kannst sie oben abbrechen.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Wenn du dein Konto löschst, werden auch alle Fotos und Videos entfernt.</p>
          <Button
            variant="danger"
            className="mt-4"
            onClick={() => {
              deletion.reset();
              dialogRef.current?.showModal();
            }}
          >
            Konto löschen
          </Button>
        </>
      )}

      <dialog ref={dialogRef} aria-labelledby="delete-title" className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-6 text-fg">
        <h2 id="delete-title" className="text-xl font-semibold">
          Konto wirklich löschen?
        </h2>
        <p className="mt-3 text-sm">
          Dein Konto und alle Fotos werden nach einer Frist von 14 Tagen endgültig gelöscht. Bis dahin kannst du die Löschung im Portal abbrechen. Ein laufendes Abo wird beendet.
        </p>
        <p className="mt-2 text-sm text-muted">Exportiere deine Fotos vorher, wenn du sie behalten möchtest.</p>
        {deletion.isError ? (
          <div className="mt-4">
            <ErrorAlert>{errorText(deletion.error)}</ErrorAlert>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Abbrechen
          </Button>
          <Button variant="danger" pending={deletion.isPending} onClick={() => deletion.mutate()}>
            Konto endgültig löschen
          </Button>
        </div>
      </dialog>
    </section>
  );
}
