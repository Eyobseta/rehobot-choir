import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { SongCategory } from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha, AuthField } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  useLeaderCategoriesQuery,
  useCreateCategoryMutation,
  useRenameCategoryMutation,
  useDeleteCategoryMutation,
} from './useLeaderCategoriesAndZema';

const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function SongCategoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useLeaderCategoriesQuery();
  const createMut = useCreateCategoryMutation();
  const renameMut = useRenameCategoryMutation();
  const deleteMut = useDeleteCategoryMutation();

  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const busy = createMut.isPending || renameMut.isPending || deleteMut.isPending;

  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Rename modal state — replaces Alert.prompt, which does not exist on Android.
  const [renameTarget, setRenameTarget] = useState<SongCategory | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameErr, setRenameErr] = useState<string | null>(null);

  const errorMsg =
    error ??
    (q.isError
      ? ((q.error as { message?: string } | null)?.message ?? 'Error')
      : null);

  const onAdd = async () => {
    if (!newName.trim()) return;
    setError(null);
    try {
      await createMut.mutateAsync(newName.trim());
      setNewName('');
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    }
  };

  const openRename = (c: SongCategory) => {
    setError(null);
    setRenameErr(null);
    setRenameValue(c.name);
    setRenameTarget(c);
  };

  const closeRename = () => {
    if (busy) return;
    setRenameTarget(null);
    setRenameErr(null);
  };

  const confirmRename = async () => {
    if (!renameTarget || busy) return;
    const next = renameValue.trim();
    if (!next) {
      setRenameErr(t('register.fieldRequired'));
      return;
    }
    if (next === renameTarget.name) {
      // No-op rename: close quietly, don't hit the API.
      setRenameTarget(null);
      return;
    }
    setRenameErr(null);
    try {
      await renameMut.mutateAsync({ id: renameTarget.id, name: next });
      setRenameTarget(null);
    } catch (e) {
      const err = e as ApiError;
      setRenameErr(`${err.message} [${err.code}]`);
    }
  };

  const onDelete = (c: SongCategory) => {
    Alert.alert(t('leaderSongs.deleteCategory'), c.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('leaderSongs.delete'),
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await deleteMut.mutateAsync(c.id);
          } catch (e) {
            const err = e as ApiError;
            setError(`${err.message} [${err.code}]`);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha(BRAND.gold, 0.22),
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: BRAND.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="albums" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('leaderSongs.title')}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('leaderSongs.categories')}
            </Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minHeight: 48,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.28)',
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Ionicons
              name="pricetag"
              size={16}
              color={focused ? BRAND.gold : 'rgba(255,255,255,0.85)'}
            />
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t('leaderSongs.newCategoryPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              selectionColor={BRAND.gold}
              style={{ flex: 1, color: '#FFFFFF', fontSize: 14, paddingVertical: 10 }}
            />
          </View>
          <Pressable
            onPress={onAdd}
            disabled={busy}
            accessibilityRole="button"
            style={{ borderRadius: 14, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}
          >
            <LinearGradient
              colors={[BRAND.gold, '#FFA94D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                minHeight: 48,
                paddingHorizontal: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>
                {t('leaderSongs.add')}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>

      {errorMsg && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: spacing.md,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.error, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(colors.error, 0.35),
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {errorMsg}
          </Text>
        </View>
      )}

      {firstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="pricetags-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('leaderSongs.emptyCategories')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <CategoryCard
              item={item}
              index={index}
              palette={PALETTES[index % PALETTES.length]}
              onRename={() => openRename(item)}
              onDelete={() => onDelete(item)}
              renameLabel={t('leaderSongs.rename')}
              deleteLabel={t('leaderSongs.delete')}
            />
          )}
        />
      )}

      {/* ---------- Rename modal (replaces Alert.prompt, works on Android) ---------- */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRename}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <View
                style={[styles.sheetIcon, { backgroundColor: withAlpha(BRAND.violet, 0.16) }]}
              >
                <Ionicons name="pricetag" size={26} color={BRAND.violet} />
              </View>
              <Text
                style={[
                  typography.h3,
                  { color: colors.text, fontWeight: '800', marginTop: 12 },
                ]}
              >
                {t('leaderSongs.renameCategory')}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: 4 },
                ]}
                numberOfLines={2}
              >
                {renameTarget?.name ?? ''}
              </Text>

              <View style={{ marginTop: spacing.lg }}>
                <AuthField
                  label={t('leaderSongs.newCategoryPlaceholder')}
                  iconNode={<Ionicons name="pricetag" size={16} color={BRAND.violet} />}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={confirmRename}
                />
              </View>

              {renameErr && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.error, marginTop: spacing.sm, fontWeight: '600' },
                  ]}
                >
                  {renameErr}
                </Text>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  marginTop: spacing.lg,
                }}
              >
                <Pressable
                  onPress={closeRename}
                  disabled={busy}
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[typography.button, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmRename}
                  disabled={busy}
                  style={{ flex: 1, opacity: busy ? 0.7 : 1 }}
                >
                  <LinearGradient
                    colors={[BRAND.violet, BRAND.magenta]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text
                          style={[
                            typography.button,
                            { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 },
                          ]}
                        >
                          {t('common.save')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function CategoryCard({
  item,
  index,
  palette,
  onRename,
  onDelete,
  renameLabel,
  deleteLabel,
}: {
  item: SongCategory;
  index: number;
  palette: readonly [string, string];
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index, 8) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  return (
    <Animated.View
      style={{
        marginBottom: spacing.sm + 4,
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
          },
        ],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }}
        />
        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="pricetag" size={18} color="#FFFFFF" />
        </LinearGradient>
        <Text
          style={[
            typography.body,
            { color: colors.text, flex: 1, marginLeft: 14, fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Pressable
          onPress={onRename}
          hitSlop={6}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: withAlpha(palette[0], 0.14),
            marginRight: 6,
          }}
        >
          <Text style={{ color: palette[0], fontWeight: '800', fontSize: 11 }}>
            {renameLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: withAlpha(colors.error, 0.14),
          }}
        >
          <Text style={{ color: colors.error, fontWeight: '800', fontSize: 11 }}>
            {deleteLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { borderRadius: 28, padding: 22 },
  sheetIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});