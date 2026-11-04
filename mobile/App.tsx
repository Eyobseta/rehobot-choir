import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useIsRestoring } from '@tanstack/react-query';

import { initI18n } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import RootTabs from './src/navigation/RootTabs';
import AuthNavigator from './src/navigation/AuthNavigator';
import {
  refreshSessionState,
  subscribeSession,
  bumpSessionVersion,
} from './src/services/session';
import { setOnUnauthorized } from './src/services/api';
import { configureForegroundNotifications } from './src/services/pushTokens';
import { navigateFromRoot, type PushPayload } from './src/services/pushNavigation';
import AppLoading from './src/components/AppLoading';
import ChangePasswordScreen from './src/features/profile/ChangePasswordScreen';

import { queryClient } from './src/services/queryClient';
import { makePersistOptions } from './src/services/queryPersister';
import { clearAllCaches } from './src/services/cacheWipe';
import HelpRoot from './src/features/help/HelpRoot';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const PERSIST_OPTIONS = makePersistOptions();

// App-level navigation ref. Used by the push-tap listener in AppShell so a
// notification tap navigates correctly regardless of which tab / screen is
// currently focused. Must be module-scoped (not created inside a component)
// so it survives theme / state re-renders without losing the ready state.
const navigationRef = createNavigationContainerRef<any>();

type BootState = {
  i18nReady: boolean;
  themeReady: boolean;
  sessionReady: boolean;
};

function AppShell() {
  const { theme, ready: themeReady } = useTheme();

  // True while the persisted TanStack cache is being hydrated. We wait for
  // this before rendering any screen, so Home shows cached data on cold start
  // instead of flashing an empty spinner.
  const isRestoring = useIsRestoring();

  const [boot, setBoot] = useState<BootState>({
    i18nReady: false,
    themeReady: false,
    sessionReady: false,
  });
  const [authenticated, setAuthenticated] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const backgroundTime = useRef<number | null>(null);

  // Buffered push payload. Set when a notification is tapped while the
  // navigator is not yet ready (cold start, or forced-password screen).
  // Flushed from NavigationContainer's onReady.
  const pendingPush = useRef<PushPayload | null>(null);

  // --- Phase 1: i18n ---
  useEffect(() => {
    configureForegroundNotifications();
    initI18n()
      .catch(() => {
        // Non-fatal: fall back to default language
      })
      .finally(() => {
        setBoot((b) => ({ ...b, i18nReady: true }));
      });
  }, []);

  // --- Phase 2: theme (comes from ThemeProvider) ---
  useEffect(() => {
    if (themeReady) {
      setBoot((b) => ({ ...b, themeReady: true }));
    }
  }, [themeReady]);

  // --- Phase 3: session + role + cache + mustChangePassword ---
  useEffect(() => {
    if (!boot.i18nReady) return;

    (async () => {
      try {
        // Invalidate any stale token refreshes from a previous session
        bumpSessionVersion();

        const state = await refreshSessionState();

        if (state === 'authenticated') {
          const { refreshRole, loadStoredRole, getStoredUserId } = await import(
            './src/services/role'
          );

          // Load the last known role from the device first, so leader/admin
          // screens still show when the app starts offline.
          const storedRole = await loadStoredRole();
          if (storedRole) {
            // We already know the role: update it in the background
            // without blocking startup.
            void refreshRole();
          } else {
            // First run after update (nothing saved yet): wait for the server.
            await refreshRole();
          }

          const { me } = await import('./src/services/auth');
          const { setCacheScope } = await import('./src/services/cache');
          const { setPersisterScope } = await import('./src/services/queryPersister');

          try {
            const res = await me();
            setCacheScope(res.user.id);
            setPersisterScope(res.user.id);
            setMustChangePassword(res.user.mustChangePassword);
          } catch {
            // Offline: restore the cache scope from the saved user id
            const savedId = getStoredUserId();
            if (savedId) {
              setCacheScope(savedId);
              setPersisterScope(savedId);
            }
          }

          const { registerDeviceWithBackend } = await import(
            './src/services/pushTokens'
          );
          void registerDeviceWithBackend();
        }

        setAuthenticated(state === 'authenticated');
      } catch {
        // Non-fatal: treat as unauthenticated
      } finally {
        setBoot((b) => ({ ...b, sessionReady: true }));
      }
    })();

    // FIXED: forced logout also wipes every cache (TanStack + cache.ts).
    setOnUnauthorized(async () => {
      const { setRole } = await import('./src/services/role');
      setRole(null);
      setAuthenticated(false);
      try {
        await clearAllCaches();
      } catch {
        // non-fatal
      }
    });

    const unsubscribe = subscribeSession((s) => {
      setAuthenticated(s === 'authenticated');
      if (s === 'unauthenticated') {
        setMustChangePassword(false);
        // Drop any buffered push from a previous session so it does not
        // fire against the wrong user's navigator after re-login.
        pendingPush.current = null;
      }
    });

    return () => {
      unsubscribe();
      setOnUnauthorized(null);
    };
  }, [boot.i18nReady]);

  // --- Push-tap listener (registered once, at app root) ---
  //
  // Previously this lived inside NotificationsScreen, which meant a push tap
  // only did anything while that screen was mounted. Now it lives here so
  // taps are routed correctly from Home / Songs / Chat / Profile / cold start.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;

        // Cold start: was the app launched by tapping a notification?
        try {
          const last = await Notifications.getLastNotificationResponseAsync();
          const data = last?.notification?.request?.content?.data as
            | PushPayload
            | undefined;
          if (data) {
            if (navigationRef.isReady()) {
              navigateFromRoot(navigationRef, data);
            } else {
              pendingPush.current = data;
            }
          }
        } catch {
          // ignore
        }

        // Live taps while the app is running.
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data as
            | PushPayload
            | undefined;
          if (!data) return;
          if (navigationRef.isReady()) {
            navigateFromRoot(navigationRef, data);
          } else {
            pendingPush.current = data;
          }
        });
      } catch {
        // expo-notifications unavailable (e.g. Expo Go on Android)
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // --- 7-day inactivity logout ---
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundTime.current = Date.now();
      } else if (next === 'active' && backgroundTime.current) {
        const elapsed = Date.now() - backgroundTime.current;
        backgroundTime.current = null;
        if (elapsed > SEVEN_DAYS_MS && authenticated) {
          void import('./src/services/auth').then(({ logout }) => logout());
          void import('./src/services/role').then(({ setRole }) => setRole(null));
          setAuthenticated(false);
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [authenticated]);

  // --- Wait for ALL phases + cache hydration before rendering ---
  const allReady =
    boot.i18nReady && boot.themeReady && boot.sessionReady && !isRestoring;

  if (!allReady) {
    return <AppLoading />;
  }

  // --- Forced password change (SRS 6.7) ---
  if (mustChangePassword) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ChangePasswordScreen
          navigation={{
            goBack: () => {},
            navigate: () => {},
          }}
          route={{ params: { forced: true } }}
          forced
          onPasswordChanged={() => setMustChangePassword(false)}
        />
      </View>
    );
  }

  const navTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
  };

    return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onReady={() => {
          // (your existing onReady body — leave untouched)
          if (pendingPush.current) {
            const data = pendingPush.current;
            pendingPush.current = null;
            navigateFromRoot(navigationRef, data);
          }
        }}
      >
        {authenticated ? <RootTabs /> : <AuthNavigator />}
      </NavigationContainer>

      {authenticated && <HelpRoot navigationRef={navigationRef} />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={PERSIST_OPTIONS}
        >
          <AppShell />
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});