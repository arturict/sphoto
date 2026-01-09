// =============================================================================
// Email Service
// =============================================================================

import { env, SHARED_INSTANCES, SUPPORT_EMAIL } from './config';
import { getResend, isResendConfigured } from './lib/resend';
import type { Platform } from './types';

export async function sendWelcomeEmail(
  email: string, 
  id: string, 
  planName: string, 
  storageGb: number, 
  password: string | null,
  platform: Platform = 'immich'
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send welcome email to ${email} (Resend not configured)`);
    return;
  }

  const url = `https://${id}.${env.DOMAIN}`;
  
  const isNextcloud = platform === 'nextcloud';
  const platformName = isNextcloud ? 'Nextcloud' : 'Immich';
  const platformIcon = isNextcloud ? '☁️' : '📸';
  
  // For Nextcloud, username is derived from email
  const nextcloudUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin';
  
  const loginInfo = password 
    ? `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">🔐 Your login credentials:</p>
          ${isNextcloud 
            ? `<p style="margin: 5px 0;"><strong>Username:</strong> ${nextcloudUser}</p>`
            : `<p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>`
          }
          <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Please change your password after your first login.</p>
        </div>
      `
    : `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">Open the URL and create your admin account.</p>
        </div>
      `;

  const nextSteps = isNextcloud
    ? `
        <h3>Next steps:</h3>
        <ol>
          <li>Open <a href="${url}">${url}</a></li>
          ${password ? '<li>Log in with the credentials above</li>' : '<li>Create your account</li>'}
          <li>Download the <strong>Nextcloud app</strong> (iOS/Android/Desktop)</li>
          <li>Connect with: <code>${url}</code></li>
        </ol>
        <p style="margin-top: 15px;">
          <strong>Download apps:</strong><br>
          <a href="https://nextcloud.com/install/#install-clients" style="color: #0070f3;">nextcloud.com/install</a>
        </p>
      `
    : `
        <h3>Next steps:</h3>
        <ol>
          <li>Open <a href="${url}">${url}</a></li>
          ${password ? '<li>Log in with the credentials above</li>' : '<li>Create your account</li>'}
          <li>Download the <strong>Immich app</strong> (iOS/Android)</li>
          <li>Connect with: <code>${url}</code></li>
        </ol>
      `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${platformIcon} Your SPhoto ${platformName} cloud is ready!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>Your personal ${platformName} cloud is ready.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${planName} (${storageGb} GB)</p>
          <p style="margin: 0 0 10px 0;"><strong>Platform:</strong> ${platformName}</p>
          <p style="margin: 0;"><strong>Your URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${loginInfo}
        
        ${nextSteps}
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Important:</strong> SPhoto is a budget service without backups. 
          Please create your own backups!
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Questions? Contact ${SUPPORT_EMAIL}
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send shared welcome email to ${email} (Resend not configured)`);
    return;
  }

  const config = instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  const url = config.url;
  const isFree = instance === 'free';
  
  const loginInfo = password 
    ? `
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">🔐 Your login credentials:</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Please change your password after your first login.</p>
        </div>
      `
    : `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;">Your account has been created. Log in with your email address.</p>
        </div>
      `;

  const mlNote = isFree
    ? `
        <p style="background: #e0e7ff; padding: 10px; border-radius: 4px; font-size: 14px;">
          💡 <strong>Free Plan:</strong> Face recognition and Smart Search are disabled.
          <a href="https://${env.DOMAIN}" style="color: #4f46e5;">Upgrade to a paid plan</a> for all features.
        </p>
      `
    : `
        <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ✨ <strong>${planName} Plan:</strong> Face recognition and Smart Search are enabled!
        </p>
      `;

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `📸 Your SPhoto ${planName} cloud is ready!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>Your SPhoto account is ready.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${planName} (${storageGb} GB)</p>
          <p style="margin: 0;"><strong>Your URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${loginInfo}
        
        <h3>Next steps:</h3>
        <ol>
          <li>Open <a href="${url}">${url}</a></li>
          <li>Log in with your credentials</li>
          <li>Download the <strong>Immich app</strong> (iOS/Android)</li>
          <li>Connect with: <code>${url}</code></li>
        </ol>
        
        ${mlNote}
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Important:</strong> SPhoto is a budget service without backups. 
          Please create your own backups!
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Questions? Contact ${SUPPORT_EMAIL}
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send plan change email to ${email} (Resend not configured)`);
    return;
  }

  const config = newInstance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  const url = config.url;
  const isFree = newInstance === 'free';
  
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: isFree 
      ? '📸 SPhoto: Your plan has been changed' 
      : '🎉 SPhoto: Welcome to your new plan!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>Your SPhoto plan has been ${isFree ? 'reset to Free' : 'updated'}.</p>
        
        <div style="background: ${isFree ? '#fef3c7' : '#dcfce7'}; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>New plan:</strong> ${newPlanName}</p>
          <p style="margin: 0 0 10px 0;"><strong>Storage:</strong> ${newStorageGb} GB</p>
          <p style="margin: 0;"><strong>Your URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        ${isFree ? `
          <p style="background: #fee2e2; padding: 10px; border-radius: 4px; font-size: 14px;">
            ⚠️ <strong>Important:</strong> Your photos were <strong>not</strong> automatically migrated.
            Please upload them again or reactivate your subscription.
          </p>
        ` : `
          <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
            ✨ Face recognition and Smart Search are now enabled!
          </p>
        `}
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Questions? Contact ${SUPPORT_EMAIL}
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send payment failed email to ${email} (Resend not configured)`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '⚠️ SPhoto: Payment failed',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1><span style="color: #dc2626;">S</span>Photo</h1>
        <p>Your last payment has failed.</p>
        <p><strong>Your account has been paused.</strong></p>
        <p>Your data will be kept for 30 days. Update your payment method to continue.</p>
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send export ready email to ${email} (Resend not configured)`);
    return;
  }

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
    subject: '📦 Your SPhoto export is ready',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>Your data export is complete and ready for download.</p>
        
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">📦 Export details:</p>
          <p style="margin: 5px 0;"><strong>Instance:</strong> ${instanceId}</p>
          <p style="margin: 5px 0;"><strong>Size:</strong> ${formatBytes(fileSizeBytes)}</p>
          <p style="margin: 5px 0;"><strong>Valid for:</strong> 24 hours</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${downloadUrl}" 
             style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Start download
          </a>
        </div>
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Important:</strong> The download link is only valid for 24 hours. 
          After that, the file will be automatically deleted.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This export was created in accordance with GDPR Art. 20 (Right to data portability).
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send portal login email to ${email} (Resend not configured)`);
    return;
  }

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
        
        <p>Hello!</p>
        <p>Click the button below to log in to your SPhoto Portal.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Log in to Portal
          </a>
        </div>
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ This link is valid for 24 hours and can only be used once.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you didn't request this login, please ignore this email.
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send account deletion email to ${email} (Resend not configured)`);
    return;
  }

  const formattedDate = new Date(scheduledFor).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '⚠️ SPhoto: Account deletion scheduled',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>You have requested the deletion of your SPhoto account.</p>
        
        <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dc2626;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #dc2626;">🗓️ Deletion scheduled for:</p>
          <p style="margin: 0; font-size: 18px;">${formattedDate}</p>
        </div>
        
        <p><strong>What happens then?</strong></p>
        <ul>
          <li>All your photos and videos will be permanently deleted</li>
          <li>Your account will be completely removed</li>
          <li>Any active subscription will be automatically cancelled</li>
        </ul>
        
        <p style="background: #dcfce7; padding: 10px; border-radius: 4px; font-size: 14px;">
          💡 <strong>Changed your mind?</strong> You can cancel the deletion at any time before the scheduled date 
          in your <a href="https://portal.${env.DOMAIN}" style="color: #dc2626;">SPhoto Portal</a>.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Questions? Contact ${SUPPORT_EMAIL}
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
  const resend = getResend();
  if (!resend) {
    console.log(`[DEV] Would send account deletion cancelled email to ${email} (Resend not configured)`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '✅ SPhoto: Account deletion cancelled',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hello!</p>
        <p>The scheduled deletion of your SPhoto account has been successfully cancelled.</p>
        
        <div style="background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
          <p style="margin: 0; font-weight: bold; color: #166534;">✅ Your account remains active!</p>
        </div>
        
        <p>You can continue using SPhoto as usual.</p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Questions? Contact ${SUPPORT_EMAIL}
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
