import type { Ctx } from '../context';
import { AppError } from '../errors';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import { tierName } from '../plans';
import { createAccount, destroyAccount } from './accounts';

export async function freeSignup(ctx: Ctx, input: { email: string; clientKey: string }): Promise<{ instanceUrl: string }> {
  if (!ctx.rate.allow(`signup:${input.clientKey}`, ctx.config.env.SIGNUPS_PER_HOUR, 3_600_000)) {
    throw new AppError(429, 'Zu viele Anmeldungen. Bitte versuche es später erneut.');
  }
  if (ctx.users.findLiveByEmail(input.email)) {
    throw new AppError(409, 'Diese E-Mail-Adresse ist bereits registriert. Melde dich im Portal an.');
  }
  const { user, password } = await createAccount(ctx, { email: input.email, tier: 'free' });
  const mail = templates.welcome({
    planName: tierName('free'),
    quotaGb: user.quotaGb,
    instanceUrl: ctx.config.instances.free.publicUrl,
    email: user.email,
    password,
    portalUrl: `${ctx.config.publicUrl}/portal`,
  });
  try {
    await ctx.mailer.send({ to: user.email, ...mail });
  } catch (err) {
    // Without the mail the user never learns the password, so undo the signup.
    ctx.log.error('Welcome mail failed, rolling back signup', { error: errorMessage(err) });
    await destroyAccount(ctx, user);
    throw new AppError(502, 'Die Willkommens-E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.');
  }
  return { instanceUrl: ctx.config.instances.free.publicUrl };
}
