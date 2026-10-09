import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listMembers, DirectoryMember } from '../../services/members';
import { ApiError } from '../../services/api';

export default function LeaderAttendanceMembersScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      setItems(await listMembers(q));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(search);
    }, [search, load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <Text style={[typography.h3, { color: colors.text }]}>
          {t('attendance.memberPicker')}
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('attendance.searchMember')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          style={{
            marginTop: spacing.md,
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('MemberAttendanceGrid', {
                  memberId: item.id,
                  memberName: item.fullName,
                })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {item.profilePhotoUrl ? (
                <Image
                  source={{ uri: item.profilePhotoUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              )}
              <Text
                style={[
                  typography.body,
                  { color: colors.text, marginLeft: spacing.md, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {item.fullName}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}