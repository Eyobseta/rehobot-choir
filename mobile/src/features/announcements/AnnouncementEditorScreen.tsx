import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getAnnouncement,
  leaderCreateAnnouncement,
  leaderUpdateAnnouncement,
  leaderDeleteAnnouncement,
} from '../../services/announcements';
import { listSongs, SongSummary } from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

type IconName = keyof typeof Ionicons.glyphMap;

const AMBER = '#F59E0B';

export default function AnnouncementEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [publishAtText, setPublishAtText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  // ---------- songs ----------
  const [songs, setSongs] = useState<{ songId: string; songTitle: string }[]>([]);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<SongSummary[]>([]);

  useEffect(() => {
    if (!editingId) {
      const now = new Date();
      setPublishAtText(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
          now.getDate(),
        ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes(),
        ).padStart(2, '0')}`,
      );
      return;
    }
    (async () => {
      try {
        const item = await getAnnouncement(editingId);
        setTitle(item.title);
        setMessage(item.message);
        const d = new Date(item.publishAt);
        setPublishAtText(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate(),
          ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
            d.getMinutes(),
          ).padStart(2, '0')}`,
        );
        setImageUri(item.imageUrl);
        setSongs(item.songs.map((s) => ({ songId: s.songId, songTitle: s.songTitle })));
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

  const openSongPicker = async () => {
    try {
      setAllSongs(await listSongs(''));
      setSongPickerOpen(true);
    } catch {
      // ignore
    }
  };

  const pickImage = () => {
    Alert.alert(t('announcements.imageField'), undefined, [
      {
        text: t('register.takePhoto'),
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [16, 9],
          });
          if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
        },
      },
      {
        text: t('register.chooseFromLibrary'),
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [16, 9],
          });
          if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const compress = async (uri: string) => {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    setImageUri(out.uri);
    setRemoveImage(false);
  };

  const parseDate = (): string | null => {
    const m = publishAtText.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m;
    const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  const onSave = async (publish: boolean) => {
    setError(null);
    const isoDate = parseDate();
    if (!title.trim()) return setError(t('register.fieldRequired'));
    if (!message.trim()) return setError(t('register.fieldRequired'));
    if (!isoDate) return setError(t('announcements.publishAt'));

    setBusy(true);
    try {
      if (editingId) {
        await leaderUpdateAnnouncement(editingId, {
          title: title.trim(),
          message: message.trim(),
          publishAt: isoDate,
          publish,
          removeImage,
          imageUri: imageUri && !imageUri.startsWith('http') ? imageUri : null,
          songs,
        });
      } else {
        await leaderCreateAnnouncement({
          title: title.trim(),
          message: message.trim(),
          publishAt: isoDate,
          publish,
          imageUri: imageUri ?? null,
          songs,
        });
      }
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert(t('announcements.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('announcements.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaderDeleteAnnouncement(editingId);
            navigation.goBack();
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
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <LinearGradient
          colors={['#F59E0B', BRAND.magenta, BRAND.violet]}
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
              backgroundColor: withAlpha('#FFFFFF', 0.18),
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="megaphone" size={22} color={BRAND.deep} />
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
                {t('announcements.title')}
              </Text>
              <Text
                style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }}
                numberOfLines={1}
              >
                {editingId ? t('announcements.edit') : t('announcements.create')}
              </Text>
            </View>

            <GlassBackButton
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
              size={44}
            />
          </View>
        </LinearGradient>

        <View style={{ padding: spacing.lg }}>
          {/* Image */}
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {t('announcements.imageField')}
          </Text>
          <Pressable
            onPress={pickImage}
            style={{ marginTop: spacing.sm }}
            accessibilityRole="button"
          >
            {imageUri ? (
              <View>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: 180, borderRadius: 26 }}
                />
                <View
                  style={{
                    position: 'absolute',
                    right: spacing.sm + 2,
                    bottom: spacing.sm + 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 16,
                    backgroundColor: 'rgba(10,6,30,0.65)',
                  }}
                >
                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                  <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '800' }]}>
                    {t('announcements.imageField')}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 26,
                  borderWidth: 2,
                  borderColor: withAlpha(AMBER, 0.7),
                  borderStyle: 'dashed',
                  backgroundColor: withAlpha(AMBER, 0.07),
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 20,
                    backgroundColor: withAlpha(AMBER, 0.18),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="image" size={26} color={AMBER} />
                </View>
                <Text style={[typography.body, { color: AMBER, fontWeight: '700' }]}>
                  {t('announcements.pickImage')}
                </Text>
              </View>
            )}
          </Pressable>

          {imageUri && (
            <Pressable
              onPress={() => {
                setImageUri(null);
                setRemoveImage(true);
              }}
              style={{
                marginTop: spacing.sm,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderRadius: 14,
                backgroundColor: withAlpha(colors.error, 0.1),
              }}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>
                {t('announcements.removeImage')}
              </Text>
            </Pressable>
          )}

          {/* Fields */}
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.lg,
              paddingTop: spacing.xs,
              borderRadius: 26,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Field
              icon="text"
              label={t('announcements.titleField')}
              value={title}
              onChange={setTitle}
            />
            <Field
              icon="chatbox-ellipses"
              label={t('announcements.messageField')}
              value={message}
              onChange={setMessage}
              multiline
            />
            <Field
              icon="calendar"
              label={t('announcements.publishAt')}
              value={publishAtText}
              onChange={setPublishAtText}
              placeholder="2026-10-15 10:00"
            />
          </View>

          {/* ---------- Songs picker ---------- */}
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm }]}>
              {t('announcements.songs')}
            </Text>
            <Pressable
              onPress={openSongPicker}
              style={{
                padding: spacing.md,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="musical-notes" size={18} color={BRAND.violet} />
              <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                {songs.length === 0 ? `+ ${t('announcements.songs')}` : `${songs.length} selected`}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            {songs.map((s) => (
              <View key={s.songId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 4 }}>
                <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>🎵 {s.songTitle}</Text>
                <Pressable onPress={() => setSongs((prev) => prev.filter((x) => x.songId !== s.songId))}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>

          {error && (
            <View
              style={{
                marginTop: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
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
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {editingId && (
          <Pressable
            onPress={onDelete}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('announcements.delete')}
            style={{
              width: 50,
              height: 50,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.error,
              backgroundColor: withAlpha(colors.error, 0.08),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="trash" size={20} color={colors.error} />
          </Pressable>
        )}

        <Pressable
          onPress={() => onSave(false)}
          disabled={busy}
          style={{
            flex: 1,
            height: 50,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.background,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Ionicons name="document-text-outline" size={17} color={colors.text} />
          <Text style={[typography.button, { color: colors.text }]} numberOfLines={1}>
            {t('announcements.saveDraft')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onSave(true)}
          disabled={busy}
          style={{
            flex: 1.2,
            height: 50,
            borderRadius: 18,
            overflow: 'hidden',
            opacity: busy ? 0.6 : 1,
            shadowColor: BRAND.violet,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                <Text
                  style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}
                  numberOfLines={1}
                >
                  {t('announcements.publishNow')}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* ---------- Song picker modal ---------- */}
      <Modal
        visible={songPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSongPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={[typography.h3, { color: colors.text }]}>{t('announcements.songs')}</Text>
              <Pressable onPress={() => setSongPickerOpen(false)}>
                <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{t('common.close')}</Text>
              </Pressable>
            </View>
            <FlatList
              data={allSongs.filter((s) => !songs.some((x) => x.songId === s.id))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSongs((prev) => [...prev, { songId: item.id, songTitle: item.title }]);
                    setSongPickerOpen(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Ionicons name="musical-notes" size={20} color={BRAND.violet} />
                  <Text style={{ color: colors.text, flex: 1, fontWeight: '700' }}>{item.title}</Text>
                  <Ionicons name="add-circle" size={22} color={BRAND.magenta} />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>
                  {t('songs.empty', { defaultValue: 'No songs yet.' })}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          backgroundColor: colors.background,
          borderColor: focused ? AMBER : colors.border,
          borderWidth: 1.5,
          borderRadius: radius.md + 4,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={focused ? AMBER : colors.textSecondary}
          style={{ marginTop: multiline ? spacing.md : 0 }}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          numberOfLines={multiline ? 5 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            color: colors.text,
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 120 : undefined,
          }}
        />
      </View>
    </View>
  );
}