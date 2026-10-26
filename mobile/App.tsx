import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import AppLoading from './src/components/AppLoading';
import ChangePasswordScreen from './src/features/profile/ChangePasswordScreen';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type BootState = {
  i18nReady: boolean;
  themeReady: boolean;
  sessionReady: boolean;
};

function AppShell() {
  const { theme, ready: themeReady } = useTheme();

  const [boot, setBoot] = useState<BootState>({
    i18nReady: false,
    themeReady: false,
    sessionReady: false,
  });
  const [authenticated, setAuthenticated] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const backgroundTime = useRef<number | null>(null);

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
    // Wait for i18n before we do anything else
    if (!boot.i18nReady) return;

    (async () => {
      try {
        // Invalidate any stale token refreshes from a previous session
        bumpSessionVersion();

        const state = await refreshSessionState();

        if (state === 'authenticated') {
          const { refreshRole } = await import('./src/services/role');
          await refreshRole();

          const { me } = await import('./src/services/auth');
          const { setCacheScope } = await import('./src/services/cache');

          try {
            const res = await me();
            setCacheScope(res.user.id);
            setMustChangePassword(res.user.mustChangePassword);
          } catch {
            // Offline — fall back to token scope via role
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

    setOnUnauthorized(async () => {
      const { setRole } = await import('./src/services/role');
      setRole(null);
      setAuthenticated(false);
    });

    const unsubscribe = subscribeSession((s) => {
      setAuthenticated(s === 'authenticated');
      if (s === 'unauthenticated') {
        setMustChangePassword(false);
      }
    });

    return () => {
      unsubscribe();
      setOnUnauthorized(null);
    };
  }, [boot.i18nReady]);

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

  // --- Show loading until ALL phases are done ---
  const allReady = boot.i18nReady && boot.themeReady && boot.sessionReady;

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
    <NavigationContainer theme={navTheme}>
      {authenticated ? <RootTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});