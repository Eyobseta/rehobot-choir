import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { logout, me } from '../../services/auth';
import { getOwnProfile } from '../../services/members';
import { getMyQuoteCount } from '../../services/quotes';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';
import { AvatarRing, WaterDrops, BRAND, withAlpha } from '../auth/Auth_UI';

const accents = {
  violet: '#B6A0FF', violetSoft: '#B6A0FF22',
  cyan: '#6EDBD5', cyanSoft: '#6EDBD522',
  pink: '#EE9BBD', pinkSoft: '#EE9BBD22',
  gold: '#E6C779', goldSoft: '#E6C77922',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [quoteCount, setQuoteCount] = useState<number | null>(null);

  const brandIn = useRef(new Animated.Value(0)).current;
  const brandPulse = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      brandIn.setValue(0);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(brandPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(brandPulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      Animated.timing(brandIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      pulse.start();
      return () => pulse.stop();
    }, [brandIn, brandPulse]),
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const res = await me();
          setPhone(res.user.phone);
          setRoleLabel(res.user.role);
        } catch { /* ignore */ }
        try {
          const p = await getOwnProfile();
          setFullName(p.official.fullName || '');
          setPhotoUrl(p.editable.profilePhotoUrl);
        } catch { /* ignore */ }
        try {
          setQuoteCount(await getMyQuoteCount());
        } catch {
          setQuoteCount(null);
        }
      })();
    }, []),
  );

  const onLogout = async () => {
    await logout();
    setRole(null);
    setSessionState('unauthenticated');
  };

  const muted = colors.textSecondary;
  const fadeUp = (i: number) => ({
    opacity: brandIn,
    transform: [{ translateY: brandIn.interpolate({ inputRange: [0, 1], outputRange: [28 + i * 12, 0] }) }],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------- Hero ---------- */}
        <View style={{ backgroundColor: BRAND.deep, marginTop: -1000, paddingTop: 1000 }}>
          <LinearGradient
            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 16 }]}
          >
            <View pointerEvents="none" style={[styles.blob, { top: -60, left: -70, backgroundColor: withAlpha(BRAND.gold, 0.18) }]} />
            <View pointerEvents="none" style={[styles.blob, { bottom: -80, right: -60, width: 230, height: 230, borderRadius: 115, backgroundColor: withAlpha(BRAND.water, 0.2) }]} />

            <Animated.View style={[styles.brand, { opacity: brandIn, transform: [{ translateY: brandIn.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
              <Animated.View
                style={[
                  styles.brandMark,
                  { transform: [{ scale: brandPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }, { rotate: brandPulse.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] },
                ]}
              >
                <Ionicons name="musical-notes" size={18} color={BRAND.deep} />
              </Animated.View>
              <Text style={styles.brandText}>{t('common.appName')}</Text>
            </Animated.View>

            <Text style={styles.title}>{t('tabs.profile')}</Text>
            <Text style={styles.subtitle}>
              {t('profile.spaceSubtitle', { defaultValue: 'Your little corner of the choir.' })}
            </Text>

            <Animated.View style={[styles.identity, fadeUp(0)]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('myProfile.title')}
                onPress={() => navigation.navigate('OwnProfile')}
              >
                <AvatarRing
                  size={160}
                  uri={photoUrl}
                  gapColor={BRAND.deep}
                  fallback={
                    <Text style={{ fontSize: 40, fontWeight: '800', color: BRAND.gold }}>
                      {(fullName || phone || '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  }
                >
                  <View style={styles.editBadge}>
                    <Ionicons name="pencil" size={16} color={BRAND.deep} />
                  </View>
                </AvatarRing>
              </Pressable>

              <Text style={styles.name} numberOfLines={2}>{fullName || phone}</Text>
              <View style={styles.phone}>
                <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.phoneText}>{phone}</Text>
              </View>
              {roleLabel ? (
                <View style={styles.memberBadge}>
                  <Ionicons name="musical-note" size={12} color={BRAND.gold} />
                  <Text style={styles.memberText}>{roleLabel}</Text>
                </View>
              ) : null}
            </Animated.View>
          </LinearGradient>
        </View>

        <View style={styles.body}>
          {/* ---------- Personal information card ---------- */}
          <Animated.View style={[{ marginTop: -32 }, fadeUp(1)]}>
            <ProfileActionCard
              icon="person-outline"
              title={t('myProfile.title')}
              subtitle={t('profile.personalInfo', { defaultValue: 'View and edit your details' })}
              onPress={() => navigation.navigate('OwnProfile')}
            />
          </Animated.View>

          {quoteCount !== null && (
            <Animated.View style={[styles.quotes, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(2)]}>
              <View style={[styles.iconTile, { backgroundColor: accents.goldSoft }]}>
                <Ionicons name="book-outline" size={23} color={accents.gold} />
              </View>
              <Text style={[styles.quoteLabel, { color: colors.text }]}>
                {t('quote.publishedCount', { count: quoteCount })}
              </Text>
              <Ionicons name="sparkles" size={20} color={accents.gold} />
            </Animated.View>
          )}

          <Animated.View style={fadeUp(3)}>
            <SectionLabel color={BRAND.violet} text={t('profile.activitySection', { defaultValue: 'Your activity' })} />
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row label={t('notifications.title')} icon="notifications-outline" tint={accents.violet} soft={accents.violetSoft} onPress={() => navigation.navigate('Notifications')} />
              <Row label={t('attendance.history')} icon="calendar-outline" tint={accents.cyan} soft={accents.cyanSoft} onPress={() => navigation.navigate('MyAttendance')} last />
            </View>
          </Animated.View>

          <Animated.View style={fadeUp(4)}>
            <SectionLabel color={BRAND.magenta} text={t('profile.preferencesSection', { defaultValue: 'Make it yours' })} />
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row label={t('notifications.preferences')} icon="options-outline" tint={accents.violet} soft={accents.violetSoft} onPress={() => navigation.navigate('NotificationPreferences')} />
              <Row label={t('settings.appearance')} icon="color-palette-outline" tint={accents.pink} soft={accents.pinkSoft} onPress={() => navigation.navigate('Appearance')} />
              <Row label={t('settings.language')} icon="language-outline" tint={accents.cyan} soft={accents.cyanSoft} onPress={() => navigation.navigate('Language')} last />
            </View>
          </Animated.View>

          <Animated.View style={fadeUp(5)}>
            <SectionLabel color={BRAND.gold} text={t('profile.accountSection', { defaultValue: 'Account & security' })} />
            <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row label={t('password.changeTitle')} icon="lock-closed-outline" tint={accents.gold} soft={accents.goldSoft} onPress={() => navigation.navigate('ChangePassword')} />
              <Row label={t('deleteAccount.title')} icon="trash-outline" tint={colors.error} soft={withAlpha(colors.error, 0.14)} onPress={() => navigation.navigate('DeleteAccount')} danger last />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [
                styles.logout,
                { borderColor: withAlpha(colors.error, 0.45), backgroundColor: pressed ? withAlpha(colors.error, 0.12) : colors.surface },
              ]}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[typography.button, { color: colors.error, fontWeight: '700' }]}>
                {t('profile.logout', { defaultValue: 'Log out' })}
              </Text>
            </Pressable>
          </Animated.View>

          <View style={styles.footer}>
            <Ionicons name="musical-notes-outline" size={15} color={muted} />
            <Text style={[styles.footerText, { color: muted }]}>{t('common.appName')}</Text>
          </View>
        </View>
      </ScrollView>
      <WaterDrops />
    </View>
  );
}

// ---------- ProfileActionCard: branded gradient-bordered button ----------

function ProfileActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        shadowColor: BRAND.violet,
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
        borderRadius: 22,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <LinearGradient
          colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 22, padding: 1.5 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderRadius: 20.5,
              backgroundColor: colors.surface,
            }}
          >
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={icon} size={22} color="#FFFFFF" />
            </LinearGradient>

            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: withAlpha(BRAND.magenta, 0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-forward" size={18} color={BRAND.magenta} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ---------- Helpers ----------

function SectionLabel({ color, text }: { color: string; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

function Row({
  label, onPress, icon, tint, soft, danger, last,
}: {
  label: string; onPress: () => void; icon: IconName; tint: string; soft: string; danger?: boolean; last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => to(0.98)}
      onPressOut={() => to(1)}
    >
      {({ pressed }) => (
        <Animated.View style={[styles.row, { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, transform: [{ scale: s }] }]}>
          <View style={[styles.iconTile, { backgroundColor: soft }]}>
            <Ionicons name={icon} size={21} color={tint} />
          </View>
          <View style={[styles.rowBody, { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  hero: { paddingHorizontal: 24, paddingBottom: 56, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  blob: { position: 'absolute', width: 210, height: 210, borderRadius: 105 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.gold },
  brandText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  title: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', marginTop: 22 },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.78)' },
  identity: { alignItems: 'center', paddingTop: 26 },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND.gold, borderWidth: 3, borderColor: BRAND.deep, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', marginTop: 16, textAlign: 'center' },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  phoneText: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  memberBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  memberText: { fontSize: 11, fontWeight: '800', color: BRAND.gold, letterSpacing: 0.5 },
  body: { paddingHorizontal: 24 },
  quotes: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 16, padding: 15, marginTop: 20 },
  quoteLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 11 },
  sectionBar: { width: 4, height: 14, borderRadius: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  group: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 66, gap: 13 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', minHeight: 66, alignItems: 'center', justifyContent: 'space-between', paddingRight: 17, gap: 10, paddingVertical: 13 },
  rowLabel: { fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  logout: { minHeight: 52, borderWidth: 1.5, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 26 },
  footer: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  footerText: { fontSize: 11 },
});