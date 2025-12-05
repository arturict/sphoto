// =============================================================================
// Stripe Webhook Handler
// =============================================================================

import Stripe from 'stripe';
import type { Request, Response } from 'express';
import type { SessionStatus, Platform, UserTier } from './types';
import { env, PLANS, DEPLOYMENT_MODE, SHARED_INSTANCES, FREE_TIER } from './config';
import { generateId, createInstance, stopInstance } from './instances';
import { 
  createSharedUser, 
  updateSharedUserTier, 
  updateSharedUserStripe,
  getSharedUserByStripeCustomer,
  migrateUserBetweenInstances,
  deleteSharedUser,
} from './shared-users';
import { sendWelcomeEmail, sendWelcomeEmailShared, sendPaymentFailedEmail, sendPlanChangeEmail } from './email';
import { handlePlanChange } from './plan-migration';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Session status store (in-memory)
export const sessionStatus = new Map<string, SessionStatus>();

// =============================================================================
// Webhook Handler
// =============================================================================

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

  console.log(`Event: ${event.type} (Mode: ${DEPLOYMENT_MODE})`);

  try {
    if (DEPLOYMENT_MODE === 'shared') {
      await handleWebhookShared(event, res);
    } else {
      await handleWebhookSiloed(event, res);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// =============================================================================
// Shared Mode Webhook Handler
// =============================================================================

async function handleWebhookShared(event: Stripe.Event, res: Response): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      
      let customerEmail = session.customer_email;
      if (!customerEmail && session.customer) {
        const customer = await stripe.customers.retrieve(session.customer as string);
        if (!('deleted' in customer)) {
          customerEmail = customer.email;
        }
      }
      
      console.log(`Session mode: ${session.mode}, email: ${customerEmail}`);
      sessionStatus.set(sessionId, { status: 'processing', message: 'Erstelle deinen Account...' });
      
      if (session.mode === 'subscription' && customerEmail) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0].price.id;
        const plan = PLANS[priceId];
        
        if (plan) {
          const tier: UserTier = plan.name.toLowerCase() === 'pro' ? 'pro' : 'basic';
          
          console.log(`Creating paid user ${customerEmail} with ${plan.storage}GB quota`);
          sessionStatus.set(sessionId, { status: 'processing', message: 'Erstelle Account auf photos.sphoto.arturf.ch...' });
          
          const result = await createSharedUser(customerEmail, tier, plan.storage);
          
          if (result.success && result.user) {
            // Update Stripe customer metadata
            await stripe.customers.update(session.customer as string, {
              metadata: { 
                sphoto_user_id: result.user.visibleId,
                sphoto_tier: tier,
                deployment_mode: 'shared',
              }
            });
            
            // Store Stripe IDs in our user record
            updateSharedUserStripe(
              result.user.visibleId,
              session.customer as string,
              session.subscription as string
            );
            
            sessionStatus.set(sessionId, { status: 'processing', message: 'Sende Willkommens-E-Mail...' });
            await sendWelcomeEmailShared(
              customerEmail,
              'paid',
              plan.name,
              plan.storage,
              result.password || null
            );
            
            sessionStatus.set(sessionId, { 
              status: 'complete', 
              instanceId: result.user.visibleId,
              instanceUrl: SHARED_INSTANCES.paid.url,
              email: customerEmail,
              plan: plan.name,
              tier,
              autoSetup: true,
            });
            
            console.log(`Paid user ${customerEmail} created successfully`);
          } else {
            sessionStatus.set(sessionId, { 
              status: 'error', 
              message: result.error || 'Account-Erstellung fehlgeschlagen.' 
            });
            console.error(`Failed to create user: ${result.error}`);
          }
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
      
      if (!('deleted' in customer)) {
        const user = getSharedUserByStripeCustomer(invoice.customer as string);
        if (user && customer.email) {
          // For shared mode, we don't stop anything - just notify
          await sendPaymentFailedEmail(customer.email, user.visibleId);
          console.log(`Payment failed notification sent to ${customer.email}`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const user = getSharedUserByStripeCustomer(sub.customer as string);
      
      if (user) {
        // Downgrade to free tier (migrate to free instance)
        console.log(`Subscription cancelled for ${user.email}, migrating to free tier`);
        const result = await migrateUserBetweenInstances(user.visibleId, 'free');
        
        if (result.success) {
          const customer = await stripe.customers.retrieve(sub.customer as string);
          if (!('deleted' in customer) && customer.email) {
            await sendPlanChangeEmail(customer.email, 'Free', FREE_TIER.quotaGB, 'free');
          }
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const user = getSharedUserByStripeCustomer(sub.customer as string);
      
      if (user) {
        const newPriceId = sub.items.data[0]?.price.id;
        const newPlan = newPriceId ? PLANS[newPriceId] : null;
        
        if (newPlan) {
          const newTier: UserTier = newPlan.name.toLowerCase() === 'pro' ? 'pro' : 'basic';
          
          // Update quota (no migration needed - both are on paid instance)
          await updateSharedUserTier(user.visibleId, newTier, newPlan.storage);
          
          const customer = await stripe.customers.retrieve(sub.customer as string);
          if (!('deleted' in customer) && customer.email) {
            await sendPlanChangeEmail(customer.email, newPlan.name, newPlan.storage, 'paid');
          }
          
          console.log(`Plan updated for ${user.email}: ${newPlan.name} (${newPlan.storage}GB)`);
        }
      }
      break;
    }
  }

  res.json({ received: true });
}

// =============================================================================
// Siloed Mode Webhook Handler (Original Logic)
// =============================================================================

async function handleWebhookSiloed(event: Stripe.Event, res: Response): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      
      let customerEmail = session.customer_email;
      if (!customerEmail && session.customer) {
        const customer = await stripe.customers.retrieve(session.customer as string);
        if (!('deleted' in customer)) {
          customerEmail = customer.email;
        }
      }
      
      const platform = (session.metadata?.platform as Platform) || 'immich';
      
      console.log(`Session mode: ${session.mode}, email: ${customerEmail}, platform: ${platform}`);
      sessionStatus.set(sessionId, { status: 'processing', message: 'Erstelle deine Cloud...' });
      
      if (session.mode === 'subscription' && customerEmail) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0].price.id;
        const plan = PLANS[priceId];
        
        if (plan) {
          const customSubdomain = session.metadata?.subdomain;
          const id = customSubdomain || generateId(customerEmail);
          
          console.log(`Creating ${platform} instance ${id} for ${customerEmail}`);
          sessionStatus.set(sessionId, { status: 'processing', message: 'Container werden gestartet...' });
          
          sessionStatus.set(sessionId, { status: 'processing', message: 'Warte auf SSL-Zertifikat...' });
          const result = await createInstance(id, customerEmail, plan, platform);
          
          await stripe.customers.update(session.customer as string, {
            metadata: { sphoto_id: id, platform, deployment_mode: 'siloed' }
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
}

// =============================================================================
// Session Status
// =============================================================================

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  const status = sessionStatus.get(sessionId);
  
  if (status) {
    return status;
  }
  
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

// =============================================================================
// Checkout Session Creation
// =============================================================================

export async function createCheckoutSession(
  plan: 'basic' | 'pro', 
  subdomain?: string,
  platform: Platform = 'immich'
): Promise<string> {
  const priceId = plan === 'pro' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BASIC;
  
  const metadata: Record<string, string> = { 
    platform,
    deployment_mode: DEPLOYMENT_MODE,
  };
  
  // Only include subdomain for siloed mode
  if (DEPLOYMENT_MODE === 'siloed' && subdomain) {
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
