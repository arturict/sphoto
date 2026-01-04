// =============================================================================
// Stripe Client - Lazy Initialization
// =============================================================================
// Allows running without Stripe configured (for local dev)

import Stripe from 'stripe';
import { env } from '../config';

let _stripe: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Returns null if STRIPE_SECRET_KEY is not configured.
 * Use isStripeConfigured() to check before calling Stripe-dependent code.
 */
export function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) {
    return null;
  }
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

/**
 * Check if Stripe is configured and available.
 */
export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

/**
 * Get Stripe client or throw an error.
 * Use this when Stripe is required for an operation.
 */
export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}
