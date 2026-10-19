import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorAlert, TextField } from '../../components/ui';
import { setAdminKey } from '../../lib/admin-key';
import { errorText } from '../../lib/api';
import { adminApi } from '../../lib/endpoints';
import { adminKeys } from './keys';

export function AdminGate() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const verify = useMutation({
    mutationFn: adminApi.overview,
    onSuccess: (overview, verifiedKey) => {
      queryClient.setQueryData(adminKeys.overview, overview);
      setAdminKey(verifiedKey);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    verify.mutate(key);
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="mt-2 text-muted">Gib den Admin-Schlüssel ein. Er bleibt nur in diesem Browser-Tab gespeichert.</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <TextField label="Admin-Schlüssel" type="password" name="admin-key" autoComplete="off" required value={key} onChange={(event) => setKey(event.target.value)} />
          {verify.isError ? <ErrorAlert>{errorText(verify.error)}</ErrorAlert> : null}
          <Button type="submit" pending={verify.isPending}>
            Anmelden
          </Button>
        </form>
      </Card>
    </div>
  );
}
