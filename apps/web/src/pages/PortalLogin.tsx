import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { Card, ErrorAlert, Loading, RouterLinkButton } from '../components/ui';
import { errorText } from '../lib/api';
import { portalApi, portalMeKey } from '../lib/endpoints';
import { usePageTitle } from '../lib/use-page-title';

const route = getRouteApi('/portal/login');

export function PortalLogin() {
  usePageTitle('Anmeldung');
  const { token } = route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Links are single-use, so the exchange must run once even when React StrictMode re-runs effects.
  const started = useRef(false);

  const exchange = useMutation({
    mutationFn: portalApi.exchangeToken,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: portalMeKey });
      await navigate({ to: '/portal', replace: true });
    },
  });
  const { mutate } = exchange;

  useEffect(() => {
    if (token === undefined || started.current) return;
    started.current = true;
    mutate(token);
  }, [token, mutate]);

  const failure = token === undefined ? 'Dieser Anmeldelink ist unvollständig.' : exchange.isError ? errorText(exchange.error) : null;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-semibold">Anmeldung</h1>
        <div className="mt-4">
          {failure ? (
            <>
              <ErrorAlert>{failure}</ErrorAlert>
              <RouterLinkButton to="/portal" className="mt-4">
                Neuen Anmeldelink anfordern
              </RouterLinkButton>
            </>
          ) : (
            <Loading label="Du wirst angemeldet…" />
          )}
        </div>
      </Card>
    </div>
  );
}
