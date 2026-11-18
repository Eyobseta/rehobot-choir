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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  EthDate,
  ethTodayFromInstant,
  formatEthDate,
} from '../../utils/ethiopianCalendar';
import EthDatePicker from '../funding/EthDatePicker';
import {
  useEventDetailQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
} from './useEvents';

type IconName = keyof typeof Ionicons.glyphMap;

export default function EventEditorScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const editingId: string | null = route.params?.id ?? null;

  const eventQ = useEventDetailQuery(editingId ?? '__new__', {
    enabled: !!editingId,
  });

  const createMut = useCreateEventMutation();
  const updateMut = useUpdateEventMutation();
  const deleteMut = useDeleteEventMutation();

  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const [ethDate, setEthDate] = useState<EthDate>(ethTodayFromInstant(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const busy =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  useEffect(() => {
    if (!editingId) return;
    const ev = eventQ.data;
    if (!ev) return;
    setTitle(ev.title);
    setDescription(ev.description ?? '');
    setLocation(ev.location ?? '');
    // API already returns the date as an Ethiopian { year, month, day }.
    setEthDate(ev.date);
    setCoverUri(ev.coverImageUrl);
  }, [editingId, eventQ.data]);

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

  /**
   * The backend `reqEthDate` validator expects a JSON object string with
   * Ethiopian Y/M/D parts:
   *   '{"year":2016,"month":1,"day":1}'
   * It does NOT accept a bare "2026-10-15" string (JSON.parse throws,
   * the server responds "Date is required").
   *
   * The Event model has no time column, so only the date is sent.
   * Gregorian mirror (dateGregorian) is computed server-side from these parts.
   */
  const buildDatePayload = (): string =>
    JSON.stringify({
      year: ethDate.year,
      month: ethDate.month,
      day: ethDate.day,
    });

  const onSave = async (publish: boolean) => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));

    const datePayload = buildDatePayload();

    try {
      if (editingId) {
        await updateMut.mutateAsync({
          id: editingId,
          input: {
            title: title.trim(),
            description: description.trim(),
            location: location.trim(),
            date: datePayload,
            publish,
            removeCover,
            coverUri: coverUri && !coverUri.startsWith('http') ? coverUri : null,
          },
        });
      } else {
        await createMut.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          date: datePayload,
          publish,
          coverUri: coverUri ?? null,
        });
      }
      navigation.goBack();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Error');
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
          try {
            await deleteMut.mutateAsync(editingId);
            navigation.goBack();
          } catch (e) {
            setError((e as { message?: string })?.message ?? 'Error');
          }
        },
      },
    ]);
  };

  const firstLoad =
    !!editingId && eventQ.isPending && eventQ.data === undefined;
  if (firstLoad) {
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
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: BRAND.teal, 
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top - 22,
              right: -52,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: withAlpha(BRAND.lime, 0.14),
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
                style={{
                  color: '#FFFFFF',
                  fontSize: 20,
                  fontWeight: '800',
                  marginTop: 2,
                }}
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
        </View>

        <View style={{ padding: spacing.lg }}>
          {/* COVER */}
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, fontWeight: '700' },
            ]}
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
                    backgroundColor: 'rgba(14,38,44,0.65)',
                  }}
                >
                  <Ionicons name="camera" size={15} color="#FFFFFF" />
                  <Text
                    style={[
                      typography.caption,
                      { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
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
                  borderColor: withAlpha(colors.primary, 0.6),
                  borderStyle: 'dashed',
                  backgroundColor: withAlpha(colors.primary, 0.06),
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
                    backgroundColor: withAlpha(colors.primary, 0.16),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="image" size={26} color={colors.primary} />
                </View>
                <Text
                  style={[
                    typography.body,
                    { color: colors.primary, fontWeight: '700' },
                  ]}
                >
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
              <Text
                style={[
                  typography.caption,
                  { color: colors.error, fontWeight: '700' },
                ]}
              >
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
            <EditorField
              icon="text"
              label={t('events.titleField')}
              value={title}
              onChange={setTitle}
            />
            <EditorField
              icon="location"
              label={t('events.locationField')}
              value={location}
              onChange={setLocation}
            />

            {/* Ethiopian Date — full-width picker */}
            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.textSecondary,
                  marginTop: spacing.md,
                  marginBottom: spacing.xs,
                  fontWeight: '700',
                },
              ]}
            >
              {t('events.dateField')}
            </Text>

            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1.5,
                borderRadius: radius.md + 4,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
              }}
            >
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>
                {formatEthDate(ethDate, lang)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>

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
              <Text
                style={[typography.bodySmall, { color: colors.error, flex: 1 }]}
              >
                {error}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

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
          <Ionicons
            name="document-text-outline"
            size={17}
            color={colors.text}
          />
          <Text
            style={[typography.button, { color: colors.text }]}
            numberOfLines={1}
          >
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
            shadowColor: colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <View style={{ backgroundColor: colors.primary, 
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <>
                <Ionicons name="rocket" size={17} color={colors.primaryText} />
                <Text
                  style={[
                    typography.button,
                    { color: colors.primaryText, fontWeight: '800' },
                  ]}
                  numberOfLines={1}
                >
                  {t('events.publishNow')}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </View>

      <EthDatePicker
        visible={pickerOpen}
        title={t('events.dateField')}
        value={ethDate}
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setEthDate(d);
          setPickerOpen(false);
        }}
        minYear={ethTodayFromInstant(new Date()).year - 1}
        maxYear={ethTodayFromInstant(new Date()).year + 2}
      />
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
          {
            color: colors.textSecondary,
            marginBottom: spacing.xs,
            fontWeight: '700',
          },
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
          borderColor: focused ? colors.primary : colors.border,
          borderWidth: 1.5,
          borderRadius: radius.md + 4,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={focused ? colors.primary : colors.textSecondary}
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