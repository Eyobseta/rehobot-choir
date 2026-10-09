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

export default function EventEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
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
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
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
        <ActivityIndicator size="large" color={colors.primary} />
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
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xxl * 2,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {editingId ? t('events.editEvent') : t('events.createEvent')}
        </Text>

        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.lg },
          ]}
        >
          {t('events.coverImage')}
        </Text>
        <Pressable onPress={pickCover} style={{ alignItems: 'center', marginTop: spacing.sm }}>
          {coverUri ? (
            <Image
              source={{ uri: coverUri }}
              style={{ width: '100%', height: 180, borderRadius: radius.md }}
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: 180,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: colors.primary,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[typography.body, { color: colors.primary }]}>
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
            style={{ marginTop: spacing.sm, alignItems: 'center' }}
          >
            <Text style={[typography.caption, { color: colors.error }]}>
              {t('events.delete')} {t('events.coverImage').toLowerCase()}
            </Text>
          </Pressable>
        )}

        <EditorField
          label={t('events.titleField')}
          value={title}
          onChange={setTitle}
        />
        <EditorField
          label={t('events.locationField')}
          value={location}
          onChange={setLocation}
        />
        <EditorField
          label={t('events.dateField')}
          value={dateText}
          onChange={setDateText}
          placeholder="2026-12-15 10:00"
        />
        <EditorField
          label={t('events.description')}
          value={description}
          onChange={setDescription}
          multiline
        />

        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          {editingId && (
            <Pressable
              onPress={onDelete}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.button, { color: colors.error }]}>
                {t('events.delete')}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => onSave(false)}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.button, { color: colors.text }]}>
              {t('events.saveDraft')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onSave(true)}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[typography.button, { color: colors.primaryText }]}>
                {t('events.publishNow')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- Helper component (module scope — stable across renders) ----------

function EditorField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 100 : undefined,
        }}
      />
    </View>
  );
}