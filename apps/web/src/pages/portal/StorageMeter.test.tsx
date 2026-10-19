import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorageMeter } from './StorageMeter';

describe('StorageMeter', () => {
  it('shows used and total storage with a labelled progress bar', () => {
    render(<StorageMeter me={{ usedBytes: 25 * 1024 ** 3, quotaGb: 100, photos: 1200, videos: 1 }} />);

    expect(screen.getByText('25.00 GB von 100 GB belegt')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Speichernutzung' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText(/1.200 Fotos/)).toBeInTheDocument();
    expect(screen.getByText(/1 Video(?!s)/)).toBeInTheDocument();
  });

  it('says so when usage cannot be read', () => {
    render(<StorageMeter me={{ usedBytes: null, quotaGb: 5, photos: null, videos: null }} />);

    expect(screen.getByText('Nutzung nicht verfügbar')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
