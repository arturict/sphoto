import { useMutation } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { errorText } from '../lib/api';
import { publicApi } from '../lib/endpoints';
import { Button, Card, ErrorAlert, ExternalLinkButton, TextField } from './ui';

export function FreeSignupForm() {
  const headingId = useId();
  const [email, setEmail] = useState('');
  const signup = useMutation({ mutationFn: publicApi.signupFree });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signup.mutate(email);
  }

  return (
    <Card as="section" aria-labelledby={headingId} id="gratis">
      <h2 id={headingId} className="text-xl font-semibold">
        Kostenlos starten
      </h2>
      <p className="mt-1 text-sm text-muted">Der Free-Plan kostet nichts und braucht keine Zahlungsdaten. Du erhältst deine Zugangsdaten per E-Mail.</p>

      {signup.isSuccess ? (
        <div role="status" className="mt-5 rounded-lg border border-ok-text/40 bg-ok-soft p-4 text-ok-text">
          <p className="font-semibold">Konto erstellt</p>
          <p className="mt-1 text-sm">Prüfe dein Postfach: Dort warten deine Zugangsdaten für die Foto-App.</p>
          <ExternalLinkButton href={signup.data.instanceUrl} className="mt-4">
            Zur Foto-App
          </ExternalLinkButton>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <TextField label="E-Mail-Adresse" type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {signup.isError ? <ErrorAlert>{errorText(signup.error)}</ErrorAlert> : null}
          <Button type="submit" pending={signup.isPending}>
            Kostenlos starten
          </Button>
        </form>
      )}
    </Card>
  );
}
