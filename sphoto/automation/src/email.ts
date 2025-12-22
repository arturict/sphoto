// =============================================================================
// Email Service
// =============================================================================

import { Resend } from 'resend';
import { env, SHARED_INSTANCES } from './config';
import type { Platform } from './types';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendWelcomeEmail(
  email: string, 
  id: string, 
  planName: string, 
  storageGb: number, 
  password: string | null,
  platform: Platform = 'immich'
): Promise<void> {
  const url = `https://${id}.${env.DOMAIN}`;
  
  const isNextcloud = platform === 'nextcloud';
  const platformName = isNextcloud ? 'Nextcloud' : 'Immich';
  const platformIcon = isNextcloud ? '☁️' : '📸';
  
  // For Nextcloud, username is derived from email
  const nextcloudUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin';
  
  const loginInfo = password 
    ? `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">🔐 Deine Login-Daten:</p>
          ${isNextcloud 
            ? `<p style="margin: 5px 0;"><strong>Benutzername:</strong> ${nextcloudUser}</p>`
            : `<p style="margin: 5px 0;"><strong>E-Mail:</strong> ${email}</p>`
          }
          <p style="margin: 5px 0;"><strong>Passwort:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Bitte ändere dein Passwort nach dem ersten Login.</p>
        </div>
      `
    : `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">Öffne die URL und erstelle deinen Admin-Account.</p>
        </div>
      `;

  const nextSteps = isNextcloud
    ? `
        <h3>Nächste Schritte:</h3>
        <ol>
          <li>Öffne <a href="${url}">${url}</a></li>
          ${password ? '<li>Logge dich mit den obigen Daten ein</li>' : '<li>Erstelle deinen Account</li>'}
          <li>Lade die <strong>Nextcloud App</strong> (iOS/Android/Desktop)</li>
          <li>Verbinde mit: <code>${url}</code></li>
        </ol>
        <p style="margin-top: 15px;">
          <strong>Apps herunterladen:</strong><br>
          <a href="https://nextcloud.com/install/#install-clients" style="color: #0070f3;">nextcloud.com/install</a>
        </p>
      `
    : `
        <h3>Nächste Schritte:</h3>
        <ol>
          <li>Öffne <a href="${url}">${url}</a></li>
          ${password ? '<li>Logge dich mit den obigen Daten ein</li>' : '<li>Erstelle deinen Account</li>'}
          <li>Lade die <strong>Immich App</strong> (iOS/Android)</li>
          <li>Verbinde mit: <code>${url}</code></li>
        </ol>
      `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${platformIcon} Deine SPhoto ${platformName} Cloud ist bereit!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Deine persönliche ${platformName} Cloud ist bereit.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${planName} (${storageGb} GB)</p>
          <p style="margin: 0 0 10px 0;"><strong>Plattform:</strong> ${platformName}</p>
          <p style="margin: 0;"><strong>Deine URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${loginInfo}
        
        ${nextSteps}
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Wichtig:</strong> SPhoto ist ein Budget-Service ohne Backup. 
          Erstelle eigene Backups!
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });
  
  if (error) {
    console.error('Email send error:', error);
  } else {
    console.log(`Welcome email sent to ${email}`);
  }
}

// =============================================================================
// Shared Instance Email (for 2-instance mode)
// =============================================================================

export async function sendWelcomeEmailShared(
  email: string,
  instance: 'free' | 'paid',
  planName: string,
  storageGb: number,
  password: string | null
): Promise<void> {
  const config = instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  const url = config.url;
  const isFree = instance === 'free';
  
  const loginInfo = password 
    ? `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">🔐 Deine Login-Daten:</p>
          <p style="margin: 5px 0;"><strong>E-Mail:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Passwort:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Bitte ändere dein Passwort nach dem ersten Login.</p>
        </div>
      `
    : `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">Dein Account wurde erstellt. Logge dich mit deiner E-Mail-Adresse ein.</p>
        </div>
      `;

  const mlNote = isFree
    ? `
        <p style="background: #e0e7ff; padding: 10px; border-radius: 4px; font-size: 14px;">
          💡 <strong>Free Plan:</strong> Gesichtserkennung und Smart Search sind deaktiviert.
          <a href="https://${env.DOMAIN}" style="color: #4f46e5;">Upgrade auf einen bezahlten Plan</a> für alle Features.
        </p>
      `
    : `
        <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ✨ <strong>${planName} Plan:</strong> Gesichtserkennung und Smart Search sind aktiviert!
        </p>
      `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `📸 Deine SPhoto ${planName} Cloud ist bereit!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Dein SPhoto Account ist bereit.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${planName} (${storageGb} GB)</p>
          <p style="margin: 0;"><strong>Deine URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${loginInfo}
        
        <h3>Nächste Schritte:</h3>
        <ol>
          <li>Öffne <a href="${url}">${url}</a></li>
          <li>Logge dich mit deinen Daten ein</li>
          <li>Lade die <strong>Immich App</strong> (iOS/Android)</li>
          <li>Verbinde mit: <code>${url}</code></li>
        </ol>
        
        ${mlNote}
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Wichtig:</strong> SPhoto ist ein Budget-Service ohne Backup. 
          Erstelle eigene Backups!
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });
  
  if (error) {
    console.error('Email send error:', error);
  } else {
    console.log(`Welcome email (shared) sent to ${email}`);
  }
}

// =============================================================================
// Plan Change Email
// =============================================================================

export async function sendPlanChangeEmail(
  email: string,
  newPlanName: string,
  newStorageGb: number,
  newInstance: 'free' | 'paid'
): Promise<void> {
  const config = newInstance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  const url = config.url;
  const isFree = newInstance === 'free';
  
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: isFree 
      ? '📸 SPhoto: Dein Plan wurde geändert' 
      : '🎉 SPhoto: Willkommen beim neuen Plan!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Dein SPhoto Plan wurde ${isFree ? 'auf Free zurückgesetzt' : 'aktualisiert'}.</p>
        
        <div style="background: ${isFree ? '#fef3c7' : '#dcfce7'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Neuer Plan:</strong> ${newPlanName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Speicher:</strong> ${newStorageGb} GB</p>
          <p style="margin: 0;"><strong>Deine URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${isFree ? `
          <p style="background: #fee2e2; padding: 10px; border-radius: 4px; font-size: 14px;">
            ⚠️ <strong>Wichtig:</strong> Deine Fotos wurden <strong>nicht</strong> automatisch migriert.
            Bitte lade sie erneut hoch oder reaktiviere dein Abo.
          </p>
        ` : `
          <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
            ✨ Gesichtserkennung und Smart Search sind jetzt aktiviert!
          </p>
        `}
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });
  
  if (error) {
    console.error('Plan change email error:', error);
  } else {
    console.log(`Plan change email sent to ${email}`);
  }
}

// =============================================================================
// Free Tier Welcome Email
// =============================================================================

export async function sendFreeWelcomeEmail(
  email: string,
  password: string
): Promise<void> {
  await sendWelcomeEmailShared(email, 'free', 'Free', 5, password);
}

export async function sendPaymentFailedEmail(email: string, id: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '⚠️ SPhoto: Zahlung fehlgeschlagen',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1><span style="color: #dc2626;">S</span>Photo</h1>
        <p>Deine letzte Zahlung ist fehlgeschlagen.</p>
        <p><strong>Dein Account wurde pausiert.</strong></p>
        <p>Deine Daten bleiben 30 Tage gespeichert. Aktualisiere deine Zahlungsmethode um fortzufahren.</p>
      </div>
    `
  });

  if (error) {
    console.error('Payment failed email error:', error);
  }
}

