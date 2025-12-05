// =============================================================================
// Scheduled Maintenance System
// =============================================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Resend } from 'resend';
import { env, INSTANCES_DIR } from './config';
import { listInstances, getInstance } from './instances';
import type { InstanceMetadata } from './types';

const resend = new Resend(env.RESEND_API_KEY);

// =============================================================================
// Types
// =============================================================================

export type MaintenanceType = 'update' | 'backup' | 'migration' | 'emergency';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Maintenance {
  id: string;
  title: string;
  description: string;
  type: MaintenanceType;
  scheduledStart: string;
  scheduledEnd: string;
  affectedInstances: string[] | 'all';
  status: MaintenanceStatus;
  notificationsSent: {
    scheduled: boolean;
    reminder: boolean;
    started: boolean;
    completed: boolean;
  };
  createdAt: string;
  createdBy: string;
  actualStart?: string;
  actualEnd?: string;
}

export interface MaintenanceCreateInput {
  title: string;
  description: string;
  type: MaintenanceType;
  scheduledStart: string;
  scheduledEnd: string;
  affectedInstances: string[] | 'all';
  createdBy: string;
}

export interface PublicStatus {
  operational: boolean;
  activeMaintenance: {
    id: string;
    title: string;
    description: string;
    type: MaintenanceType;
    expectedEnd: string;
  } | null;
  scheduledMaintenance: Array<{
    id: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    type: MaintenanceType;
  }>;
}

// =============================================================================
// Storage
// =============================================================================

const MAINTENANCE_DIR = join(INSTANCES_DIR, '..', 'maintenance');
const MAINTENANCE_FILE = join(MAINTENANCE_DIR, 'maintenance.json');

function ensureMaintenanceDir(): void {
  if (!existsSync(MAINTENANCE_DIR)) {
    mkdirSync(MAINTENANCE_DIR, { recursive: true });
  }
}

