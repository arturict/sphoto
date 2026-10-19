import type { PaidTier, Plan } from '@sphoto/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { errorText } from '../lib/api';
import { publicApi } from '../lib/endpoints';
import { formatChf, formatGb } from '../lib/format';
import { CheckIcon } from './icons';
import { Button, Card, ErrorAlert, Loading, TextField } from './ui';

function PaidPlanForm({ planId, planName }: { planId: PaidTier; planName: string }) {
  const [email, setEmail] = useState('');
  const checkout = useMutation({
    mutationFn: () => publicApi.startCheckout(planId, email),
    // Stays pending while the browser leaves for the payment page.
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkout.mutate();
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
      <TextField label={`E-Mail-Adresse für ${planName}`} type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      {checkout.isError ? <ErrorAlert>{errorText(checkout.error)}</ErrorAlert> : null}
      <Button type="submit" pending={checkout.isPending || checkout.isSuccess}>
        {planName} wählen
      </Button>
    </form>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isFree = plan.id === 'free';
  return (
    <Card as="article" aria-label={`Plan ${plan.name}`} className="flex flex-col">
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-2">
        <span className="text-3xl font-bold">{isFree ? 'Gratis' : formatChf(plan.priceChfPerMonth)}</span>
        {isFree ? null : <span className="text-muted"> pro Monat</span>}
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        <li className="flex items-start gap-2">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok-text" />
          {formatGb(plan.storageGb)} Speicher
        </li>
        <li className="flex items-start gap-2">
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok-text" />
          {plan.hasMl ? 'Gesichter- und Objektsuche inklusive' : 'Ohne Gesichter- und Objektsuche'}
        </li>
      </ul>
      {plan.id === 'basic' || plan.id === 'pro' ? (
        <PaidPlanForm planId={plan.id} planName={plan.name} />
      ) : (
        <a href="#gratis" className="mt-6 text-sm font-medium text-accent underline underline-offset-2">
          Jetzt kostenlos starten
        </a>
      )}
    </Card>
  );
}

export function PlanCards() {
  const config = useQuery({ queryKey: ['config'], queryFn: publicApi.config, staleTime: 5 * 60_000 });

  if (config.isPending) return <Loading label="Preise werden geladen…" />;
  if (config.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorAlert>{`Die Preise konnten nicht geladen werden. ${errorText(config.error)}`}</ErrorAlert>
        <Button variant="secondary" onClick={() => void config.refetch()}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {config.data.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
