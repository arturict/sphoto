import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { clearAdminKey } from './admin-key';
import { ApiError } from './api';

// An admin request rejected with 401 means the stored key is wrong or was rotated:
// dropping it sends the user back to the key form.
function dropRejectedAdminKey(error: Error, key: readonly unknown[] | undefined): void {
  if (error instanceof ApiError && error.status === 401 && key?.[0] === 'admin') clearAdminKey();
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => dropRejectedAdminKey(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => dropRejectedAdminKey(error, mutation.options.mutationKey) }),
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
}
