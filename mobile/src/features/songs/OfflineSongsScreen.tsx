import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listOffline,
  removeOffline,
  OfflineEntry,
} from '../../services/offlineSongs';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  stopTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';

export default function OfflineSongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<OfflineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());

  const load = useCallback(async () => {
    try {
      setItems(await listOffline());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    const unsub = subscribe(setStatus);
    setStatus(getSnapshot());
    return unsub;
  }, []);

  const onToggle = async (entry: OfflineEntry) => {
    const isThis = getCurrentKey() === entry.songId;
    const isPlaying = status.isLoaded && isThis && status.isPlaying;

    if (isPlaying) {
      await pauseTrack();
      return;
    }
    if (isThis && status.isLoaded && !status.isPlaying) {
      await resumeTrack();
      return;
    }
    await playTrack({
      key: entry.songId,
      uri: entry.fileUri,
      title: entry.title,
    });
  };

  const openPlayer = async (entry: OfflineEntry) => {
    if (getCurrentKey() !== entry.songId) {
      await playTrack({
        key: entry.songId,
        uri: entry.fileUri,
        title: entry.title,
      });
    }
    navigation.navigate('Player', {
      title: entry.title,
      subtitle: t('songs.offline'),
    });
  };

  const onRemove = (songId: string) => {
    Alert.alert(t('songs.removeOffline'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('songs.removeOffline'),
        style: 'destructive',
        onPress: async () => {
          if (getCurrentKey() === songId) {
            await stopTrack();
          }
          await removeOffline(songId);
          void load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.songId}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('songs.emptyOffline')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isThis = getCurrentKey() === item.songId;
          const isPlaying = isThis && status.isLoaded && status.isPlaying;
          return (
            <Pressable
              onPress={() => openPlayer(item)}
              style={{
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Pressable
                onPress={() => onToggle(item)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color={colors.primaryText}
                />
              </Pressable>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('songs.savedOfflineAt')}{' '}
                  {new Date(item.savedAt).toLocaleDateString()}
                </Text>
              </View>

              <Pressable
                onPress={() => onRemove(item.songId)}
                style={{ padding: spacing.sm }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={colors.error}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}