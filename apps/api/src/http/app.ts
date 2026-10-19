import { createHash, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  adminDeleteRequestSchema,
  adminSetTierRequestSchema,
  checkoutRequestSchema,
  emailSchema,
  freeSignupRequestSchema,
  loginRequestSchema,
  sessionRequestSchema,
  upgradeRequestSchema,
  type PublicConfig,
} from '@sphoto/shared';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { InvalidWebhookError } from '../billing/billing';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { ImmichError } from '../immich/gateway';
import { runMaintenance } from '../jobs/maintenance';
import { errorMessage } from '../log';
import { plans } from '../plans';
import * as admin from '../services/admin';
import { authenticate, exchangeMagicLink, logout, requestLogin, SESSION_DAYS } from '../services/auth';
import { handleWebhook } from '../services/billing-events';
import { checkoutStatus, startCheckout } from '../services/checkout';
import { exportPartStream, requestExport } from '../services/exports';
import { portalMe, billingPortalUrl, cancelDeletion, requestDeletion, upgradeUrl } from '../services/portal';
import { freeSignup } from '../services/signup';
import { toJobInfo } from '../repos';
import type { User } from '../users';

const SESSION_COOKIE = 'sphoto_session';

type Env = { Variables: { user: User } };

async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, 'Ungültige Anfrage');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? 'Ungültige Anfrage');
  return parsed.data;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

