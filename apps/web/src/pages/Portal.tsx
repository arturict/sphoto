import { useQuery } from '@tanstack/react-query';
import { Button, ErrorAlert, Loading } from '../components/ui';
import { ApiError, errorText } from '../lib/api';
import { portalApi, portalMeKey } from '../lib/endpoints';
import { usePageTitle } from '../lib/use-page-title';
import { Dashboard } from './portal/Dashboard';
import { LoginForm } from './portal/LoginForm';

const POLL_MS = 3000;

export function Portal() {
  usePageTitle('Kundenportal');

  const me = useQuery({
    queryKey: portalMeKey,
    queryFn: portalApi.me,
    retry: false,
    // A running migration or job changes server state without user action.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const jobActive = data.latestJob?.status === 'running' || data.latestJob?.status === 'queued';
      return data.migrating || jobActive ? POLL_MS : false;
    },
  });

  if (me.isPending) return <Loading label="Dein Konto wird geladen…" />;

  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <LoginForm heading="Anmelden" />;
    return (
      <div className="flex max-w-xl flex-col items-start gap-3">
        <ErrorAlert>{errorText(me.error)}</ErrorAlert>
        <Button variant="secondary" onClick={() => void me.refetch()}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return <Dashboard me={me.data} />;
}
