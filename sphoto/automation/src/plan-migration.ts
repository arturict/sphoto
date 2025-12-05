// =============================================================================
// Plan Migration System
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import Stripe from 'stripe';
import { env, INSTANCES_DIR, EXTERNAL_STORAGE_PATH, PLANS } from './config';
import { getInstance, getDirectorySize } from './instances';
import { Resend } from 'resend';
import type { InstanceMetadata } from './types';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const resend = new Resend(env.RESEND_API_KEY);

// =============================================================================
// Types
// =============================================================================

export interface PlanInfo {
  currentPlan: string;
  storageGb: number;
  usedBytes: number;
  usedGb: number;
  percentage: number;
  canDowngrade: boolean;
  downgradeBlockReason?: string;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  newPlan?: string;
  effectiveAt?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getStorageUsage(instanceId: string, storageGb: number): Promise<{ usedBytes: number; percentage: number }> {
  let uploadsPath: string;
  if (EXTERNAL_STORAGE_PATH) {
    uploadsPath = join(EXTERNAL_STORAGE_PATH, instanceId, 'uploads');
  } else {
    uploadsPath = join(INSTANCES_DIR, instanceId, 'uploads');
  }
  
  if (!existsSync(uploadsPath)) {
    return { usedBytes: 0, percentage: 0 };
  }
  
  const usedBytes = await getDirectorySize(uploadsPath);
  const limitBytes = storageGb * 1024 * 1024 * 1024;
  const percentage = Math.round((usedBytes / limitBytes) * 100);
  
  return { usedBytes, percentage };
}

function getStorageLimit(plan: string): number {
  if (plan.toLowerCase() === 'pro') return 1000;
  return 200; // Basic
}

async function updateInstanceMetadata(instanceId: string, newPlan: string, newStorageGb: number): Promise<void> {
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  if (!existsSync(metaPath)) {
    throw new Error('Instance not found');
  }
  
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.plan = newPlan;
  meta.storage_gb = newStorageGb;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

async function updateImmichQuota(instanceId: string, quotaBytes: number): Promise<boolean> {
  const instance = getInstance(instanceId);
  if (!instance || instance.platform !== 'immich' || !instance.immichApiKey) {
    return false;
  }
  
  const instanceUrl = `https://${instanceId}.${env.DOMAIN}`;
  
  try {
    // Get admin user ID
    const usersRes = await fetch(`${instanceUrl}/api/admin/users`, {
      headers: { 'x-api-key': instance.immichApiKey },
    });
    
    if (!usersRes.ok) return false;
    
    const users = await usersRes.json() as Array<{ id: string; isAdmin: boolean }>;
    const adminUser = users.find(u => u.isAdmin);
    
    if (!adminUser) return false;
    
    // Update quota
    const updateRes = await fetch(`${instanceUrl}/api/admin/users/${adminUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': instance.immichApiKey,
      },
      body: JSON.stringify({ quotaSizeInBytes: quotaBytes }),
    });
    
    return updateRes.ok;
  } catch {
    return false;
  }
}

async function updateNextcloudQuota(instanceId: string, quotaGb: number): Promise<boolean> {
  const instance = getInstance(instanceId);
  if (!instance || instance.platform !== 'nextcloud') {
    return false;
  }
  
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const containerId = `sphoto-${instanceId}-app`;
    const quotaBytes = BigInt(quotaGb) * BigInt(1024) * BigInt(1024) * BigInt(1024);
    const adminUser = instance.nextcloudAdminUser || 'admin';
    
    await execAsync(`docker exec -u www-data ${containerId} php occ user:setting ${adminUser} files quota "${quotaBytes.toString()}"`);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Email Functions
// =============================================================================

async function sendUpgradeConfirmationEmail(
  email: string,
  instanceId: string,
  oldPlan: string,
  newPlan: string,
  newStorageGb: number
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '🚀 SPhoto: Upgrade erfolgreich!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">
            🚀 Upgrade erfolgreich!
          </p>
          <p style="margin: 0;">
            Dein Plan wurde von <strong>${oldPlan}</strong> auf <strong>${newPlan}</strong> geändert.
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Neuer Speicherplatz:</strong> ${newStorageGb} GB</p>
          <p style="margin: 0;"><strong>Instanz:</strong> ${instanceId}.${env.DOMAIN}</p>
        </div>
        
        <p>Die Änderung ist sofort wirksam. Du kannst jetzt mehr Fotos und Videos hochladen!</p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Upgrade confirmation email sent to ${email}`);
}

async function sendDowngradeConfirmationEmail(
  email: string,
  instanceId: string,
  oldPlan: string,
  newPlan: string,
  newStorageGb: number,
  effectiveDate: string
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '📦 SPhoto: Plan-Änderung bestätigt',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #fef3c7; border: 1px solid #ca8a04; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #854d0e;">
            📦 Downgrade geplant
          </p>
          <p style="margin: 0;">
            Dein Plan wird von <strong>${oldPlan}</strong> auf <strong>${newPlan}</strong> geändert.
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Neuer Speicherplatz:</strong> ${newStorageGb} GB</p>
          <p style="margin: 0 0 10px 0;"><strong>Wirksam ab:</strong> ${new Date(effectiveDate).toLocaleDateString('de-CH')}</p>
          <p style="margin: 0;"><strong>Instanz:</strong> ${instanceId}.${env.DOMAIN}</p>
        </div>
        
        <p>Die Änderung wird zum Ende deines aktuellen Abrechnungszeitraums wirksam.</p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Downgrade confirmation email sent to ${email}`);
}

// =============================================================================
// Public API Functions
// =============================================================================

export async function getPlanInfo(instanceId: string): Promise<PlanInfo | null> {
  const instance = getInstance(instanceId);
  if (!instance) return null;
  
  const storageGb = instance.storage_gb;
  const { usedBytes, percentage } = await getStorageUsage(instanceId, storageGb);
  const usedGb = usedBytes / (1024 * 1024 * 1024);
  
  const basicLimitGb = 200;
  const canDowngrade = instance.plan.toLowerCase() === 'basic' || usedGb < basicLimitGb;
  
  return {
    currentPlan: instance.plan,
    storageGb,
    usedBytes,
    usedGb: Math.round(usedGb * 10) / 10,
    percentage,
    canDowngrade,
    downgradeBlockReason: !canDowngrade 
      ? `Du nutzt ${Math.round(usedGb)} GB. Lösche erst ${Math.round(usedGb - basicLimitGb)} GB um auf Basic (${basicLimitGb} GB) zu wechseln.`
      : undefined,
  };
}

export async function checkDowngradePossible(instanceId: string): Promise<{ possible: boolean; reason?: string }> {
  const planInfo = await getPlanInfo(instanceId);
  if (!planInfo) {
    return { possible: false, reason: 'Instance not found' };
  }
  
  if (planInfo.currentPlan.toLowerCase() === 'basic') {
    return { possible: false, reason: 'Already on Basic plan' };
  }
  
  const basicLimitGb = 200;
  if (planInfo.usedGb >= basicLimitGb) {
    return {
      possible: false,
      reason: `Aktuelle Nutzung: ${planInfo.usedGb.toFixed(1)} GB. Basic Limit: ${basicLimitGb} GB. Bitte lösche ${(planInfo.usedGb - basicLimitGb).toFixed(1)} GB.`,
    };
  }
  
  return { possible: true };
}

export async function upgradePlan(
  instanceId: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<MigrationResult> {
  const instance = getInstance(instanceId);
  if (!instance) {
    return { success: false, message: 'Instance not found' };
  }
  
  if (instance.plan.toLowerCase() === 'pro') {
    return { success: false, message: 'Already on Pro plan' };
  }
  
  const newStorageGb = 1000;
  const quotaBytes = newStorageGb * 1024 * 1024 * 1024;
  
  // Update Stripe subscription if provided
  if (stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const subscriptionItemId = subscription.items.data[0]?.id;
      
      if (subscriptionItemId) {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          items: [{
            id: subscriptionItemId,
            price: env.STRIPE_PRICE_PRO,
          }],
          proration_behavior: 'create_prorations',
        });
      }
    } catch (err) {
      console.error('Stripe upgrade error:', err);
      return { success: false, message: 'Stripe subscription update failed' };
    }
  }
  
  // Update instance quota
  if (instance.platform === 'immich') {
    await updateImmichQuota(instanceId, quotaBytes);
  } else if (instance.platform === 'nextcloud') {
    await updateNextcloudQuota(instanceId, newStorageGb);
  }
  
  // Update metadata
  await updateInstanceMetadata(instanceId, 'Pro', newStorageGb);
  
  // Send confirmation email
  await sendUpgradeConfirmationEmail(instance.email, instanceId, instance.plan, 'Pro', newStorageGb);
  
  return {
    success: true,
    message: 'Upgrade successful',
    newPlan: 'Pro',
    effectiveAt: new Date().toISOString(),
  };
}

export async function downgradePlan(
  instanceId: string,
  stripeSubscriptionId?: string
): Promise<MigrationResult> {
  const instance = getInstance(instanceId);
  if (!instance) {
    return { success: false, message: 'Instance not found' };
  }
  
  if (instance.plan.toLowerCase() === 'basic') {
    return { success: false, message: 'Already on Basic plan' };
  }
  
  // Check if downgrade is possible
  const check = await checkDowngradePossible(instanceId);
  if (!check.possible) {
    return { success: false, message: check.reason || 'Downgrade not possible' };
  }
  
  const newStorageGb = 200;
  let effectiveDate = new Date().toISOString();
  
  // Update Stripe subscription if provided (downgrade at end of period)
  if (stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const subscriptionItemId = subscription.items.data[0]?.id;
      
      if (subscriptionItemId) {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          items: [{
            id: subscriptionItemId,
            price: env.STRIPE_PRICE_BASIC,
          }],
          proration_behavior: 'none',
        });
        
        // Downgrade takes effect at end of billing period
        effectiveDate = new Date(subscription.current_period_end * 1000).toISOString();
      }
    } catch (err) {
      console.error('Stripe downgrade error:', err);
      return { success: false, message: 'Stripe subscription update failed' };
    }
  }
  
  // For immediate downgrade (no Stripe), update now
  if (!stripeSubscriptionId) {
    const quotaBytes = newStorageGb * 1024 * 1024 * 1024;
    
    if (instance.platform === 'immich') {
      await updateImmichQuota(instanceId, quotaBytes);
    } else if (instance.platform === 'nextcloud') {
      await updateNextcloudQuota(instanceId, newStorageGb);
    }
    
    await updateInstanceMetadata(instanceId, 'Basic', newStorageGb);
  }
  
  // Send confirmation email
  await sendDowngradeConfirmationEmail(
    instance.email,
    instanceId,
    instance.plan,
    'Basic',
    newStorageGb,
    effectiveDate
  );
  
  return {
    success: true,
    message: stripeSubscriptionId ? 'Downgrade scheduled' : 'Downgrade successful',
    newPlan: 'Basic',
    effectiveAt: effectiveDate,
  };
}

// Called by Stripe webhook when subscription is updated
export async function handlePlanChange(
  instanceId: string,
  newPriceId: string
): Promise<void> {
  const plan = PLANS[newPriceId];
  if (!plan) {
    console.error(`Unknown price ID: ${newPriceId}`);
    return;
  }
  
  const instance = getInstance(instanceId);
  if (!instance) {
    console.error(`Instance not found: ${instanceId}`);
    return;
  }
  
  const quotaBytes = plan.storage * 1024 * 1024 * 1024;
  
  // Update instance quota
  if (instance.platform === 'immich') {
    await updateImmichQuota(instanceId, quotaBytes);
  } else if (instance.platform === 'nextcloud') {
    await updateNextcloudQuota(instanceId, plan.storage);
  }
  
  // Update metadata
  await updateInstanceMetadata(instanceId, plan.name, plan.storage);
  
  console.log(`Plan changed for ${instanceId}: ${instance.plan} -> ${plan.name}`);
}
