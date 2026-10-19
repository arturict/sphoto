import type { PortalMe } from '@sphoto/shared';
import { formatBytes, formatGb, formatInteger, usagePercent } from '../../lib/format';

function count(value: number | null, singular: string, plural: string): string {
  if (value === null) return `${plural}: –`;
  return `${formatInteger(value)} ${value === 1 ? singular : plural}`;
}

export function StorageMeter({ me }: { me: Pick<PortalMe, 'usedBytes' | 'quotaGb' | 'photos' | 'videos'> }) {
  const percent = me.usedBytes === null ? 0 : usagePercent(me.usedBytes, me.quotaGb);

  return (
    <div>
      {me.usedBytes === null ? (
        <p className="font-medium">Nutzung nicht verfügbar</p>
      ) : (
        <>
          <p className="font-medium">{`${formatBytes(me.usedBytes)} von ${formatGb(me.quotaGb)} belegt`}</p>
          <div
            role="progressbar"
            aria-label="Speichernutzung"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent} Prozent belegt`}
            className="mt-2 h-3 overflow-hidden rounded-full bg-sunken ring-1 ring-line"
          >
            <div className={`h-full rounded-full ${percent >= 90 ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
      <p className="mt-2 text-sm text-muted">
        {count(me.photos, 'Foto', 'Fotos')} · {count(me.videos, 'Video', 'Videos')}
      </p>
    </div>
  );
}
