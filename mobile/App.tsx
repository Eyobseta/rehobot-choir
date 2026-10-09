import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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

function AppShell() {
  const { theme, ready: themeReady } = useTheme();
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      const state = await refreshSessionState();
      if (state === 'authenticated') {
        const { refreshRole } = await import('./src/services/role');
        await refreshRole();

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
    // Configure the global notification handler once, at app startup,
    // so that foreground notifications appear as banners.
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