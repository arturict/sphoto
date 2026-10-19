import type { Mail } from './mailer';

// All user-facing mail text lives here (German). Each function returns subject and text.
type Body = Pick<Mail, 'subject' | 'text'>;

const date = (iso: string) => new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
const gb = (value: number) => (value >= 1000 ? `${value / 1000} TB` : `${value} GB`);

export const templates = {
  welcome(p: { planName: string; quotaGb: number; instanceUrl: string; email: string; password: string; portalUrl: string }): Body {
    return {
      subject: `Willkommen bei SPhoto (${p.planName})`,
      text: [
        `Dein SPhoto-Konto ist bereit: ${p.planName} mit ${gb(p.quotaGb)} Speicher.`,
        `Anmelden in der Foto-App:\n${p.instanceUrl}\nE-Mail: ${p.email}\nPasswort: ${p.password}`,
        `Bitte ändere das Passwort nach dem ersten Login. Die gleichen Zugangsdaten gelten für die iOS- und Android-App von Immich (Server-Adresse: ${p.instanceUrl}).`,
        `Abo, Export und Konto verwaltest du hier:\n${p.portalUrl}`,
      ].join('\n\n'),
    };
  },
  magicLink(p: { url: string; minutes: number }): Body {
    return {
      subject: 'Dein SPhoto-Anmeldelink',
      text: `Mit diesem Link meldest du dich im SPhoto-Portal an (gültig ${p.minutes} Minuten, nur einmal verwendbar):\n${p.url}\n\nWenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren.`,
    };
  },
  upgradeDone(p: { planName: string; quotaGb: number; instanceUrl: string; email: string; password: string; migrated: number }): Body {
    return {
      subject: `Upgrade auf ${p.planName} abgeschlossen`,
      text: [
        `Deine Fotos sind auf den Premium-Server umgezogen (${p.migrated} Dateien). Du hast jetzt ${gb(p.quotaGb)} Speicher und die KI-Suche.`,
        `Neue Adresse: ${p.instanceUrl}\nE-Mail: ${p.email}\nNeues Passwort: ${p.password}`,
        'Trage in der Immich-App die neue Server-Adresse ein und melde dich mit diesem Passwort an. Dein alter Zugang wurde entfernt.',
      ].join('\n\n'),
    };
  },
  upgradeFailed(p: { portalUrl: string }): Body {
    return {
      subject: 'Dein Upgrade braucht noch etwas Zeit',
      text: `Beim Umzug deiner Fotos auf den Premium-Server ist ein Fehler aufgetreten. Deine Fotos auf dem bisherigen Server sind unverändert und sicher. Wir kümmern uns darum und melden uns, sobald der Umzug abgeschlossen ist.\n\nStatus: ${p.portalUrl}`,
    };
  },
  planChanged(p: { planName: string; quotaGb: number }): Body {
    return { subject: `Dein Plan: ${p.planName}`, text: `Dein Plan wurde auf ${p.planName} geändert. Du hast jetzt ${gb(p.quotaGb)} Speicher.` };
  },
  paymentFailed(p: { portalUrl: string }): Body {
    return {
      subject: 'Zahlung fehlgeschlagen',
      text: `Wir konnten deine letzte Zahlung nicht einziehen. Bitte aktualisiere deine Zahlungsmethode im Portal, damit dein Konto aktiv bleibt:\n${p.portalUrl}`,
    };
  },
  cancellationScheduled(p: { endsAt: string; freeQuotaGb: number; portalUrl: string }): Body {
    return {
      subject: 'Dein Abo wurde beendet',
      text: [
        `Dein Abo ist beendet. Du kannst deine Fotos bis zum ${date(p.endsAt)} weiter nutzen und exportieren.`,
        `Danach wechselt dein Konto auf den kostenlosen Plan mit ${gb(p.freeQuotaGb)}. Belegst du dann mehr Speicher, bleibt dein Konto unverändert bestehen, bis du Platz schaffst oder ein Abo abschliesst; es wird nichts gelöscht.`,
        `Export und Abo: ${p.portalUrl}`,
      ].join('\n\n'),
    };
  },
  cancellationReminder(p: { daysLeft: number; endsAt: string; portalUrl: string }): Body {
    return {
      subject: `Noch ${p.daysLeft} ${p.daysLeft === 1 ? 'Tag' : 'Tage'} bis zum Wechsel auf den Free-Plan`,
      text: `Am ${date(p.endsAt)} wechselt dein Konto auf den kostenlosen Plan. Exportiere deine Fotos oder schliesse ein neues Abo ab:\n${p.portalUrl}`,
    };
  },
  downgradeDone(p: { instanceUrl: string; email: string; password: string; quotaGb: number }): Body {
    return {
      subject: 'Dein Konto ist jetzt im Free-Plan',
      text: [
        `Deine Fotos sind auf den kostenlosen Server umgezogen (${gb(p.quotaGb)} Speicher).`,
        `Neue Adresse: ${p.instanceUrl}\nE-Mail: ${p.email}\nNeues Passwort: ${p.password}`,
      ].join('\n\n'),
    };
  },
  downgradeBlocked(p: { usedGb: string; freeQuotaGb: number; portalUrl: string }): Body {
    return {
      subject: 'Dein Konto belegt mehr als der Free-Plan erlaubt',
      text: `Dein Konto belegt ${p.usedGb} GB, der Free-Plan bietet ${gb(p.freeQuotaGb)}. Wir haben nichts gelöscht. Lösche Fotos, die du nicht mehr brauchst, oder schliesse ein Abo ab, dann geht es weiter:\n${p.portalUrl}`,
    };
  },
  exportReady(p: { parts: { index: number; sizeBytes: number; sha256: string }[]; expiresAt: string; portalUrl: string }): Body {
    const lines = p.parts.map((part) => `Teil ${part.index + 1}: ${(part.sizeBytes / 1024 ** 3).toFixed(2)} GB, SHA-256 ${part.sha256}`);
    return {
      subject: 'Dein Foto-Export ist bereit',
      text: `Dein Export steht im Portal bis zum ${date(p.expiresAt)} zum Download bereit:\n${p.portalUrl}\n\n${lines.join('\n')}`,
    };
  },
  exportFailed(): Body {
    return { subject: 'Dein Foto-Export ist fehlgeschlagen', text: 'Beim Erstellen deines Exports ist ein Fehler aufgetreten. Bitte starte ihn im Portal erneut. Besteht das Problem, antworte auf diese Nachricht.' };
  },
  deletionScheduled(p: { dueAt: string; portalUrl: string }): Body {
    return {
      subject: 'Kontolöschung vorgemerkt',
      text: `Dein Konto und alle Fotos werden am ${date(p.dueAt)} gelöscht. Bis dahin kannst du die Löschung im Portal abbrechen:\n${p.portalUrl}`,
    };
  },
  deletionCancelled(): Body {
    return { subject: 'Kontolöschung abgebrochen', text: 'Die Löschung deines Kontos wurde abgebrochen. Alles bleibt wie es war.' };
  },
  deletionDone(): Body {
    return { subject: 'Dein SPhoto-Konto wurde gelöscht', text: 'Dein Konto und alle Fotos wurden gelöscht. Ein laufendes Abo wurde beendet.' };
  },
  quotaWarning(p: { percent: number; usedGb: string; quotaGb: number; portalUrl: string; canUpgrade: boolean }): Body {
    return {
      subject: `Dein Speicher ist zu ${p.percent} % voll`,
      text: `Du belegst ${p.usedGb} GB von ${gb(p.quotaGb)}.${p.canUpgrade ? ` Mit einem Upgrade bekommst du mehr Platz:\n${p.portalUrl}` : ''}`,
    };
  },
  adminAlert(p: { subject: string; text: string }): Body {
    return { subject: `[SPhoto] ${p.subject}`, text: p.text };
  },
};
