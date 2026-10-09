import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listCategories,
  SongCategory,
  leaderCreateCategory,
  leaderRenameCategory,
  leaderDeleteCategory,
} from '../../services/songs';
import { ApiError } from '../../services/api';

export default function SongCategoriesScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<SongCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listCategories());
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
      void load();
    }, [load]),
  );

  const onAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await leaderCreateCategory(newName.trim());
      setNewName('');
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onRename = (c: SongCategory) => {
    Alert.prompt?.(
      t('leaderSongs.renameCategory'),
      undefined,
      async (text) => {
        if (!text || !text.trim()) return;
        setBusy(true);
        try {
          await leaderRenameCategory(c.id, text.trim());
          await load();
        } catch (e) {
          const err = e as ApiError;
          setError(`${err.message} [${err.code}]`);
        } finally {
          setBusy(false);
        }
      },
      'plain-text',
      c.name,
    );
  };

  const onDelete = (c: SongCategory) => {
    Alert.alert(t('leaderSongs.deleteCategory'), c.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('leaderSongs.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaderDeleteCategory(c.id);
            await load();
          } catch (e) {
            const err = e as ApiError;
            setError(`${err.message} [${err.code}]`);
          } finally {
            setBusy(false);
          }
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
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder={t('leaderSongs.newCategoryPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text,
            }}
          />
          <Pressable
            onPress={onAdd}
            disabled={busy}
            style={{
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {t('leaderSongs.add')}
            </Text>
          </Pressable>
        </View>
        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.sm }]}>
            {error}
          </Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('leaderSongs.emptyCategories')}
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
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
              {item.name}
            </Text>
            <Pressable onPress={() => onRename(item)} style={{ marginRight: spacing.md }}>
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('leaderSongs.rename')}
              </Text>
            </Pressable>
            <Pressable onPress={() => onDelete(item)}>
              <Text style={[typography.caption, { color: colors.error }]}>
                {t('leaderSongs.delete')}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}