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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getOwnProfile,
  updateOwnProfile,
  uploadOwnPhoto,
} from '../../services/members';
import { ApiError } from '../../services/api';
import {
  KeyboardAwareScroll,
  AuthField,
  AvatarRing,
  PrimaryButton,
  ErrorBanner,
  BRAND,
  withAlpha,
} from '../auth/Auth_UI';

// Soft accents for the field icons; theme tokens still drive surfaces and text.
const accents = {
  cyan: '#6EDBD5',
  pink: '#EE9BBD',
  gold: '#E6C779',
  lime: '#B8E986',
};

export default function EditProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

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

  // ---- Visual-only motion ----
  const enter = useRef(new Animated.Value(0)).current;
  const camBob = useRef(new Animated.Value(0)).current;
  const savedPop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) return;
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(camBob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(camBob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    bob.start();
    return () => bob.stop();
  }, [loading, enter, camBob]);

  useEffect(() => {
    if (saved) {
      savedPop.setValue(0);
      Animated.spring(savedPop, { toValue: 1, useNativeDriver: true, bounciness: 14 }).start();
    }
  }, [saved, savedPop]);

  useEffect(() => {
    if (error) {
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })),
      ).start();
    }
  }, [error, shake]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 10, 0] }) }],
  });

  const fieldIcon = (name: React.ComponentProps<typeof Ionicons>['name'], tint: string) => (
    <View style={[styles.fieldIcon, { backgroundColor: withAlpha(tint, 0.18) }]}>
      <Ionicons name={name} size={16} color={tint} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScroll contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl * 2 }}>
        {/* Hero with avatar */}
        <Animated.View style={fadeUp(0)}>
          <LinearGradient
            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View pointerEvents="none" style={[styles.blob, { top: -50, right: -50, backgroundColor: withAlpha(BRAND.gold, 0.18) }]} />
            <View pointerEvents="none" style={[styles.blob, { bottom: -70, left: -50, backgroundColor: withAlpha(BRAND.water, 0.2) }]} />

            <PressScale onPress={pickPhoto} disabled={busy}>
              <AvatarRing
                size={128}
                uri={photoUrl}
                gapColor={BRAND.deep}
                fallback={<Ionicons name="person" size={52} color={withAlpha('#FFFFFF', 0.6)} />}
              >
                {busy ? (
                  <View style={styles.busyOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
                <Animated.View
                  style={[
                    styles.camBadge,
                    { transform: [{ translateY: camBob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
                  ]}
                >
                  <Ionicons name="camera" size={18} color={BRAND.deep} />
                </Animated.View>
              </AvatarRing>
            </PressScale>

            <Pressable onPress={pickPhoto} disabled={busy} style={styles.chip}>
              <Ionicons name="image" size={13} color={BRAND.gold} />
              <Text style={{ color: BRAND.gold, fontSize: 13, fontWeight: '700' }}>{t('myProfile.editPhoto')}</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* Fields */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            fadeUp(1),
          ]}
        >
          <AuthField
            label={t('register.phone')}
            iconNode={fieldIcon('call', accents.lime)}
            showCheck
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <AuthField
            label={t('register.email')}
            iconNode={fieldIcon('mail', accents.cyan)}
            showCheck
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AuthField
            label={t('register.emergencyContactName')}
            iconNode={fieldIcon('heart', accents.pink)}
            showCheck
            value={emgName}
            onChangeText={setEmgName}
            autoCapitalize="words"
          />
          <AuthField
            label={t('register.emergencyContactPhone')}
            iconNode={fieldIcon('medkit', accents.gold)}
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
          <Animated.View
            style={[
              styles.savedBox,
              {
                borderLeftColor: colors.success,
                backgroundColor: withAlpha(colors.success, 0.14),
                opacity: savedPop,
                transform: [{ scale: savedPop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[typography.bodySmall, { color: colors.success, flex: 1, fontWeight: '600' }]}>
              {t('myProfile.saved')}
            </Text>
          </Animated.View>
        )}

        <Animated.View style={[{ marginTop: 28 }, fadeUp(2)]}>
          <PrimaryButton
            label={t('myProfile.saveChanges')}
            onPress={onSave}
            busy={busy}
            iconNode={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
          />
        </Animated.View>
      </KeyboardAwareScroll>
    </View>
  );
}

function PressScale({ onPress, children, disabled }: any) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => to(0.95)} onPressOut={() => to(1)}>
      <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderRadius: 28, overflow: 'hidden' },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  camBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 40, height: 40, borderRadius: 20,
    borderWidth: 3, borderColor: BRAND.deep, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center',
  },
  busyOverlay: {
    position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 64,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.16)',
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 20 },
  fieldIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  savedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12,
    borderRadius: 12, borderLeftWidth: 4,
  },
});