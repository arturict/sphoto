import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportSection } from './ExportSection';
import { portalMe } from './test-fixtures';

function renderSection(me = portalMe()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExportSection me={me} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExportSection', () => {
  it('disables the export button and names the date while the cooldown runs', () => {
    renderSection(portalMe({ nextExportAt: '2026-12-01T00:00:00.000Z' }));

    const button = screen.getByRole('button', { name: 'Export anfordern' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Der nächste Export ist ab dem 01.12.2026 möglich.');
  });

  it('shows progress and keeps the button disabled while an export job runs', () => {
    renderSection(
      portalMe({
        latestJob: { id: 'j1', kind: 'export', status: 'running', done: 1, total: 4, error: null, createdAt: '2026-10-19T08:00:00.000Z', finishedAt: null },
      }),
    );

    expect(screen.getByRole('button', { name: 'Export anfordern' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Export-Fortschritt' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Dein Export wird erstellt: 1 von 4 Archiven fertig.')).toBeInTheDocument();
  });

  it('lists a download link per part with checksum and expiry', () => {
    renderSection(
      portalMe({
        latestExport: {
          id: 'exp-1',
          createdAt: '2026-10-18T08:00:00.000Z',
          expiresAt: '2026-10-25T08:00:00.000Z',
          parts: [
            { index: 0, sizeBytes: 3 * 1024 ** 3, sha256: 'a'.repeat(64) },
            { index: 1, sizeBytes: 512 * 1024 ** 2, sha256: 'b'.repeat(64) },
          ],
        },
      }),
    );

    expect(screen.getByRole('link', { name: 'Teil 1 herunterladen (3.00 GB)' })).toHaveAttribute('href', '/api/portal/export/exp-1/parts/0');
    expect(screen.getByRole('link', { name: 'Teil 2 herunterladen (0.50 GB)' })).toHaveAttribute('href', '/api/portal/export/exp-1/parts/1');
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/verfügbar bis 25\.10\.2026/)).toBeInTheDocument();
  });

  it('requests an export when allowed and shows the server error otherwise', async () => {
    const fetchMock = vi.fn((_path: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ error: 'Ein Export ist nur alle 30 Tage möglich.' }), { status: 429 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: 'Export anfordern' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ein Export ist nur alle 30 Tage möglich.');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/portal/export');
  });
});
