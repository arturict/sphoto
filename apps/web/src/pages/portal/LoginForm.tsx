import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorAlert, Notice, TextField } from '../../components/ui';
import { errorText } from '../../lib/api';
import { portalApi } from '../../lib/endpoints';

export function LoginForm({ heading = 'Im Kundenportal anmelden' }: { heading?: string }) {
  const [email, setEmail] = useState('');
  const login = useMutation({ mutationFn: portalApi.requestLogin });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(email);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="mt-2 text-muted">Wir schicken dir einen Anmeldelink per E-Mail. Ein Passwort brauchst du nicht.</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <TextField label="E-Mail-Adresse" type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {login.isError ? <ErrorAlert>{errorText(login.error)}</ErrorAlert> : null}
          {login.isSuccess ? (
            <Notice tone="ok" title="Wir haben dir einen Anmeldelink geschickt">
              Falls zu dieser Adresse ein Konto existiert, liegt der Link gleich in deinem Postfach. Er ist nur kurze Zeit und nur einmal gültig.
            </Notice>
          ) : null}
          <Button type="submit" pending={login.isPending}>
            Anmeldelink senden
          </Button>
        </form>
      </Card>
    </div>
  );
}
