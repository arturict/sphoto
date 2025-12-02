// =============================================================================
// Email Service
// =============================================================================

import { Resend } from 'resend';
import { env } from './config';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendWelcomeEmail(
  email: string, 
  id: string, 
  planName: string, 
  storageGb: number, 
  password: string | null
): Promise<void> {
  const url = `https://${id}.${env.DOMAIN}`;
  
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
          <p style="margin: 0;">Öffne die URL und erstelle deinen Admin-Account.</p>
        </div>
      `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '🎉 Deine SPhoto Cloud ist bereit!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Deine persönliche Photo-Cloud ist bereit.</p>
        
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
          ${password ? '<li>Logge dich mit den obigen Daten ein</li>' : '<li>Erstelle deinen Account</li>'}
          <li>Lade die <strong>Immich App</strong> (iOS/Android)</li>
          <li>Verbinde mit: <code>${url}</code></li>
        </ol>
        
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
