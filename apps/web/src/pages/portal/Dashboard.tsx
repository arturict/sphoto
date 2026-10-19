import type { PortalMe } from '@sphoto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Card, ErrorAlert, ExternalLinkButton } from '../../components/ui';
import { errorText } from '../../lib/api';
import { portalApi, portalMeKey } from '../../lib/endpoints';
import { formatDate } from '../../lib/format';
import { Banners } from './Banners';
import { DeleteAccount } from './DeleteAccount';
import { ExportSection } from './ExportSection';
import { StorageMeter } from './StorageMeter';
import { UpgradeSection } from './UpgradeSection';

export function Dashboard({ me }: { me: PortalMe }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: portalApi.logout,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: portalMeKey });
      await navigate({ to: '/' });
    },
  });
  const billing = useMutation({
    mutationFn: portalApi.billing,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Dein Konto</h1>
        <Button variant="secondary" pending={logout.isPending} onClick={() => logout.mutate()}>
          Abmelden
        </Button>
      </div>
      {logout.isError ? <ErrorAlert>{errorText(logout.error)}</ErrorAlert> : null}

      <Banners me={me} />

      <Card as="section" aria-labelledby="account-title">
        <h2 id="account-title" className="text-lg font-semibold">
          Plan und Speicher
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Plan</dt>
          <dd className="font-medium">{me.planName}</dd>
          <dt className="text-muted">E-Mail-Adresse</dt>
          <dd className="font-medium break-all">{me.email}</dd>
          <dt className="text-muted">Konto erstellt</dt>
          <dd className="font-medium">{formatDate(me.createdAt)}</dd>
        </dl>
        <div className="mt-5">
          <StorageMeter me={me} />
        </div>
        <p className="mt-4 text-sm text-muted">
          {me.hasMl ? 'Die Gesichter- und Objektsuche ist in deinem Plan enthalten.' : 'Die Gesichter- und Objektsuche gehört zu den bezahlten Plänen Basic und Pro.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ExternalLinkButton href={me.instanceUrl}>Foto-App öffnen</ExternalLinkButton>
          {me.canManageBilling ? (
            <Button variant="secondary" pending={billing.isPending || billing.isSuccess} onClick={() => billing.mutate()}>
              Abrechnung verwalten
            </Button>
          ) : null}
        </div>
        {billing.isError ? (
          <div className="mt-3">
            <ErrorAlert>{errorText(billing.error)}</ErrorAlert>
          </div>
        ) : null}
      </Card>

      <ExportSection me={me} />
      {me.canUpgrade ? <UpgradeSection /> : null}
      <DeleteAccount me={me} />
    </div>
  );
}
