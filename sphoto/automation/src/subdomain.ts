// =============================================================================
// Subdomain Utilities
// =============================================================================

import { listInstances } from './instances';
import { RESERVED_SUBDOMAINS } from './config';
import type { SubdomainCheckResult } from './types';

export function isValidSubdomain(subdomain: string): boolean {
  // Only lowercase letters, numbers, hyphens, 3-20 chars, no leading/trailing hyphens
  const regex = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
  return regex.test(subdomain) && !subdomain.includes('--');
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
  
  // Check if already exists
  const instances = listInstances();
  const exists = instances.some(i => i.id === normalized);
  
  if (exists) {
    return { available: false, reason: 'Diese Subdomain ist bereits vergeben.' };
  }
  
  return { available: true, subdomain: normalized };
}