export function createApp(ctx: Ctx): Hono<Env> {
  const app = new Hono<Env>();
  const publicOrigin = new URL(ctx.config.publicUrl).origin;
  const secureCookie = ctx.config.publicUrl.startsWith('https://');

  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
      xFrameOptions: 'DENY',
    }),
  );

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    if (err instanceof z.ZodError) return c.json({ error: 'Ungültige Anfrage' }, 400);
    if (err instanceof ImmichError) {
      ctx.log.error('Immich error', { path: c.req.path, error: err.message });
      return c.json({ error: 'Der Foto-Server ist gerade nicht erreichbar. Bitte versuche es in einigen Minuten erneut.' }, 503);
    }
    ctx.log.error('Unhandled error', { path: c.req.path, error: errorMessage(err) });
    return c.json({ error: 'Interner Fehler' }, 500);
  });

  // Cookie-authenticated writes must come from our own pages.
  const sameOrigin: MiddlewareHandler = async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && origin !== publicOrigin) throw new AppError(403, 'Ungültiger Ursprung');
    await next();
  };

  const portalAuth: MiddlewareHandler<Env> = async (c, next) => {
    const user = authenticate(ctx, getCookie(c, SESSION_COOKIE));
    if (!user) throw new AppError(401, 'Bitte melde dich an');
    c.set('user', user);
    await next();
  };

  const adminAuth: MiddlewareHandler = async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!timingSafeEqual(digest(given), digest(ctx.config.env.ADMIN_API_KEY))) throw new AppError(401, 'Nicht autorisiert');
    await next();
  };

  const clientKey = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'direct';

  // Per-address limits stop one mailbox from being flooded; this one stops one client from flooding many.
  const limitClient = (c: Context, bucket: string) => {
    if (!ctx.rate.allow(`${bucket}:${clientKey(c)}`, ctx.config.env.LOGIN_AND_CHECKOUT_PER_HOUR, 3_600_000)) throw new AppError(429, 'Zu viele Anfragen. Bitte versuche es später erneut.');
  };

  // --- public ------------------------------------------------------------------

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  // Ready once both Immich instances have an admin key; used by the container health check.
  app.get('/api/ready', (c) => {
    const ready = Object.values(ctx.readiness).every((state) => state === 'ready');
    return c.json({ ready, instances: ctx.readiness }, ready ? 200 : 503);
  });

  app.get('/api/config', (c) =>
    c.json({
      plans: plans(ctx.config),
      instances: { free: { url: ctx.config.instances.free.publicUrl }, paid: { url: ctx.config.instances.paid.publicUrl } },
    } satisfies PublicConfig),
  );

  app.post('/api/signup/free', async (c) => {
    const { email } = await body(c, freeSignupRequestSchema);
    return c.json(await freeSignup(ctx, { email, clientKey: clientKey(c) }), 201);
  });

  app.post('/api/checkout', async (c) => {
    limitClient(c, 'checkout');
    const input = await body(c, checkoutRequestSchema);
    return c.json(await startCheckout(ctx, input));
  });

  app.get('/api/checkout/:id', (c) => c.json(checkoutStatus(ctx, c.req.param('id'))));

  app.post('/api/stripe/webhook', async (c) => {
    const raw = await c.req.text();
    let parsed;
    try {
      parsed = await ctx.billing.parseWebhook(raw, c.req.header('stripe-signature'));
    } catch (err) {
      if (err instanceof InvalidWebhookError) throw new AppError(400, 'Ungültige Signatur');
      throw err;
    }
    return c.json({ received: true, outcome: await handleWebhook(ctx, parsed) });
  });

  // --- portal session ----------------------------------------------------------

  app.post('/api/portal/login', async (c) => {
    limitClient(c, 'login');
    const { email } = await body(c, loginRequestSchema);
    await requestLogin(ctx, email);
    return c.json({ ok: true }, 202);
  });

  app.post('/api/portal/session', sameOrigin, async (c) => {
    const { token } = await body(c, sessionRequestSchema);
    const { sessionToken, expiresAt } = exchangeMagicLink(ctx, token);
    setCookie(c, SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: secureCookie,
      path: '/',
      maxAge: SESSION_DAYS * 86_400,
      expires: expiresAt,
    });
    return c.json({ ok: true });
  });

  // --- portal (cookie session) -------------------------------------------------

  const portal = new Hono<Env>();
  portal.use('*', portalAuth);

  portal.get('/me', async (c) => c.json(await portalMe(ctx, c.get('user'))));

  portal.post('/logout', sameOrigin, (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) logout(ctx, token);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  portal.post('/upgrade', sameOrigin, async (c) => {
    const { plan } = await body(c, upgradeRequestSchema);
    return c.json({ url: await upgradeUrl(ctx, c.get('user'), plan) });
  });

  portal.post('/billing', sameOrigin, async (c) => c.json({ url: await billingPortalUrl(ctx, c.get('user')) }));

  portal.post('/export', sameOrigin, (c) => c.json(requestExport(ctx, c.get('user')), 202));

  portal.get('/export/:id/parts/:index', (c) => {
    const index = Number(c.req.param('index'));
    if (!Number.isInteger(index) || index < 0) throw new AppError(404, 'Export nicht gefunden');
    const file = exportPartStream(ctx, c.get('user').id, c.req.param('id'), index);
    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        'content-type': 'application/zip',
        'content-length': String(file.sizeBytes),
        'content-disposition': `attachment; filename="${file.filename}"`,
      },
    });
  });

  portal.post('/delete-account', sameOrigin, async (c) => c.json({ deletionDueAt: await requestDeletion(ctx, c.get('user')) }));

  portal.post('/cancel-deletion', sameOrigin, async (c) => {
    await cancelDeletion(ctx, c.get('user'));
    return c.json({ ok: true });
  });

  app.route('/api/portal', portal);

  // --- admin (bearer key) ------------------------------------------------------

  const adminRoutes = new Hono<Env>();
  adminRoutes.use('*', adminAuth);

  adminRoutes.get('/overview', async (c) => c.json(await admin.overview(ctx)));
  adminRoutes.get('/users', async (c) => c.json(await admin.listUsers(ctx)));
  adminRoutes.get('/users/:id', async (c) => c.json(await admin.userDetail(ctx, c.req.param('id'))));

  adminRoutes.put('/users/:id/tier', async (c) => {
    const { tier } = await body(c, adminSetTierRequestSchema);
    await admin.setTier(ctx, c.req.param('id'), tier);
    return c.json({ ok: true });
  });

  adminRoutes.post('/users/:id/login-link', async (c) => {
    const user = ctx.users.get(c.req.param('id'));
    if (!user || user.status === 'deleted') throw new AppError(404, 'Benutzer nicht gefunden');
    await requestLogin(ctx, emailSchema.parse(user.email));
    return c.json({ ok: true });
  });

  adminRoutes.delete('/users/:id', async (c) => {
    const { confirmEmail } = await body(c, adminDeleteRequestSchema);
    await admin.deleteUserNow(ctx, c.req.param('id'), confirmEmail);
    return c.json({ ok: true });
  });

  adminRoutes.get('/jobs', (c) => c.json(ctx.jobs.listRecent().map((j) => ({ ...toJobInfo(j), userEmail: j.userEmail }))));
  adminRoutes.post('/jobs/run', async (c) => c.json(await runMaintenance(ctx)));

  adminRoutes.get('/analytics', (c) => {
    const days = z.coerce.number().int().min(1).max(365).catch(30).parse(c.req.query('days'));
    return c.json(admin.analytics(ctx, days));
  });

  app.route('/api/admin', adminRoutes);

  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden' }, 404));

  return app;
}
