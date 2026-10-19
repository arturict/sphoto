import type { AdminUserDetail, PaidTier } from '@sphoto/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorAlert, Loading, Notice, TextField } from '../../components/ui';
import { useAdminSessionKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { formatBytes, formatDate, formatDateTime, formatGb } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import { JobsTable } from './JobsTable';
import { adminKeys } from './keys';
import { UserStatusBadge } from './StatusBadges';

const route = getRouteApi('/admin/users/$id');
const tierLabel = { free: 'Free', basic: 'Basic', pro: 'Pro' } as const;

export function UserDetail() {
  usePageTitle('Benutzer');
  const { id } = route.useParams();
  const adminKey = useAdminSessionKey();
  const user = useQuery({ queryKey: adminKeys.user(id), queryFn: () => adminApi.user(adminKey, id) });

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link to="/admin/users" className="text-sm font-medium text-accent underline underline-offset-2">
          Zurück zu allen Benutzern
        </Link>
      </p>
      {user.isPending ? <Loading /> : null}
      {user.isError ? <ErrorAlert>{errorText(user.error)}</ErrorAlert> : null}
      {user.isSuccess ? <Detail user={user.data} adminKey={adminKey} /> : null}
    </div>
  );
}

function Detail({ user, adminKey }: { user: AdminUserDetail; adminKey: string }) {
  const fields: [string, string][] = [
    ['Plan', tierLabel[user.tier]],
    ['Instanz', user.instance === 'free' ? 'Free-Server' : 'Paid-Server'],
    ['Belegt', `${user.usedBytes === null ? '–' : formatBytes(user.usedBytes)} von ${formatGb(user.quotaGb)}`],
    ['Erstellt', formatDateTime(user.createdAt)],
    ['Abo', user.hasSubscription ? 'Aktives Abo' : 'Kein Abo'],
    ['Stripe-Kunde', user.stripeCustomerId ?? '–'],
    ['Kündigung wirksam', user.cancellationDueAt ? formatDate(user.cancellationDueAt) : '–'],
    ['Löschung am', user.deletionDueAt ? formatDate(user.deletionDueAt) : '–'],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold break-all">{user.email}</h2>
        <UserStatusBadge user={user} />
      </div>

      <Card as="section" aria-label="Details">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section aria-labelledby="user-jobs-title">
        <h3 id="user-jobs-title" className="text-lg font-semibold">
          Letzte Aufträge
        </h3>
        <div className="mt-3">
          <JobsTable jobs={user.jobs.map((job) => ({ ...job, userEmail: null }))} showUser={false} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SetTier user={user} adminKey={adminKey} />
        <LoginLink user={user} adminKey={adminKey} />
      </div>
      <DeleteUser user={user} adminKey={adminKey} />
    </>
  );
}

function useRefreshAfter() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['admin'] });
}

function SetTier({ user, adminKey }: { user: AdminUserDetail; adminKey: string }) {
  const refresh = useRefreshAfter();
  const [tier, setTier] = useState<PaidTier>(user.tier === 'pro' ? 'pro' : 'basic');
  const setPlan = useMutation({
    mutationKey: ['admin', 'set-tier'],
    mutationFn: (next: PaidTier) => adminApi.setTier(adminKey, user.id, next),
    onSettled: refresh,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlan.mutate(tier);
  }

  return (
    <Card as="section" aria-labelledby="set-tier-title">
      <h3 id="set-tier-title" className="text-lg font-semibold">
        Plan setzen
      </h3>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tier-select" className="text-sm font-medium">
            Neuer Plan
          </label>
          <select id="tier-select" value={tier} onChange={(event) => setTier(event.target.value === 'pro' ? 'pro' : 'basic')} className="min-h-11 rounded-lg border border-line bg-surface px-3 py-2">
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <p className="text-sm text-muted">
          Stripe wird dabei nicht geändert. {user.tier === 'free' ? 'Bei Free-Benutzern wiederholt das den Upgrade-Umzug auf den Paid-Server.' : 'Es ändert nur Plan und Kontingent in SPhoto.'}
        </p>
        {setPlan.isError ? <ErrorAlert>{errorText(setPlan.error)}</ErrorAlert> : null}
        {setPlan.isSuccess ? <Notice tone="ok">{`Plan ${tierLabel[setPlan.variables]} wurde gesetzt.`}</Notice> : null}
        <Button type="submit" pending={setPlan.isPending}>
          Plan setzen
        </Button>
      </form>
    </Card>
  );
}

function LoginLink({ user, adminKey }: { user: AdminUserDetail; adminKey: string }) {
  const send = useMutation({ mutationKey: ['admin', 'login-link'], mutationFn: () => adminApi.sendLoginLink(adminKey, user.id) });

  return (
    <Card as="section" aria-labelledby="login-link-title">
      <h3 id="login-link-title" className="text-lg font-semibold">
        Anmeldelink
      </h3>
      <p className="mt-2 text-sm text-muted">Schickt dem Benutzer einen neuen Anmeldelink für das Kundenportal an {user.email}.</p>
      <div className="mt-4 flex flex-col gap-4">
        {send.isError ? <ErrorAlert>{errorText(send.error)}</ErrorAlert> : null}
        {send.isSuccess ? <Notice tone="ok">Anmeldelink wurde gesendet.</Notice> : null}
        <Button variant="secondary" pending={send.isPending} onClick={() => send.mutate()}>
          Anmeldelink senden
        </Button>
      </div>
    </Card>
  );
}

function DeleteUser({ user, adminKey }: { user: AdminUserDetail; adminKey: string }) {
  const refresh = useRefreshAfter();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const remove = useMutation({
    mutationKey: ['admin', 'delete-user'],
    mutationFn: () => adminApi.deleteUser(adminKey, user.id, confirmation.trim()),
    onSuccess: async () => {
      await navigate({ to: '/admin/users' });
      await refresh();
    },
  });
  const confirmed = confirmation.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <section aria-labelledby="delete-user-title" className="rounded-2xl border border-danger-text/40 bg-surface p-5 sm:p-6">
      <h3 id="delete-user-title" className="text-lg font-semibold text-danger-text">
        Konto löschen
      </h3>
      <p className="mt-2 text-sm text-muted">Löscht das Konto sofort und endgültig, inklusive aller Fotos. Das lässt sich nicht rückgängig machen.</p>
      <form
        className="mt-4 flex max-w-md flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (confirmed) remove.mutate();
        }}
      >
        <TextField label="Zur Bestätigung die E-Mail-Adresse des Benutzers eingeben" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} hint={`Zu löschen: ${user.email}`} />
        {remove.isError ? <ErrorAlert>{errorText(remove.error)}</ErrorAlert> : null}
        <Button type="submit" variant="danger" disabled={!confirmed} pending={remove.isPending}>
          Endgültig löschen
        </Button>
      </form>
    </section>
  );
}
