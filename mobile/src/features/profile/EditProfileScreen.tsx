import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getOwnProfile,
  updateOwnProfile,
  uploadOwnPhoto,
} from '../../services/members';
import { ApiError } from '../../services/api';

export default function EditProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emgName, setEmgName] = useState('');
  const [emgPhone, setEmgPhone] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const p = await getOwnProfile();
        setPhotoUrl(p.editable.profilePhotoUrl);
        setEmail(p.editable.email ?? '');
        setPhone(p.editable.phone);
        setEmgName(p.editable.emergencyContactName);
        setEmgPhone(p.editable.emergencyContactPhone);
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pickPhoto = () => {
    Alert.alert(t('myProfile.editPhoto'), undefined, [
      { text: t('register.takePhoto'), onPress: takePhoto },
      { text: t('register.chooseFromLibrary'), onPress: chooseFromLibrary },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
  };

  const compress = async (uri: string) => {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    try {
      setBusy(true);
      const { profilePhotoUrl } = await uploadOwnPhoto(out.uri);
      setPhotoUrl(profilePhotoUrl);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateOwnProfile({
        email: email.trim(),
        phone: phone.trim(),
        emergencyContactName: emgName.trim(),
        emergencyContactPhone: emgPhone.trim(),
      });
      setSaved(true);
      setTimeout(() => navigation.goBack(), 700);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
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
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        flexGrow: 1,
        backgroundColor: colors.background,
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={pickPhoto}>
          <Image
            source={{ uri: photoUrl ?? undefined }}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.surfaceAlt,
            }}
          />
          <Text
            style={[
              typography.caption,
              { color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
            ]}
          >
            {t('myProfile.editPhoto')}
          </Text>
        </Pressable>
      </View>

      <Field label={t('register.phone')} value={phone} onChange={setPhone} keyboardType="phone-pad" />
      <Field label={t('register.email')} value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('register.emergencyContactName')} value={emgName} onChange={setEmgName} />
      <Field label={t('register.emergencyContactPhone')} value={emgPhone} onChange={setEmgPhone} keyboardType="phone-pad" />

      {error && (
        <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
          {error}
        </Text>
      )}
      {saved && (
        <Text style={[typography.bodySmall, { color: colors.success, marginTop: spacing.md }]}>
          {t('myProfile.saved')}
        </Text>
      )}

      <Pressable
        onPress={onSave}
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
            {t('myProfile.saveChanges')}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginBottom: spacing.md }}>
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
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          fontSize: typography.body.fontSize,
        }}
      />
    </View>
  );
}