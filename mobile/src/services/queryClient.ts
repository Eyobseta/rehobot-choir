import { QueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';

/**
 * One QueryClient for the whole app.
 *
 * Policy (matches the requirement that cached data must survive app restarts,
 * offline usage, and only be evicted on logout / OS-level cache clear):
 *   - gcTime: Infinity   -> in-memory query state never garbage-collected by age.
 *   - staleTime: 0       -> every render is stale; revalidation always runs in bg.
 *   - networkMode: 'offlineFirst' -> serve cache immediately; retry when online.
 *   - retry: 5xx only, max 2 -> do not hammer the server on 4xx (auth, validation).
 *
 * Persistence is wired separately in `queryPersister.ts` — this file only owns
 * the in-memory store + focus/online managers.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status ?? 0;
        if (status >= 400 && status < 500) return false; // client errors: don't retry
        return failureCount < 2;
      },
    },
    mutations: {
      // We never use optimistic updates for money/status; mutate -> invalidate -> refetch.
      retry: 0,
    },
  },
});

// ---------------------------------------------------------------------------
// Focus manager — refetch when the app returns to foreground
// ---------------------------------------------------------------------------
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

AppState.addEventListener('change', onAppStateChange);

// ---------------------------------------------------------------------------
// Online manager — refetch when the network returns
// ---------------------------------------------------------------------------
onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    // `isInternetReachable` can be null on first event; fall back to isConnected.
    const online =
      state.isConnected === true && state.isInternetReachable !== false;
    setOnline(online);
  });
  return unsubscribe;
});