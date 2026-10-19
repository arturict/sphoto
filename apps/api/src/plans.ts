import type { InstanceName, Plan, Tier } from '@sphoto/shared';
import type { Config } from './config';

export const tierInstance = (tier: Tier): InstanceName => (tier === 'free' ? 'free' : 'paid');

export const tierName = (tier: Tier): string => ({ free: 'Free', basic: 'Basic', pro: 'Pro' })[tier];

export const gbToBytes = (gb: number): number => Math.round(gb * 1024 ** 3);

export function plans(config: Config): Plan[] {
  return (['free', 'basic', 'pro'] as const).map((id) => ({
    id,
    name: tierName(id),
    priceChfPerMonth: id === 'free' ? 0 : config.priceChf[id],
    storageGb: config.quotaGb[id],
    hasMl: id !== 'free',
  }));
}

export function tierForPriceId(config: Config, priceId: string): 'basic' | 'pro' | null {
  if (priceId === config.stripePrices.basic) return 'basic';
  if (priceId === config.stripePrices.pro) return 'pro';
  return null;
}
