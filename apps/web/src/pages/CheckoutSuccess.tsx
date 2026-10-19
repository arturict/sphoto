import type { CheckoutStatus } from '@sphoto/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Card, ErrorAlert, ExternalLinkButton, Loading, RouterLinkButton } from '../components/ui';
import { ApiError, errorText } from '../lib/api';
import { publicApi } from '../lib/endpoints';
import { usePageTitle } from '../lib/use-page-title';

const POLL_MS = 2000;
const route = getRouteApi('/checkout/success');

export function CheckoutSuccess() {
  usePageTitle('Zahlung abgeschlossen');
  const { session_id: sessionId } = route.useSearch();

  const status = useQuery({
    queryKey: ['checkout', sessionId],
    queryFn: () => publicApi.checkoutStatus(sessionId ?? ''),
    enabled: sessionId !== undefined,
    refetchInterval: (query) => {
      const current = query.state.data?.status;
      return current === 'pending' || current === 'processing' ? POLL_MS : false;
    },
  });

  return (
    <div className="mx-auto max-w-xl">
      <Card>{sessionId === undefined ? <Unknown /> : <Body status={status} />}</Card>
    </div>
  );
}

function Unknown() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Zahlung nicht gefunden</h1>
      <p className="mt-3 text-muted">Wir konnten diese Zahlung nicht zuordnen. Falls du bezahlt hast, erhältst du die Zugangsdaten per E-Mail.</p>
      <RouterLinkButton to="/" className="mt-5" variant="secondary">
        Zur Startseite
      </RouterLinkButton>
    </>
  );
}

function Body({ status }: { status: UseQueryResult<CheckoutStatus> }) {
  if (status.isPending) return <Loading label="Deine Zahlung wird geprüft…" />;

  if (status.isError) {
    const notFound = status.error instanceof ApiError && status.error.status === 404;
    return (
      <>
        <h1 className="text-2xl font-semibold">{notFound ? 'Zahlung nicht gefunden' : 'Status nicht verfügbar'}</h1>
        <div className="mt-4">
          <ErrorAlert>{notFound ? 'Wir kennen diese Zahlung nicht. Falls du bezahlt hast, erhältst du die Zugangsdaten per E-Mail.' : errorText(status.error)}</ErrorAlert>
        </div>
        <RouterLinkButton to="/" className="mt-5" variant="secondary">
          Zur Startseite
        </RouterLinkButton>
      </>
    );
  }

  const { data } = status;

  if (data.status === 'complete') {
    return (
      <>
        <h1 className="text-2xl font-semibold">Dein Konto ist bereit</h1>
        <p className="mt-3 text-muted">Deine Zugangsdaten für die Foto-App erhältst du per E-Mail. Danach kannst du dich in der Foto-App anmelden und deine Fotos hochladen.</p>
        {data.instanceUrl ? (
          <ExternalLinkButton href={data.instanceUrl} className="mt-5">
            Zur Foto-App
          </ExternalLinkButton>
        ) : null}
        <RouterLinkButton to="/portal" className="mt-3 sm:ml-3" variant="secondary">
          Zum Kundenportal
        </RouterLinkButton>
      </>
    );
  }

  if (data.status === 'error') {
    return (
      <>
        <h1 className="text-2xl font-semibold">Bei der Einrichtung ist etwas schiefgelaufen</h1>
        <div className="mt-4">
          <ErrorAlert>{data.message ?? 'Dein Konto konnte nicht eingerichtet werden.'}</ErrorAlert>
        </div>
        <p className="mt-4 text-muted">Dein Geld ist sicher. Wir melden uns bei dir per E-Mail, sobald das Problem gelöst ist.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Wir richten dein Konto ein</h1>
      <div className="mt-4">
        <Loading label={data.message ?? 'Deine Zahlung ist eingegangen, dein Konto wird vorbereitet…'} />
      </div>
      <p className="mt-3 text-sm text-muted">Das dauert meist nur einen Moment. Du musst diese Seite nicht offen lassen.</p>
    </>
  );
}
