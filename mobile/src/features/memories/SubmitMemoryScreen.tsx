import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { submitMemory } from '../../services/memories';
import { ApiError } from '../../services/api';
import { EthDate, ethTodayFromInstant, formatEthDate } from '../../utils/ethiopianCalendar';
import EthDatePicker from '../funding/EthDatePicker';
import {
  KeyboardAwareScroll,
  AuthField,
  PrimaryButton,
  SecondaryButton,
  ErrorBanner,
  BRAND,
  withAlpha,
} from '../auth/Auth_UI';
import { useEnter, MemoryHero } from './Memorykit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function SubmitMemoryScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<EthDate>(ethTodayFromInstant(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));

    setBusy(true);
    try {
      await submitMemory({
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        photoUris,
        audioUri,
        audioName,
        audioMime,
        youtubeUrls,
      });
      Alert.alert(t('memories.submitted'), t('memories.submittedBody'), [
        { text: t('common.continue'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const { fadeUp } = useEnter();
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (error) {
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 6, -6, 0].map((v) =>
          Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true }),
        ),
      ).start();
    }
  }, [error, shake]);

  const fieldIcon = (name: IconName, tint: string) => (
    <View style={[styles.fieldIcon, { backgroundColor: withAlpha(tint, 0.2) }]}>
      <Ionicons name={name} size={16} color={tint} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={fadeUp(0)}>
        <MemoryHero
          icon="images"
          overline={t('memories.submit')}
          title={t('memories.submitSubtitle', {
            defaultValue: 'Share a moment with the choir family.',
          })}
          titleSize={18}
          onBack={() => navigation.goBack()}
        />
      </Animated.View>

      <KeyboardAwareScroll
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
      >
        {/* Review note */}
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 18,
              borderWidth: 1,
              backgroundColor: withAlpha(BRAND.lime, 0.1),
              borderColor: withAlpha(BRAND.lime, 0.35),
            },
            fadeUp(1),
          ]}
        >
          <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
          <Text style={[typography.caption, { color: colors.text, flex: 1, lineHeight: 18 }]}>
            {t('memories.reviewNote', {
              defaultValue: 'A choir leader reviews every memory before it is published.',
            })}
          </Text>
        </Animated.View>

        {/* Basics */}
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(1)]}>
          <AuthField
            label={t('memories.titleField')}
            iconNode={fieldIcon('create', BRAND.lavender)}
            value={title}
            onChangeText={setTitle}
          />

          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700', marginTop: spacing.sm },
            ]}
          >
            {t('memories.dateField')}
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: 16,
              paddingHorizontal: spacing.md,
              minHeight: 54,
              marginBottom: spacing.md,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            {fieldIcon('calendar', '#E6C779')}
            <Text style={{ color: colors.text, flex: 1, fontSize: 16 }}>{formatEthDate(date, lang)}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>

          <AuthField
            label={t('memories.descriptionField')}
            iconNode={fieldIcon('chatbubble-ellipses', BRAND.mint)}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </Animated.View>

        {/* Photos */}
        <Animated.View style={fadeUp(2)}>
          <SectionCard
            icon="camera"
            tint={colors.accent}
            title={t('memories.photosField')}
            badge={photoUris.length > 0 ? `${photoUris.length}/20` : undefined}
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PickButton icon="images" label={t('memories.addFromLibrary')} onPress={addPhoto} />
              <PickButton icon="camera" label={t('memories.takePhoto')} onPress={takePhoto} />
            </View>

            {photoUris.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: spacing.md }}
                contentContainerStyle={{ paddingTop: 8, paddingRight: 8 }}
              >
                {photoUris.map((uri, i) => (
                  <View key={uri} style={{ marginRight: spacing.sm }}>
                    <Image source={{ uri }} style={styles.thumb} />
                    {i === 0 && (
                      <View style={styles.coverTag}>
                        <Text style={{ color: BRAND.teal, fontSize: 10, fontWeight: '800' }}>
                          {t('memories.cover', { defaultValue: 'Cover' })}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => removePhoto(uri)}
                      hitSlop={8}
                      accessibilityRole="button"
                      style={[styles.removeBadge, { backgroundColor: colors.error, borderColor: colors.surface }]}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </SectionCard>
        </Animated.View>

        {/* Audio */}
        <Animated.View style={fadeUp(3)}>
          <SectionCard icon="musical-notes" tint={BRAND.lavender} title={t('memories.audioField')}>
            <View
              style={[
                styles.audioRow,
                {
                  backgroundColor: audioUri ? withAlpha(BRAND.lime, 0.1) : colors.background,
                  borderColor: audioUri ? withAlpha(BRAND.lime, 0.55) : colors.border,
                },
              ]}
            >
              <View style={[styles.fieldIcon, { backgroundColor: withAlpha(colors.accent, 0.18) }]}>
                <Ionicons
                  name={audioUri ? 'musical-notes' : 'musical-note-outline'}
                  size={18}
                  color={audioUri ? colors.accent : colors.textSecondary}
                />
              </View>
              <Text
                style={[typography.bodySmall, { color: colors.text, flex: 1, fontWeight: audioUri ? '700' : '400' }]}
                numberOfLines={1}
              >
                {audioUri ? audioName : t('memories.audioNone')}
              </Text>
              {audioUri ? (
                <Pressable
                  onPress={() => {
                    setAudioUri(null);
                    setAudioName(null);
                    setAudioMime(null);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>
                    {t('memories.removeAudio')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={pickAudio} hitSlop={8} accessibilityRole="button">
                  <Text style={[typography.caption, { color: colors.accent, fontWeight: '800' }]}>
                    {t('memories.pickAudio')}
                  </Text>
                </Pressable>
              )}
            </View>
          </SectionCard>
        </Animated.View>

        {/* YouTube */}
        <Animated.View style={fadeUp(4)}>
          <SectionCard
            icon="logo-youtube"
            tint="#FF2D2D"
            title={t('memories.youtubeField')}
            badge={youtubeUrls.length > 0 ? String(youtubeUrls.length) : undefined}
          >
            <AuthField
              label=""
              iconNode={fieldIcon('link', '#FF2D2D')}
              value={youtubeInput}
              onChangeText={setYoutubeInput}
              placeholder="https://www.youtube.com/watch?v=..."
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={addYoutube}
            />
            <SecondaryButton label={t('memories.addYoutube')} onPress={addYoutube} />

            {youtubeUrls.map((u) => (
              <View
                key={u}
                style={[styles.ytRow, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Ionicons name="logo-youtube" size={18} color="#FF2D2D" />
                <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {u}
                </Text>
                <Pressable onPress={() => removeYoutube(u)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </SectionCard>
        </Animated.View>

        {error && (
          <Animated.View style={{ marginTop: spacing.lg, transform: [{ translateX: shake }] }}>
            <ErrorBanner message={error} />
          </Animated.View>
        )}

        <Animated.View style={[{ marginTop: 28 }, fadeUp(5)]}>
          <PrimaryButton
            label={t('memories.submit')}
            onPress={onSubmit}
            busy={busy}
            iconNode={<Ionicons name="paper-plane" size={18} color="#FFFFFF" />}
          />
        </Animated.View>
      </KeyboardAwareScroll>

      <EthDatePicker
        visible={pickerOpen}
        title={t('memories.dateField')}
        value={date}
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setDate(d);
          setPickerOpen(false);
        }}
        minYear={2000}
        maxYear={ethTodayFromInstant(new Date()).year}
      />
    </View>
  );
}

function SectionCard({
  icon,
  tint,
  title,
  badge,
  children,
}: {
  icon: IconName;
  tint: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: withAlpha(tint, 0.2) }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <Text style={[typography.body, { color: colors.text, fontWeight: '800', flex: 1 }]}>{title}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: withAlpha(tint, 0.2) }]}>
            <Text style={{ color: tint, fontSize: 12, fontWeight: '800' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function PickButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        style={styles.pick}
      >
        <Ionicons name={icon} size={18} color={BRAND.lime} />
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 26, padding: 16, marginTop: 16 },
  fieldIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pick: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: BRAND.teal,
    borderWidth: 1,
    borderColor: 'rgba(196,244,79,0.35)',
  },
  thumb: { width: 96, height: 96, borderRadius: 18 },
  coverTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: BRAND.lime,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  ytRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
});