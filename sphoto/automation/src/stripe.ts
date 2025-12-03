// =============================================================================
// Stripe Webhook Handler
// =============================================================================

import Stripe from 'stripe';
import type { Request, Response } from 'express';
import type { SessionStatus, Platform } from './types';
import { env, PLANS } from './config';
import { generateId, createInstance } from './instances';
import { sendWelcomeEmail, sendPaymentFailedEmail } from './email';
import { stopInstance } from './instances';
import { handlePlanChange } from './plan-migration';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Session status store (in-memory)
export const sessionStatus = new Map<string, SessionStatus>();

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed');
    res.status(400).send('Webhook Error');
    return;
  }

  console.log(`Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionId = session.id;
        
        // Get email from customer object if not directly on session
        let customerEmail = session.customer_email;
        if (!customerEmail && session.customer) {
          const customer = await stripe.customers.retrieve(session.customer as string);
          if (!('deleted' in customer)) {
            customerEmail = customer.email;
          }
        }
        
        // Get platform from metadata (default to immich)
        const platform = (session.metadata?.platform as Platform) || 'immich';
        
        console.log(`Session mode: ${session.mode}, email: ${customerEmail}, platform: ${platform}`);
        
        sessionStatus.set(sessionId, { status: 'processing', message: 'Erstelle deine Cloud...' });
        
        if (session.mode === 'subscription' && customerEmail) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = sub.items.data[0].price.id;
          const plan = PLANS[priceId];
          
          console.log(`Price ID from Stripe: ${priceId}`);
          console.log(`Plan found: ${plan ? plan.name : 'NOT FOUND'}`);
          
          if (plan) {
            // Use custom subdomain from metadata or generate one
            const customSubdomain = session.metadata?.subdomain;
            const id = customSubdomain || generateId(customerEmail);
            
            console.log(`Creating ${platform} instance ${id} for ${customerEmail}`);
            sessionStatus.set(sessionId, { status: 'processing', message: 'Container werden gestartet...' });
            
            sessionStatus.set(sessionId, { status: 'processing', message: 'Warte auf SSL-Zertifikat...' });
            const result = await createInstance(id, customerEmail, plan, platform);
            
            await stripe.customers.update(session.customer as string, {
              metadata: { sphoto_id: id, platform }
            });
            
            sessionStatus.set(sessionId, { status: 'processing', message: 'Sende Willkommens-E-Mail...' });
            await sendWelcomeEmail(customerEmail, id, plan.name, plan.storage, result.password, platform);
            
            sessionStatus.set(sessionId, { 
              status: 'complete', 
              instanceId: id,
              instanceUrl: `https://${id}.${env.DOMAIN}`,
              email: customerEmail,
              plan: plan.name,
              platform,
              autoSetup: result.success
            });
            
            console.log(`${platform} instance ${id} created for ${customerEmail}`);
          } else {
            sessionStatus.set(sessionId, { 
              status: 'error', 
              message: 'Plan nicht erkannt. Bitte kontaktiere den Support.' 
            });
            console.error(`Unknown price ID: ${priceId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await stripe.customers.retrieve(invoice.customer as string);
        if (!('deleted' in customer) && customer.metadata?.sphoto_id) {
          await stopInstance(customer.metadata.sphoto_id);
          if (customer.email) {
            await sendPaymentFailedEmail(customer.email, customer.metadata.sphoto_id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        if (!('deleted' in customer) && customer.metadata?.sphoto_id) {
          await stopInstance(customer.metadata.sphoto_id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        if (!('deleted' in customer) && customer.metadata?.sphoto_id) {
          const newPriceId = sub.items.data[0]?.price.id;
          if (newPriceId) {
            await handlePlanChange(customer.metadata.sphoto_id, newPriceId);
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  const status = sessionStatus.get(sessionId);
  
  if (status) {
    return status;
  }
  
  // Check if session exists in Stripe
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      return { status: 'processing', message: 'Zahlung erhalten, erstelle Cloud...' };
    }
    return { status: 'pending', message: 'Warte auf Zahlung...' };
  } catch {
    return { status: 'unknown', message: 'Session nicht gefunden' };
  }
}

export async function createCheckoutSession(
  plan: 'basic' | 'pro', 
  subdomain?: string,
  platform: Platform = 'immich'
): Promise<string> {
  const priceId = plan === 'pro' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BASIC;
  
  const metadata: Record<string, string> = { platform };
  if (subdomain) {
    metadata.subdomain = subdomain;
  }
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `https://${env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://${env.DOMAIN}`,
    metadata,
  });
  
  return session.url!;
}
