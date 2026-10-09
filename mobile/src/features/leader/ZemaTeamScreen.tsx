import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  leaderListZemaMembers,
  leaderAddZemaMember,
  leaderRemoveZemaMember,
  ZemaMember,
} from '../../services/songs';
import { listMembers, DirectoryMember } from '../../services/members';
import { ApiError } from '../../services/api';

export default function ZemaTeamScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<ZemaMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListZemaMembers());
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(async () => {
    try {
      setDirectory(await listMembers(''));
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
      void loadDirectory();
    }, [load, loadDirectory]),
  );

  const onAdd = async (userId: string) => {
    setBusy(true);
    try {
      await leaderAddZemaMember(userId);
      setShowPicker(false);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (m: ZemaMember) => {
    Alert.alert(
      t('leaderSongs.removeZema'),
      m.user.memberProfile?.fullName ?? '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('leaderSongs.remove'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaderRemoveZemaMember(m.user.id);
              await load();
            } catch (e) {
              const err = e as ApiError;
              setError(`${err.message} [${err.code}]`);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const zemaIds = new Set(items.map((i) => i.user.id));
  const candidates = directory.filter((d) => !zemaIds.has(d.id));

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
      <View style={{ padding: spacing.lg }}>
        <Pressable
          onPress={() => setShowPicker((s) => !s)}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.button, { color: colors.primaryText }]}>
            {showPicker ? t('leaderSongs.closePicker') : t('leaderSongs.addZema')}
          </Text>
        </Pressable>

        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.sm }]}>
            {error}
          </Text>
        )}

        {showPicker && (
          <View
            style={{
              marginTop: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              maxHeight: 260,
            }}
          >
            <FlatList
              data={candidates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onAdd(item.id)}
                  disabled={busy}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  {item.profilePhotoUrl && (
                    <Image
                      source={{ uri: item.profilePhotoUrl }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                  )}
                  <Text
                    style={[
                      typography.body,
                      { color: colors.text, marginLeft: spacing.md },
                    ]}
                  >
                    {item.fullName}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing.md }}>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {t('leaderSongs.noCandidates')}
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('leaderSongs.emptyZema')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
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
            {item.user.memberProfile?.profilePhotoUrl && (
              <Image
                source={{ uri: item.user.memberProfile.profilePhotoUrl }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            )}
            <Text
              style={[
                typography.body,
                { color: colors.text, flex: 1, marginLeft: spacing.md },
              ]}
              numberOfLines={1}
            >
              {item.user.memberProfile?.fullName ?? ''}
            </Text>
            <Pressable onPress={() => onRemove(item)}>
              <Text style={[typography.caption, { color: colors.error }]}>
                {t('leaderSongs.remove')}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}