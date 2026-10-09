import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  listPendingApplications,
  PendingApplication,
} from '../../services/leaders';
import { ApiError } from '../../services/api';
import type { LeaderStackParamList } from '../../navigation/LeaderStack';

type Props = NativeStackScreenProps<LeaderStackParamList, 'ApprovalsList'>;

export default function ApprovalsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listPendingApplications();
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
      void load();
    }, [load]),
  );

  if (loading && items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.h2, { color: colors.primary }]}>
              {t('leader.approvalsTitle')}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              <HeaderBtn
                label={t('events.title')}
                onPress={() => navigation.navigate('LeaderEvents')}
              />
              <HeaderBtn
                label={t('announcements.title')}
                onPress={() => navigation.navigate('LeaderAnnouncements')}
              />
              <HeaderBtn
                label={t('attendance.record')}
                onPress={() => navigation.navigate('LeaderAttendance')}
              />
              <HeaderBtn
                label={t('leaderTools.manageMember')}
                onPress={() => navigation.navigate('ManageMember')}
              />
                            <HeaderBtn
                label={t('leaderSongs.title')}
                onPress={() => navigation.navigate('LeaderSongs')}
              />
                            <HeaderBtn
                label={t('memories.title')}
                onPress={() => navigation.navigate('LeaderMemories')}
              />
            </View>

            {error && (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error, marginTop: spacing.sm },
                ]}
              >
                {error}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('leader.approvalsEmpty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('ApplicantDetail', { id: item.id })
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Image
              source={{ uri: item.profilePhotoUrl }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.surfaceAlt,
              }}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={[typography.body, { color: colors.text, fontWeight: '600' }]}
                numberOfLines={1}
              >
                {item.fullName}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {item.phone}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.primary }]}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

// ---------- Header button ----------

function HeaderBtn({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={[typography.bodySmall, { color: colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}