function loadMaintenances(): Maintenance[] {
  ensureMaintenanceDir();
  if (!existsSync(MAINTENANCE_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(MAINTENANCE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMaintenances(maintenances: Maintenance[]): void {
  ensureMaintenanceDir();
  writeFileSync(MAINTENANCE_FILE, JSON.stringify(maintenances, null, 2));
}

function generateId(): string {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// =============================================================================
// Email Functions
// =============================================================================

async function sendMaintenanceScheduledEmail(
  email: string,
  maintenance: Maintenance
): Promise<void> {
  const startDate = new Date(maintenance.scheduledStart);
  const endDate = new Date(maintenance.scheduledEnd);
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  
  const typeLabels: Record<MaintenanceType, string> = {
    update: 'Software-Update',
    backup: 'Backup-Wartung',
    migration: 'Server-Migration',
    emergency: 'Notfall-Wartung',
  };
  
  const typeIcons: Record<MaintenanceType, string> = {
    update: '🔧',
    backup: '💾',
    migration: '🚀',
    emergency: '⚠️',
  };
  
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${typeIcons[maintenance.type]} SPhoto: Geplante Wartung am ${startDate.toLocaleDateString('de-CH')}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #fef3c7; border: 1px solid #ca8a04; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #854d0e;">
            ${typeIcons[maintenance.type]} ${typeLabels[maintenance.type]}
          </p>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">
            ${maintenance.title}
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;">
            <strong>Datum:</strong> ${startDate.toLocaleDateString('de-CH')}
          </p>
          <p style="margin: 0 0 10px 0;">
            <strong>Zeit:</strong> ${startDate.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
          <p style="margin: 0;">
            <strong>Geschätzte Dauer:</strong> ${duration} Minuten
          </p>
        </div>
        
        <p><strong>Beschreibung:</strong></p>
        <p>${maintenance.description}</p>
        
        ${maintenance.type !== 'backup' ? `
          <p style="background: #fef2f2; padding: 10px; border-radius: 4px; font-size: 14px;">
            ⚠️ Während dieser Zeit ist deine SPhoto-Instanz möglicherweise nicht erreichbar.
          </p>
        ` : ''}
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Maintenance scheduled email sent to ${email}`);
}

async function sendMaintenanceReminderEmail(
  email: string,
  maintenance: Maintenance
): Promise<void> {
  const startDate = new Date(maintenance.scheduledStart);
  
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `⏰ SPhoto: Wartung beginnt in 2 Stunden`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #fef3c7; border: 1px solid #ca8a04; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #854d0e;">
            ⏰ Erinnerung: Wartung in 2 Stunden
          </p>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">
            ${maintenance.title}
          </p>
        </div>
        
        <p>
          Die geplante Wartung beginnt um <strong>${startDate.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr</strong>.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Maintenance reminder email sent to ${email}`);
}

async function sendMaintenanceStartedEmail(
  email: string,
  maintenance: Maintenance
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `🔧 SPhoto: Wartung gestartet`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #fef3c7; border: 1px solid #ca8a04; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #854d0e;">
            🔧 Wartung läuft
          </p>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">
            ${maintenance.title}
          </p>
        </div>
        
        <p>
          Die Wartung hat begonnen. Voraussichtliches Ende: 
          <strong>${new Date(maintenance.scheduledEnd).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr</strong>
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Maintenance started email sent to ${email}`);
}

async function sendMaintenanceCompletedEmail(
  email: string,
  maintenance: Maintenance
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `✅ SPhoto: Wartung abgeschlossen`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534;">
            ✅ Wartung abgeschlossen
          </p>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">
            ${maintenance.title}
          </p>
        </div>
        
        <p>
          Die Wartung wurde erfolgreich abgeschlossen. Deine SPhoto-Instanz ist wieder normal erreichbar.
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Maintenance completed email sent to ${email}`);
}

// =============================================================================
// Helper Functions
// =============================================================================

function getAffectedEmails(maintenance: Maintenance): string[] {
  const instances = listInstances();
  
  if (maintenance.affectedInstances === 'all') {
    return instances
      .filter(i => i.status === 'active')
      .map(i => i.email);
  }
  
  return instances
    .filter(i => maintenance.affectedInstances.includes(i.id) && i.status === 'active')
    .map(i => i.email);
}

async function sendNotificationToAll(
  maintenance: Maintenance,
  sendFn: (email: string, m: Maintenance) => Promise<void>
): Promise<void> {
  const emails = getAffectedEmails(maintenance);
  const uniqueEmails = [...new Set(emails)];
  
  for (const email of uniqueEmails) {
    try {
      await sendFn(email, maintenance);
    } catch (err) {
      console.error(`Failed to send notification to ${email}:`, err);
    }
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

export function listMaintenances(): Maintenance[] {
  return loadMaintenances().sort((a, b) => 
    new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()
  );
}

export function getMaintenance(id: string): Maintenance | null {
  const maintenances = loadMaintenances();
  return maintenances.find(m => m.id === id) || null;
}

export async function createMaintenance(input: MaintenanceCreateInput): Promise<Maintenance> {
  const maintenances = loadMaintenances();
  
  const maintenance: Maintenance = {
    id: generateId(),
    title: input.title,
    description: input.description,
    type: input.type,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    affectedInstances: input.affectedInstances,
    status: 'scheduled',
    notificationsSent: {
      scheduled: false,
      reminder: false,
      started: false,
      completed: false,
    },
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  
  maintenances.push(maintenance);
  saveMaintenances(maintenances);
  
  // Send scheduled notification if maintenance is more than 2 hours away
  const hoursUntilStart = (new Date(maintenance.scheduledStart).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart > 2) {
    await sendNotificationToAll(maintenance, sendMaintenanceScheduledEmail);
    maintenance.notificationsSent.scheduled = true;
    saveMaintenances(maintenances);
  }
  
  return maintenance;
}

export async function updateMaintenance(id: string, updates: Partial<MaintenanceCreateInput>): Promise<Maintenance | null> {
  const maintenances = loadMaintenances();
  const index = maintenances.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  const maintenance = maintenances[index];
  
  if (maintenance.status !== 'scheduled') {
    throw new Error('Can only update scheduled maintenances');
  }
  
  if (updates.title) maintenance.title = updates.title;
  if (updates.description) maintenance.description = updates.description;
  if (updates.type) maintenance.type = updates.type;
  if (updates.scheduledStart) maintenance.scheduledStart = updates.scheduledStart;
  if (updates.scheduledEnd) maintenance.scheduledEnd = updates.scheduledEnd;
  if (updates.affectedInstances) maintenance.affectedInstances = updates.affectedInstances;
  
  saveMaintenances(maintenances);
  return maintenance;
}

export async function cancelMaintenance(id: string): Promise<Maintenance | null> {
  const maintenances = loadMaintenances();
  const index = maintenances.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  const maintenance = maintenances[index];
  
  if (maintenance.status === 'completed' || maintenance.status === 'cancelled') {
    throw new Error('Maintenance already completed or cancelled');
  }
  
  maintenance.status = 'cancelled';
  saveMaintenances(maintenances);
  
  return maintenance;
}

export async function startMaintenance(id: string): Promise<Maintenance | null> {
  const maintenances = loadMaintenances();
  const index = maintenances.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  const maintenance = maintenances[index];
  
  if (maintenance.status !== 'scheduled') {
    throw new Error('Can only start scheduled maintenances');
  }
  
  maintenance.status = 'in_progress';
  maintenance.actualStart = new Date().toISOString();
  
  // Send started notification
  if (!maintenance.notificationsSent.started) {
    await sendNotificationToAll(maintenance, sendMaintenanceStartedEmail);
    maintenance.notificationsSent.started = true;
  }
  
  saveMaintenances(maintenances);
  return maintenance;
}

export async function completeMaintenance(id: string): Promise<Maintenance | null> {
  const maintenances = loadMaintenances();
  const index = maintenances.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  const maintenance = maintenances[index];
  
  if (maintenance.status !== 'in_progress' && maintenance.status !== 'scheduled') {
    throw new Error('Can only complete in-progress or scheduled maintenances');
  }
  
  maintenance.status = 'completed';
  maintenance.actualEnd = new Date().toISOString();
  
  // Send completed notification
  if (!maintenance.notificationsSent.completed) {
    await sendNotificationToAll(maintenance, sendMaintenanceCompletedEmail);
    maintenance.notificationsSent.completed = true;
  }
  
  saveMaintenances(maintenances);
  return maintenance;
}

export function getPublicStatus(): PublicStatus {
  const maintenances = loadMaintenances();
  const now = Date.now();
  
  // Find active maintenance
  const activeMaintenance = maintenances.find(m => m.status === 'in_progress');
  
  // Find scheduled maintenances (next 7 days)
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const scheduledMaintenance = maintenances
    .filter(m => 
      m.status === 'scheduled' && 
      new Date(m.scheduledStart).getTime() > now &&
      new Date(m.scheduledStart).getTime() < sevenDaysFromNow
    )
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      title: m.title,
      scheduledStart: m.scheduledStart,
      scheduledEnd: m.scheduledEnd,
      type: m.type,
    }));
  
  return {
    operational: !activeMaintenance,
    activeMaintenance: activeMaintenance ? {
      id: activeMaintenance.id,
      title: activeMaintenance.title,
      description: activeMaintenance.description,
      type: activeMaintenance.type,
      expectedEnd: activeMaintenance.scheduledEnd,
    } : null,
    scheduledMaintenance,
  };
}

// =============================================================================
// Scheduled Tasks
// =============================================================================

export async function checkMaintenanceNotifications(): Promise<void> {
  const maintenances = loadMaintenances();
  const now = Date.now();
  let changed = false;
  
  for (const maintenance of maintenances) {
    if (maintenance.status !== 'scheduled') continue;
    
    const startTime = new Date(maintenance.scheduledStart).getTime();
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
    
    // Send 48h notification
    if (!maintenance.notificationsSent.scheduled && hoursUntilStart <= 48 && hoursUntilStart > 2) {
      await sendNotificationToAll(maintenance, sendMaintenanceScheduledEmail);
      maintenance.notificationsSent.scheduled = true;
      changed = true;
    }
    
    // Send 2h reminder
    if (!maintenance.notificationsSent.reminder && hoursUntilStart <= 2 && hoursUntilStart > 0) {
      await sendNotificationToAll(maintenance, sendMaintenanceReminderEmail);
      maintenance.notificationsSent.reminder = true;
      changed = true;
    }
    
    // Auto-start at scheduled time
    if (now >= startTime && maintenance.status === 'scheduled') {
      maintenance.status = 'in_progress';
      maintenance.actualStart = new Date().toISOString();
      
      if (!maintenance.notificationsSent.started) {
        await sendNotificationToAll(maintenance, sendMaintenanceStartedEmail);
        maintenance.notificationsSent.started = true;
      }
      changed = true;
    }
  }
  
  // Auto-complete at scheduled end time
  for (const maintenance of maintenances) {
    if (maintenance.status !== 'in_progress') continue;
    
    const endTime = new Date(maintenance.scheduledEnd).getTime();
    if (now >= endTime) {
      maintenance.status = 'completed';
      maintenance.actualEnd = new Date().toISOString();
      
      if (!maintenance.notificationsSent.completed) {
        await sendNotificationToAll(maintenance, sendMaintenanceCompletedEmail);
        maintenance.notificationsSent.completed = true;
      }
      changed = true;
    }
  }
  
  if (changed) {
    saveMaintenances(maintenances);
  }
}
