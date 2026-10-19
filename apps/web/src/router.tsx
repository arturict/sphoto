import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { Layout } from './components/Layout';
import { NotFound, RootError } from './components/RouteFallbacks';
import { CheckoutSuccess } from './pages/CheckoutSuccess';
import { Landing } from './pages/Landing';
import { Portal } from './pages/Portal';
import { PortalLogin } from './pages/PortalLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Jobs } from './pages/admin/Jobs';
import { Overview } from './pages/admin/Overview';
import { Stats } from './pages/admin/Stats';
import { UserDetail } from './pages/admin/UserDetail';
import { Users } from './pages/admin/Users';

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: NotFound,
  errorComponent: ({ reset }) => <RootError reset={reset} />,
});

const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Landing });

const checkoutSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout/success',
  validateSearch: z.object({ session_id: z.string().min(1).optional().catch(undefined) }),
  component: CheckoutSuccess,
});

const portalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portal', component: Portal });

const portalLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/portal/login',
  validateSearch: z.object({ token: z.string().min(1).optional().catch(undefined) }),
  component: PortalLogin,
});

const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminLayout });
const adminOverviewRoute = createRoute({ getParentRoute: () => adminRoute, path: '/', component: Overview });
const adminUsersRoute = createRoute({ getParentRoute: () => adminRoute, path: 'users', component: Users });
const adminUserRoute = createRoute({ getParentRoute: () => adminRoute, path: 'users/$id', component: UserDetail });
const adminJobsRoute = createRoute({ getParentRoute: () => adminRoute, path: 'jobs', component: Jobs });
const adminStatsRoute = createRoute({ getParentRoute: () => adminRoute, path: 'stats', component: Stats });

const routeTree = rootRoute.addChildren([
  landingRoute,
  checkoutSuccessRoute,
  portalRoute,
  portalLoginRoute,
  adminRoute.addChildren([adminOverviewRoute, adminUsersRoute, adminUserRoute, adminJobsRoute, adminStatsRoute]),
]);

export const router = createRouter({ routeTree, scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
