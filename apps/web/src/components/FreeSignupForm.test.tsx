import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreeSignupForm } from './FreeSignupForm';

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FreeSignupForm />
    </QueryClientProvider>,
  );
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn((_path: string, _init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FreeSignupForm', () => {
  it('confirms the new account and links to the photo app', async () => {
    const fetchMock = stubFetch(201, { instanceUrl: 'https://fotos.example' });
    renderForm();

    const section = screen.getByRole('region', { name: 'Kostenlos starten' });
    await userEvent.type(within(section).getByLabelText('E-Mail-Adresse'), 'anna@example.ch');
    await userEvent.click(within(section).getByRole('button', { name: 'Kostenlos starten' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Konto erstellt');
    expect(status).toHaveTextContent('Prüfe dein Postfach');
    expect(within(status).getByRole('link', { name: 'Zur Foto-App' })).toHaveAttribute('href', 'https://fotos.example');

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/signup/free');
    expect(init?.body).toBe('{"email":"anna@example.ch"}');
  });

  it('shows the server message when the address is already registered', async () => {
    stubFetch(409, { error: 'Diese E-Mail-Adresse ist bereits registriert. Melde dich im Portal an.' });
    renderForm();

    await userEvent.type(screen.getByLabelText('E-Mail-Adresse'), 'anna@example.ch');
    await userEvent.click(screen.getByRole('button', { name: 'Kostenlos starten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('bereits registriert');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
