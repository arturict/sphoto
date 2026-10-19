import {
  adminAnalyticsSchema,
  adminJobListSchema,
  adminOverviewSchema,
  adminUserDetailSchema,
  adminUserListSchema,
  checkoutResponseSchema,
  checkoutStatusSchema,
  deletionResponseSchema,
  exportStartedSchema,
  freeSignupResponseSchema,
  maintenanceReportSchema,
  okSchema,
  portalMeSchema,
  publicConfigSchema,
  urlResponseSchema,
  type PaidTier,
} from '@sphoto/shared';
import { request } from './api';

export const publicApi = {
  config: () => request('/api/config', publicConfigSchema),
  signupFree: (email: string) => request('/api/signup/free', freeSignupResponseSchema, { method: 'POST', body: { email } }),
  startCheckout: (plan: PaidTier, email: string) => request('/api/checkout', checkoutResponseSchema, { method: 'POST', body: { plan, email } }),
  checkoutStatus: (sessionId: string) => request(`/api/checkout/${encodeURIComponent(sessionId)}`, checkoutStatusSchema),
};

export const portalMeKey = ['portal', 'me'] as const;

export const portalApi = {
  me: () => request('/api/portal/me', portalMeSchema),
  requestLogin: (email: string) => request('/api/portal/login', okSchema, { method: 'POST', body: { email } }),
  exchangeToken: (token: string) => request('/api/portal/session', okSchema, { method: 'POST', body: { token } }),
  logout: () => request('/api/portal/logout', okSchema, { method: 'POST' }),
  upgrade: (plan: PaidTier) => request('/api/portal/upgrade', urlResponseSchema, { method: 'POST', body: { plan } }),
  billing: () => request('/api/portal/billing', urlResponseSchema, { method: 'POST' }),
  requestExport: () => request('/api/portal/export', exportStartedSchema, { method: 'POST' }),
  deleteAccount: () => request('/api/portal/delete-account', deletionResponseSchema, { method: 'POST' }),
  cancelDeletion: () => request('/api/portal/cancel-deletion', okSchema, { method: 'POST' }),
};

export const exportPartUrl = (exportId: string, index: number): string => `/api/portal/export/${encodeURIComponent(exportId)}/parts/${index}`;

export const adminApi = {
  overview: (adminKey: string) => request('/api/admin/overview', adminOverviewSchema, { adminKey }),
  users: (adminKey: string) => request('/api/admin/users', adminUserListSchema, { adminKey }),
  user: (adminKey: string, id: string) => request(`/api/admin/users/${encodeURIComponent(id)}`, adminUserDetailSchema, { adminKey }),
  setTier: (adminKey: string, id: string, tier: PaidTier) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/tier`, okSchema, { adminKey, method: 'PUT', body: { tier } }),
  sendLoginLink: (adminKey: string, id: string) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/login-link`, okSchema, { adminKey, method: 'POST' }),
  deleteUser: (adminKey: string, id: string, confirmEmail: string) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, okSchema, { adminKey, method: 'DELETE', body: { confirmEmail } }),
  jobs: (adminKey: string) => request('/api/admin/jobs', adminJobListSchema, { adminKey }),
  runMaintenance: (adminKey: string) => request('/api/admin/jobs/run', maintenanceReportSchema, { adminKey, method: 'POST' }),
  analytics: (adminKey: string, days: 30 | 90) => request(`/api/admin/analytics?days=${days}`, adminAnalyticsSchema, { adminKey }),
};
