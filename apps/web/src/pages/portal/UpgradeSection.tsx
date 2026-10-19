import type { PaidTier } from '@sphoto/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, ErrorAlert } from '../../components/ui';
import { errorText } from '../../lib/api';
import { portalApi, publicApi } from '../../lib/endpoints';
import { formatChf, formatGb } from '../../lib/format';

const paidPlans: { id: PaidTier; name: string }[] = [
  { id: 'basic', name: 'Basic' },
  { id: 'pro', name: 'Pro' },
];

export function UpgradeSection() {
  const config = useQuery({ queryKey: ['config'], queryFn: publicApi.config, staleTime: 5 * 60_000 });
  const upgrade = useMutation({
    mutationFn: portalApi.upgrade,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
  const busy = upgrade.isPending || upgrade.isSuccess;

  return (
    <section aria-labelledby="upgrade-title" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="upgrade-title" className="text-lg font-semibold">
        Mehr Speicher
      </h2>
      <p className="mt-1 text-sm text-muted">Mit einem bezahlten Plan bekommst du mehr Speicher und die Gesichter- und Objektsuche. Deine Fotos werden dafür automatisch umgezogen.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {paidPlans.map((paid) => {
          const plan = config.data?.plans.find((candidate) => candidate.id === paid.id);
          return (
            <div key={paid.id} className="flex flex-col gap-3 rounded-lg border border-line p-4">
              <div>
                <p className="font-semibold">{paid.name}</p>
                {plan ? (
                  <p className="text-sm text-muted">
                    {formatChf(plan.priceChfPerMonth)} pro Monat, {formatGb(plan.storageGb)} Speicher
                  </p>
                ) : null}
              </div>
              <Button pending={upgrade.isPending && upgrade.variables === paid.id} disabled={busy} onClick={() => upgrade.mutate(paid.id)}>
                {paid.name} wählen
              </Button>
            </div>
          );
        })}
      </div>
      {upgrade.isError ? (
        <div className="mt-3">
          <ErrorAlert>{errorText(upgrade.error)}</ErrorAlert>
        </div>
      ) : null}
    </section>
  );
}
