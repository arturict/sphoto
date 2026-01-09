// =============================================================================
// Subdomain Utilities
// =============================================================================

import { existsSync } from 'fs';
import { join } from 'path';
import { listInstances } from './instances';
import { RESERVED_SUBDOMAINS, INSTANCES_DIR } from './config';
import type { SubdomainCheckResult } from './types';

export function isValidSubdomain(subdomain: string): boolean {
  // Only lowercase letters, numbers, hyphens, 3-20 chars, no leading/trailing hyphens
  const regex = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
  return regex.test(subdomain) && !subdomain.includes('--');
}

export function isSubdomainInUse(subdomain: string): boolean {
  // Check if instance exists in memory (has metadata.json)
  const instances = listInstances();
  if (instances.some(i => i.id === subdomain)) {
    return true;
  }
  
  // Also check if directory exists (even without metadata - could be partial/failed deployment)
  const instanceDir = join(INSTANCES_DIR, subdomain);
  if (existsSync(instanceDir)) {
    return true;
  }
  
  return false;
}

export function checkSubdomain(subdomain: string): SubdomainCheckResult {
  const normalized = subdomain.toLowerCase();
  
  // Validate format
  if (!isValidSubdomain(normalized)) {
    return { 
      available: false, 
      reason: 'Ungültiges Format. 3-20 Zeichen, nur Kleinbuchstaben, Zahlen und Bindestriche.' 
    };
  }
  
  // Check reserved
  if (RESERVED_SUBDOMAINS.includes(normalized)) {
    return { available: false, reason: 'Diese Subdomain ist reserviert.' };
  }
  
  // Check if already in use (directory or metadata exists)
  if (isSubdomainInUse(normalized)) {
    return { available: false, reason: 'Diese Subdomain ist bereits vergeben.' };
  }
  
  return { available: true, subdomain: normalized };
}

// Get all used subdomains (for admin overview)
export function getUsedSubdomains(): string[] {
  const instances = listInstances();
  return instances.map(i => i.id);
}

// Get all reserved subdomains
export function getReservedSubdomains(): string[] {
  return [...RESERVED_SUBDOMAINS];
}
