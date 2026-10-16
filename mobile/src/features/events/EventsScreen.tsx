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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listEvents, EventSummary } from '../../services/events';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';

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
      {/* segmented control */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            padding: 4,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <SegBtn
            icon="sparkles"
            label={t('events.upcoming')}
            active={scope === 'upcoming'}
            onPress={() => setScope('upcoming')}
          />
          <SegBtn
            icon="time"
            label={t('events.past')}
            active={scope === 'past'}
            onPress={() => setScope('past')}
          />
        </View>
      </View>

      {error && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md + 2,
            backgroundColor: withAlpha(colors.error, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(colors.error, 0.35),
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {error}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
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
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 26,
                  backgroundColor: withAlpha(BRAND.violet, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="calendar-outline" size={34} color={BRAND.violet} />
              </View>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {scope === 'upcoming'
                  ? t('events.emptyUpcoming')
                  : t('events.emptyPast')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const d = new Date(item.date);
            const dayNum = d.getDate();
            const monthShort = d.toLocaleString(undefined, { month: 'short' });
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('EventDetail', { id: item.id })
                }
                style={({ pressed }) => ({
                  marginBottom: spacing.md + 2,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  shadowColor: BRAND.deep,
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                })}
              >
                <View style={{ height: item.coverImageUrl ? 150 : 96 }}>
                  {item.coverImageUrl ? (
                    <Image
                      source={{ uri: item.coverImageUrl }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <LinearGradient
                      colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.18)" />
                    </LinearGradient>
                  )}
                  {item.coverImageUrl && (
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(10,6,30,0)', 'rgba(10,6,30,0.45)']}
                      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
                    />
                  )}
                  {/* floating date chip */}
                  <View
                    style={{
                      position: 'absolute',
                      top: spacing.sm + 2,
                      left: spacing.sm + 2,
                      width: 52,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOpacity: 0.2,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 3 },
                      elevation: 3,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: '800', color: BRAND.deep, lineHeight: 22 }}>
                      {dayNum}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: BRAND.magenta,
                        textTransform: 'uppercase',
                      }}
                    >
                      {monthShort}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    padding: spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[typography.body, { color: colors.text, fontWeight: '800' }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text
                        style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
                        numberOfLines={1}
                      >
                        {new Date(item.date).toLocaleString()}
                      </Text>
                    </View>
                    {item.location && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text
                          style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
                          numberOfLines={1}
                        >
                          {item.location}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: withAlpha(BRAND.violet, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="arrow-forward" size={16} color={BRAND.violet} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// ---------- Helper (module scope — stable across renders) ----------

function SegBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm + 2,
        borderRadius: 16,
        backgroundColor: active ? colors.primary : 'transparent',
        shadowColor: active ? colors.primary : 'transparent',
        shadowOpacity: active ? 0.35 : 0,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: active ? 3 : 0,
      }}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? colors.primaryText : colors.textSecondary}
      />
      <Text
        style={[
          typography.button,
          { color: active ? colors.primaryText : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}