// =============================================================================
// Resend Client - Lazy Initialization
// =============================================================================
// Allows running without Resend configured (for local dev)

import { Resend } from 'resend';
import { env } from '../config';

let _resend: Resend | null = null;

/**
 * Get the Resend client instance.
 * Returns null if RESEND_API_KEY is not configured.
 */
export function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Check if Resend is configured and available.
 */
export function isResendConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

/**
 * Get Resend client or throw an error.
 * Use this when Resend is required for an operation.
 */
export function requireResend(): Resend {
  const resend = getResend();
  if (!resend) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY environment variable.');
  }
  return resend;
}
