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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getEvent,
  leaderCreateEvent,
  leaderUpdateEvent,
  leaderDeleteEvent,
} from '../../services/events';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

type IconName = keyof typeof Ionicons.glyphMap;

export default function EventEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateText, setDateText] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const ev = await getEvent(editingId);
        setTitle(ev.title);
        setDescription(ev.description ?? '');
        setLocation(ev.location ?? '');
        const d = new Date(ev.date);
        setDateText(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate(),
          ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
            d.getMinutes(),
          ).padStart(2, '0')}`,
        );
        setCoverUri(ev.coverImageUrl);
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

  const pickCover = () => {
    Alert.alert(t('events.coverImage'), undefined, [
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
    setCoverUri(out.uri);
    setRemoveCover(false);
  };

  const parseDate = (): string | null => {
    const m = dateText.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const onSave = async (publish: boolean) => {
    setError(null);
    const isoDate = parseDate();
    if (!title.trim()) return setError(t('register.fieldRequired'));
    if (!isoDate) return setError(t('events.dateField'));

    setBusy(true);
    try {
      if (editingId) {
        await leaderUpdateEvent(editingId, {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          date: isoDate,
          publish,
          removeCover,
          coverUri: coverUri && !coverUri.startsWith('http') ? coverUri : null,
        });
      } else {
        await leaderCreateEvent({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          date: isoDate,
          publish,
          coverUri: coverUri ?? null,
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
    Alert.alert(t('events.deleteConfirm'), t('events.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('events.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaderDeleteEvent(editingId);
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
              <Ionicons
                name={editingId ? 'create' : 'add-circle'}
                size={22}
                color={BRAND.deep}
              />
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
                {t('events.title')}
              </Text>
              <Text
                style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }}
                numberOfLines={1}
              >
                {editingId ? t('events.editEvent') : t('events.createEvent')}
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
          {/* COVER */}
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '700' }]}
          >
            {t('events.coverImage')}
          </Text>
          <Pressable
            onPress={pickCover}
            style={{ marginTop: spacing.sm }}
            accessibilityRole="button"
          >
            {coverUri ? (
              <View>
                <Image
                  source={{ uri: coverUri }}
                  style={{ width: '100%', height: 190, borderRadius: 26 }}
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
                    {t('events.coverImage')}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 190,
                  borderRadius: 26,
                  borderWidth: 2,
                  borderColor: withAlpha(BRAND.violet, 0.6),
                  borderStyle: 'dashed',
                  backgroundColor: withAlpha(BRAND.violet, 0.06),
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
                    backgroundColor: withAlpha(BRAND.violet, 0.16),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="image" size={26} color={BRAND.violet} />
                </View>
                <Text style={[typography.body, { color: BRAND.violet, fontWeight: '700' }]}>
                  {t('events.pickCover')}
                </Text>
              </View>
            )}
          </Pressable>

          {coverUri && (
            <Pressable
              onPress={() => {
                setCoverUri(null);
                setRemoveCover(true);
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
                {t('events.delete')} {t('events.coverImage').toLowerCase()}
              </Text>
            </Pressable>
          )}

          {/* DETAILS */}
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
            <EditorField icon="text" label={t('events.titleField')} value={title} onChange={setTitle} />
            <EditorField
              icon="location"
              label={t('events.locationField')}
              value={location}
              onChange={setLocation}
            />
            <EditorField
              icon="calendar"
              label={t('events.dateField')}
              value={dateText}
              onChange={setDateText}
              placeholder="2026-12-15 10:00"
            />
            <EditorField
              icon="reader"
              label={t('events.description')}
              value={description}
              onChange={setDescription}
              multiline
            />
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
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
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
            accessibilityLabel={t('events.delete')}
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
            {t('events.saveDraft')}
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
                <Ionicons name="rocket" size={17} color="#FFFFFF" />
                <Text
                  style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}
                  numberOfLines={1}
                >
                  {t('events.publishNow')}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function EditorField({
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
          borderColor: focused ? BRAND.violet : colors.border,
          borderWidth: 1.5,
          borderRadius: radius.md + 4,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={focused ? BRAND.violet : colors.textSecondary}
          style={{ marginTop: multiline ? spacing.md : 0 }}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            color: colors.text,
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 100 : undefined,
          }}
        />
      </View>
    </View>
  );
}