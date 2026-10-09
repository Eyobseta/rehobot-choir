import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listEvents, EventSummary } from '../../services/events';
import { ApiError } from '../../services/api';

export default function EventsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [items, setItems] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: 'upcoming' | 'past') => {
    setError(null);
    try {
      const list = await listEvents(s);
      setItems(list);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(scope);
    }, [load, scope]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <SegBtn
          label={t('events.upcoming')}
          active={scope === 'upcoming'}
          onPress={() => setScope('upcoming')}
        />
        <SegBtn
          label={t('events.past')}
          active={scope === 'past'}
          onPress={() => setScope('past')}
        />
      </View>

      {error && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          {error}
        </Text>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(scope);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {scope === 'upcoming'
                  ? t('events.emptyUpcoming')
                  : t('events.emptyPast')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('EventDetail', { id: item.id })
              }
              style={{
                marginBottom: spacing.md,
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {item.coverImageUrl && (
                <Image
                  source={{ uri: item.coverImageUrl }}
                  style={{ width: '100%', height: 140 }}
                />
              )}
              <View style={{ padding: spacing.md }}>
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
                    typography.bodySmall,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {new Date(item.date).toLocaleString()}
                </Text>
                {item.location && (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.location}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );

  function SegBtn({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: active ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          alignItems: 'center',
        }}
      >
        <Text
          style={[
            typography.button,
            { color: active ? colors.primaryText : colors.text },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}