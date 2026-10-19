export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  users: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'users', id] as const,
  jobs: ['admin', 'jobs'] as const,
  analytics: (days: number) => ['admin', 'analytics', days] as const,
};
