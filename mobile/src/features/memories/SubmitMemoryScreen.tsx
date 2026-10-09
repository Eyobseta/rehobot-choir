import React, { useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { submitMemory } from '../../services/memories';
import { ApiError } from '../../services/api';

export default function SubmitMemoryScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateText, setDateText] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (res.canceled) return;
    const uris: string[] = [];
    for (const asset of res.assets) {
      const out = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      uris.push(out.uri);
    }
    setPhotoUris((prev) => [...prev, ...uris].slice(0, 20));
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (res.canceled) return;
    const out = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    setPhotoUris((prev) => [...prev, out.uri].slice(0, 20));
  };

  const removePhoto = (uri: string) => {
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
  };

  const pickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset) return;
    setAudioUri(asset.uri);
    setAudioName(asset.name ?? 'audio.m4a');
    setAudioMime(asset.mimeType ?? 'audio/m4a');
  };

  const addYoutube = () => {
    const v = youtubeInput.trim();
    if (!v) return;
    setYoutubeUrls((prev) => [...prev, v]);
    setYoutubeInput('');
  };

  const removeYoutube = (url: string) => {
    setYoutubeUrls((prev) => prev.filter((u) => u !== url));
  };

  const parseDate = (): string | null => {
    const m = dateText.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const dt = new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));
    const iso = parseDate();
    if (!iso) return setError(t('memories.dateFormat'));

    setBusy(true);
    try {
      await submitMemory({
        title: title.trim(),
        description: description.trim() || undefined,
        date: iso,
        photoUris,
        audioUri,
        audioName,
        audioMime,
        youtubeUrls,
      });
      Alert.alert(
        t('memories.submitted'),
        t('memories.submittedBody'),
        [{ text: t('common.continue'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

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
          {t('memories.submit')}
        </Text>

        <Field label={t('memories.titleField')} value={title} onChange={setTitle} />
        <Field
          label={t('memories.dateField')}
          value={dateText}
          onChange={setDateText}
          placeholder="2026-09-28"
          autoCapitalize="none"
        />
        <Field
          label={t('memories.descriptionField')}
          value={description}
          onChange={setDescription}
          multiline
        />

        {/* Photos */}
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          {t('memories.photosField')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Pressable
            onPress={addPhoto}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('memories.addFromLibrary')}
            </Text>
          </Pressable>
          <Pressable
            onPress={takePhoto}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('memories.takePhoto')}
            </Text>
          </Pressable>
        </View>

        {photoUris.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photoUris.map((uri) => (
              <View key={uri} style={{ marginRight: spacing.sm }}>
                <Image
                  source={{ uri }}
                  style={{ width: 96, height: 96, borderRadius: radius.md }}
                />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: colors.error,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Audio */}
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          {t('memories.audioField')}
        </Text>
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Ionicons
            name={audioUri ? 'musical-notes' : 'musical-note-outline'}
            size={22}
            color={audioUri ? colors.primary : colors.textSecondary}
          />
          <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {audioUri ? audioName : t('memories.audioNone')}
          </Text>
          {audioUri ? (
            <Pressable onPress={() => {
              setAudioUri(null);
              setAudioName(null);
              setAudioMime(null);
            }}>
              <Text style={[typography.caption, { color: colors.error }]}>
                {t('memories.removeAudio')}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={pickAudio}>
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('memories.pickAudio')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* YouTube */}
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          {t('memories.youtubeField')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={youtubeInput}
            onChangeText={setYoutubeInput}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
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
            onPress={addYoutube}
            style={{
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primaryText }]}>
              {t('memories.addYoutube')}
            </Text>
          </Pressable>
        </View>

        {youtubeUrls.map((u) => (
          <View
            key={u}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              style={[typography.bodySmall, { color: colors.text, flex: 1 }]}
              numberOfLines={1}
            >
              {u}
            </Text>
            <Pressable onPress={() => removeYoutube(u)}>
              <Ionicons name="close" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))}

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

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {t('memories.submit')}
            </Text>
          )}
        </Pressable>
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
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
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
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          minHeight: multiline ? 120 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}