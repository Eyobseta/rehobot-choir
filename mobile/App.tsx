import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
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
} from './src/services/session';
import { setOnUnauthorized } from './src/services/api';
import { configureForegroundNotifications } from './src/services/pushTokens';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // SRS 6.6 — 7 days inactivity

function AppShell() {
  const { theme, ready: themeReady } = useTheme();
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      // NEW: Bump the session version on app boot to invalidate any stale refreshes
      const { bumpSessionVersion } = await import('./src/services/session');
      bumpSessionVersion();

      const state = await refreshSessionState();
      if (state === 'authenticated') {
        const { refreshRole } = await import('./src/services/role');
        await refreshRole();

        // Restore cache scope from the token's user
        const { me } = await import('./src/services/auth');
        const { setCacheScope } = await import('./src/services/cache');
        try {
          const res = await me();
          setCacheScope(res.user.id);
        } catch {
          // offline — fall back to token scope via role
        }

        const { registerDeviceWithBackend } = await import(
          './src/services/pushTokens'
        );
        void registerDeviceWithBackend();
      }
      setAuthenticated(state === 'authenticated');
      setSessionReady(true);
    })();

    setOnUnauthorized(async () => {
      const { setRole } = await import('./src/services/role');
      setRole(null);
      setAuthenticated(false);
    });

    const unsubscribe = subscribeSession((s) => {
      setAuthenticated(s === 'authenticated');
    });

    return () => {
      unsubscribe();
      setOnUnauthorized(null);
    };
  }, []);

  // ---- 7-day inactivity logout (SRS 6.6, adjusted from 30 min) ----
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

  if (!themeReady || !sessionReady) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    configureForegroundNotifications();
  }, []);

  useEffect(() => {
    initI18n()
      .then(() => setI18nReady(true))
      .catch(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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