import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import SongsScreen from '../features/songs/SongsScreen';
import SongDetailScreen from '../features/songs/SongDetailScreen';
import FavoritesScreen from '../features/songs/FavoritesScreen';
import OfflineSongsScreen from '../features/songs/OfflineSongsScreen';
import SongVideoScreen from '../features/songs/SongVideoScreen';
import PlayerScreen from '../features/songs/PlayerScreen';
import ZemaSubmissionsScreen from '../features/songs/ZemaSubmissionsScreen';
import ZemaEditorScreen from '../features/songs/ZemaEditorScreen';

export type SongsStackParamList = {
  SongsList: undefined;
  SongDetail: { id: string };
  Favorites: undefined;
  Offline: undefined;
  SongVideo: { youtubeUrl: string; title: string };
  Player: { title?: string; subtitle?: string } | undefined;
    ZemaSubmissions: undefined;
  ZemaEditor: { id: string | null };
};

const Stack = createNativeStackNavigator<SongsStackParamList>();

export default function SongsStack() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="SongsList"
        component={SongsScreen}
        options={{ title: t('tabs.songs') }}
      />
      <Stack.Screen
        name="SongDetail"
        component={SongDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: t('songs.favorites') }}
      />
      <Stack.Screen
        name="Offline"
        component={OfflineSongsScreen}
        options={{ title: t('songs.offline') }}
      />
      <Stack.Screen
        name="SongVideo"
        component={SongVideoScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
            <Stack.Screen
        name="ZemaSubmissions"
        component={ZemaSubmissionsScreen}
        options={{ title: t('zema.team') }}
      />
      <Stack.Screen
        name="ZemaEditor"
        component={ZemaEditorScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}