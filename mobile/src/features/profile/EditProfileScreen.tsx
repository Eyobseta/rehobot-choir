import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { KeyboardAwareScroll, AuthField, AvatarRing, ErrorBanner, BRAND } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  useOwnProfileQuery,
  useUpdateOwnProfileMutation,
  useUploadProfilePhotoMutation,
} from './useProfile';
import {
  ActionButton,
  FieldIcon,
  HeroShell,
  StaffLines,
  SuccessBanner,
} from './SettingsKit';

const AVATAR = 128;

export default function EditProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const q = useOwnProfileQuery();
  const updateMut = useUpdateOwnProfileMutation();
  const uploadMut = useUploadProfilePhotoMutation();

  const firstLoad = q.isPending && q.data === undefined;
  const savedProfile = q.data;

  // Local form state, populated once the cached profile arrives.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emgName, setEmgName] = useState('');
  const [emgPhone, setEmgPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!savedProfile) return;
    setPhotoUrl(savedProfile.editable.profilePhotoUrl);
    setEmail(savedProfile.editable.email ?? '');
    setPhone(savedProfile.editable.phone);
    setEmgName(savedProfile.editable.emergencyContactName);
    setEmgPhone(savedProfile.editable.emergencyContactPhone);
  }, [savedProfile]);

  const busy = updateMut.isPending || uploadMut.isPending;

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
    setError(null);
    try {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      const { profilePhotoUrl } = await uploadMut.mutateAsync(out.uri);
      setPhotoUrl(profilePhotoUrl);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'FILE_TOO_LARGE') {
        setError(
          t('editProfile.photoTooLarge', {
            defaultValue: 'The photo is too large. Please choose a smaller one.',
          }),
        );
      } else if (err.code === 'INVALID_FILE_TYPE') {
        setError(
          t('editProfile.invalidFileType', {
            defaultValue: 'Only images are allowed.',
          }),
        );
      } else {
        setError(err.message ?? 'Error');
      }
    }
  };

  const onSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await updateMut.mutateAsync({
        email: email.trim(),
        phone: phone.trim(),
        emergencyContactName: emgName.trim(),
        emergencyContactPhone: emgPhone.trim(),
      });
      setSaved(true);
      setTimeout(() => navigation.goBack(), 700);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'PHONE_TAKEN') {
        setError(
          t('editProfile.phoneTaken', {
            defaultValue: 'This phone number is already in use.',
          }),
        );
      } else if (err.code === 'EMAIL_TAKEN') {
        setError(
          t('editProfile.emailTaken', {
            defaultValue: 'This email is already in use.',
          }),
        );
      } else {
        setError(err.message ?? 'Error');
      }
    }
  };

  const enter = useRef(new Animated.Value(0)).current;
  const camBob = useRef(new Animated.Value(0)).current;
  const savedPop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (firstLoad) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(camBob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(camBob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    bob.start();
    return () => bob.stop();
  }, [firstLoad, enter, camBob]);

  useEffect(() => {
    if (saved) {
      savedPop.setValue(0);
      Animated.spring(savedPop, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 14,
      }).start();
    }
  }, [saved, savedPop]);

  useEffect(() => {
    if (error) {
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 6, -6, 0].map((v) =>
          Animated.timing(shake, {
            toValue: v,
            duration: 60,
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  }, [error, shake]);

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

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [24 + i * 10, 0],
        }),
      },
    ],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScroll drops={false} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
        <Animated.View style={fadeUp(0)}>
          <HeroShell paddingBottom={28} radiusBottom={32}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }} />
              <GlassBackButton
                onPress={() => navigation.goBack()}
                accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
                size={44}
              />
            </View>

            <View style={styles.avatarWrap}>
              <StaffLines top={AVATAR / 2 - 20} />
              <PressScale onPress={pickPhoto} disabled={busy} label={t('myProfile.editPhoto')}>
                <AvatarRing
                  size={AVATAR}
                  uri={photoUrl}
                  gapColor={BRAND.teal}
                  fallback={<Ionicons name="person" size={52} color="rgba(255,255,255,0.6)" />}
                >
                  {uploadMut.isPending ? (
                    <View style={styles.busyOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  ) : null}
                  <Animated.View
                    style={[
                      styles.camBadge,
                      {
                        transform: [
                          {
                            translateY: camBob.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -3],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="camera" size={19} color={BRAND.teal} />
                  </Animated.View>
                </AvatarRing>
              </PressScale>
            </View>

            <Pressable
              onPress={pickPhoto}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('myProfile.editPhoto')}
              style={styles.chip}
            >
              <Ionicons name="image" size={13} color={BRAND.lime} />
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                {t('myProfile.editPhoto')}
              </Text>
            </Pressable>
          </HeroShell>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              fadeUp(1),
            ]}
          >
            <AuthField
              label={t('register.phone')}
              iconNode={<FieldIcon name="call" tone="mint" />}
              showCheck
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <AuthField
              label={t('register.email')}
              iconNode={<FieldIcon name="mail" tone="lavender" />}
              showCheck
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthField
              label={t('register.emergencyContactName')}
              iconNode={<FieldIcon name="heart" tone="peach" />}
              showCheck
              value={emgName}
              onChangeText={setEmgName}
              autoCapitalize="words"
            />
            <AuthField
              label={t('register.emergencyContactPhone')}
              iconNode={<FieldIcon name="medkit" tone="lime" />}
              showCheck
              value={emgPhone}
              onChangeText={setEmgPhone}
              keyboardType="phone-pad"
            />
          </Animated.View>

          {error && (
            <Animated.View style={{ marginTop: spacing.lg, transform: [{ translateX: shake }] }}>
              <ErrorBanner message={error} />
            </Animated.View>
          )}
          {saved && (
            <SuccessBanner
              text={t('myProfile.saved')}
              animatedStyle={{
                opacity: savedPop,
                transform: [
                  {
                    scale: savedPop.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              }}
            />
          )}

          <Animated.View style={[{ marginTop: 28 }, fadeUp(2)]}>
            <ActionButton
              icon="save-outline"
              label={t('myProfile.saveChanges')}
              onPress={onSave}
              busy={busy}
            />
          </Animated.View>
        </View>
      </KeyboardAwareScroll>
    </View>
  );
}

function PressScale({ onPress, children, disabled, label }: any) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(0.95)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroTopRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 4 },
  avatarWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 6 },
  camBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: BRAND.teal,
    backgroundColor: BRAND.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyOverlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 72,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginTop: 14,
    backgroundColor: BRAND.tealDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginTop: 20,
  },
});