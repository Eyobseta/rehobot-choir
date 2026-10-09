import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
  listMembers,
  DirectoryMember,
  describeLastSeen,
} from '../../services/members';
import { ApiError } from '../../services/api';
import type { HomeStackParamList } from '../../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'Directory'>;

export default function DirectoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const list = await listMembers(q);
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
      void load(search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('directory.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text,
          }}
        />
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
                void load(search);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {t('directory.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const seen = describeLastSeen(item.lastActiveAt);
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('MemberProfile', { id: item.id })
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
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: item.profilePhotoUrl ?? undefined }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  />
                  {seen.online && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: colors.success,
                        borderWidth: 2,
                        borderColor: colors.surface,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text
                    style={[
                      typography.body,
                      { color: colors.text, fontWeight: '600' },
                    ]}
                  >
                    {item.fullName}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {seen.online ? t('directory.online') : seen.label}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}