export async function sendExportReadyEmail(
  email: string,
  instanceId: string,
  downloadUrl: string,
  fileSizeBytes: number
): Promise<void> {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '📦 Dein SPhoto Export ist bereit',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Dein Daten-Export ist fertig und steht zum Download bereit.</p>
        
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">📦 Export Details:</p>
          <p style="margin: 5px 0;"><strong>Instanz:</strong> ${instanceId}</p>
          <p style="margin: 5px 0;"><strong>Grösse:</strong> ${formatBytes(fileSizeBytes)}</p>
          <p style="margin: 5px 0;"><strong>Gültig bis:</strong> 24 Stunden</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${downloadUrl}" 
             style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Download starten
          </a>
        </div>
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Wichtig:</strong> Der Download-Link ist nur 24 Stunden gültig. 
          Danach wird die Datei automatisch gelöscht.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Dieser Export wurde gemäss DSGVO Art. 20 (Recht auf Datenübertragbarkeit) erstellt.
        </p>
      </div>
    `
  });

  if (error) {
    console.error('Export ready email error:', error);
  } else {
    console.log(`Export ready email sent to ${email}`);
  }
}

// =============================================================================
// Portal Emails
// =============================================================================

export async function sendPortalLoginEmail(
  email: string,
  token: string
): Promise<void> {
  const loginUrl = `https://portal.${env.DOMAIN}/auth?token=${token}`;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '🔐 SPhoto Login Link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Klicke auf den Button unten um dich in dein SPhoto Portal einzuloggen.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            In Portal einloggen
          </a>
        </div>
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ Dieser Link ist 24 Stunden gültig und kann nur einmal verwendet werden.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Falls du diesen Login nicht angefordert hast, ignoriere diese E-Mail.
        </p>
      </div>
    `
  });

  if (error) {
    console.error('Portal login email error:', error);
  } else {
    console.log(`Portal login email sent to ${email}`);
  }
}

export async function sendAccountDeletionEmail(
  email: string,
  scheduledFor: string
): Promise<void> {
  const formattedDate = new Date(scheduledFor).toLocaleDateString('de-CH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '⚠️ SPhoto: Account-Löschung geplant',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Du hast die Löschung deines SPhoto Accounts angefordert.</p>
        
        <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dc2626;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #dc2626;">🗓️ Löschung geplant für:</p>
          <p style="margin: 0; font-size: 18px;">${formattedDate}</p>
        </div>
        
        <p><strong>Was passiert dann?</strong></p>
        <ul>
          <li>Alle deine Fotos und Videos werden unwiderruflich gelöscht</li>
          <li>Dein Account wird vollständig entfernt</li>
          <li>Ein aktives Abo wird automatisch gekündigt</li>
        </ul>
        
        <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
          💡 <strong>Meinung geändert?</strong> Du kannst die Löschung jederzeit vor dem geplanten Datum 
          in deinem <a href="https://portal.${env.DOMAIN}" style="color: #dc2626;">SPhoto Portal</a> abbrechen.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });

  if (error) {
    console.error('Account deletion email error:', error);
  } else {
    console.log(`Account deletion email sent to ${email}`);
  }
}

export async function sendAccountDeletionCancelledEmail(
  email: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '✅ SPhoto: Account-Löschung abgebrochen',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Die geplante Löschung deines SPhoto Accounts wurde erfolgreich abgebrochen.</p>
        
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0; font-weight: bold; color: #166534;">✅ Dein Account bleibt aktiv!</p>
        </div>
        
        <p>Du kannst SPhoto weiterhin wie gewohnt nutzen.</p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });

  if (error) {
    console.error('Account deletion cancelled email error:', error);
  } else {
    console.log(`Account deletion cancelled email sent to ${email}`);
  }
}
