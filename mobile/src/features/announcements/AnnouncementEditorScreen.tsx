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
  getAnnouncement,
  leaderCreateAnnouncement,
  leaderUpdateAnnouncement,
  leaderDeleteAnnouncement,
} from '../../services/announcements';
import { ApiError } from '../../services/api';

export default function AnnouncementEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [publishAtText, setPublishAtText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (!editingId) {
      const now = new Date();
      setPublishAtText(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          '0',
        )}-${String(now.getDate()).padStart(2, '0')} ${String(
          now.getHours(),
        ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
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
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            '0',
          )}-${String(d.getDate()).padStart(2, '0')} ${String(
            d.getHours(),
          ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        );
        setImageUri(item.imageUrl);
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

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
    const m = publishAtText
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
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
          imageUri:
            imageUri && !imageUri.startsWith('http') ? imageUri : null,
        });
      } else {
        await leaderCreateAnnouncement({
          title: title.trim(),
          message: message.trim(),
          publishAt: isoDate,
          publish,
          imageUri: imageUri ?? null,
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          {editingId ? t('announcements.edit') : t('announcements.create')}
        </Text>

        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.lg },
          ]}
        >
          {t('announcements.imageField')}
        </Text>
        <Pressable
          onPress={pickImage}
          style={{ alignItems: 'center', marginTop: spacing.sm }}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: 160, borderRadius: radius.md }}
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: 160,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: colors.primary,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[typography.body, { color: colors.primary }]}>
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
            style={{ marginTop: spacing.sm, alignItems: 'center' }}
          >
            <Text style={[typography.caption, { color: colors.error }]}>
              {t('announcements.removeImage')}
            </Text>
          </Pressable>
        )}

        <Field
          label={t('announcements.titleField')}
          value={title}
          onChange={setTitle}
        />
        <Field
          label={t('announcements.messageField')}
          value={message}
          onChange={setMessage}
          multiline
        />
        <Field
          label={t('announcements.publishAt')}
          value={publishAtText}
          onChange={setPublishAtText}
          placeholder="2026-10-15 10:00"
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
                {t('announcements.delete')}
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
              {t('announcements.saveDraft')}
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
                {t('announcements.publishNow')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
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
        numberOfLines={multiline ? 5 : 1}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 120 : undefined,
        }}
      />
    </View>
  );
}