import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { logout, me } from '../../services/auth';
import { getOwnProfile } from '../../services/members';
import { getMyQuoteCount } from '../../services/quotes';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';
import { AvatarRing, BRAND } from '../auth/Auth_UI';
import {
  ActionButton,
  Group,
  HeroChip,
  HeroShell,
  IconTile,
  NavRow,
  SectionLabel,
  StaffLines,
} from './SettingsKit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const AVATAR = 128;

export default function ProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

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
        {/* Hero. The absolute block fills the overscroll area above the hero. */}
        <View>
          <View pointerEvents="none" style={styles.overscroll} />
          <HeroShell paddingBottom={64} radiusBottom={36} paddingHorizontal={spacing.xl}>
            <Animated.View
              style={[
                styles.brand,
                { opacity: brandIn, transform: [{ translateY: brandIn.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
              ]}
            >
              <Animated.View
                style={[
                  styles.brandMark,
                  { transform: [{ scale: brandPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }, { rotate: brandPulse.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) }] },
                ]}
              >
                <Ionicons name="musical-notes" size={18} color={BRAND.teal} />
              </Animated.View>
              <Text style={styles.brandText}>{t('common.appName')}</Text>
            </Animated.View>

            <Animated.View style={[styles.identity, fadeUp(0)]}>
              <View style={styles.avatarWrap}>
                <StaffLines top={AVATAR / 2 - 20} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('myProfile.title')}
                  onPress={() => navigation.navigate('OwnProfile')}
                >
                  <AvatarRing
                    size={AVATAR}
                    uri={photoUrl}
                    gapColor={BRAND.teal}
                    fallback={
                      <Text style={{ fontSize: 40, fontWeight: '800', color: BRAND.lime }}>
                        {(fullName || phone || '?').trim().charAt(0).toUpperCase()}
                      </Text>
                    }
                  >
                    <View style={styles.editBadge}>
                      <Ionicons name="pencil" size={15} color={BRAND.teal} />
                    </View>
                  </AvatarRing>
                </Pressable>
              </View>

              <Text style={styles.name} numberOfLines={2}>{fullName || phone}</Text>
              <View style={styles.chips}>
                {roleLabel ? <HeroChip solid icon="musical-note" text={roleLabel} /> : null}
                {phone ? <HeroChip icon="call-outline" text={phone} /> : null}
              </View>
            </Animated.View>
          </HeroShell>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Animated.View style={[{ marginTop: -34 }, fadeUp(1)]}>
            <ProfileActionCard
              icon="person-outline"
              title={t('myProfile.title')}
              subtitle={t('profile.personalInfo', { defaultValue: 'View and edit your details' })}
              onPress={() => navigation.navigate('OwnProfile')}
            />
          </Animated.View>

          {quoteCount !== null && (
            <Animated.View
              style={[styles.quotes, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(2)]}
            >
              <IconTile name="book-outline" tone="peach" size={44} iconSize={22} radius={14} />
              <Text style={[styles.quoteLabel, { color: colors.text }]}>
                {t('quote.publishedCount', { count: quoteCount })}
              </Text>
              <Ionicons name="sparkles" size={20} color={colors.accent} />
            </Animated.View>
          )}

          <Animated.View style={fadeUp(3)}>
            <SectionLabel title={t('profile.activitySection', { defaultValue: 'Your activity' })} />
            <Group>
              <NavRow label={t('notifications.title')} icon="notifications-outline" tone="lavender" onPress={() => navigation.navigate('Notifications')} />
              <NavRow label={t('attendance.history')} icon="calendar-outline" tone="mint" onPress={() => navigation.navigate('MyAttendance')} />
              <NavRow label={t('funding.title')} icon="wallet-outline" tone="peach" onPress={() => navigation.navigate('Funding')} last />
            </Group>
          </Animated.View>

          <Animated.View style={fadeUp(4)}>
            <SectionLabel title={t('profile.preferencesSection', { defaultValue: 'Make it yours' })} />
            <Group>
              <NavRow label={t('notifications.preferences')} icon="options-outline" tone="lavender" onPress={() => navigation.navigate('NotificationPreferences')} />
              <NavRow label={t('settings.appearance')} icon="color-palette-outline" tone="lime" onPress={() => navigation.navigate('Appearance')} />
              <NavRow label={t('settings.language')} icon="language-outline" tone="mint" onPress={() => navigation.navigate('Language')} last />
            </Group>
          </Animated.View>

          <Animated.View style={fadeUp(5)}>
            <SectionLabel title={t('profile.accountSection', { defaultValue: 'Account & security' })} />
            <Group>
              <NavRow label={t('password.changeTitle')} icon="lock-closed-outline" tone="peach" onPress={() => navigation.navigate('ChangePassword')} />
              <NavRow
                label={t('profile.aboutSection', { defaultValue: 'About this app' })}
                icon="information-circle-outline"
                tone="mint"
                onPress={() => navigation.navigate('About')}
              />
              <NavRow label={t('deleteAccount.title')} icon="trash-outline" tone="danger" onPress={() => navigation.navigate('DeleteAccount')} danger last />
            </Group>

            <View style={{ marginTop: 22 }}>
              <ActionButton
                variant="dangerOutline"
                icon="log-out-outline"
                label={t('profile.logout', { defaultValue: 'Log out' })}
                onPress={onLogout}
              />
            </View>
          </Animated.View>

          <View style={styles.footer}>
            <Ionicons name="musical-notes-outline" size={15} color={muted} />
            <Text style={[styles.footerText, { color: muted }]}>{t('common.appName')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- ProfileActionCard ----------

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
        shadowColor: BRAND.deep,
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: BRAND.lavender }} />
        <View style={{ marginLeft: 4 }}>
          <IconTile name={icon} tone="lavender" size={46} iconSize={22} radius={15} />
        </View>

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
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primaryText} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 32 },
  overscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: BRAND.teal },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.lime },
  brandText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  identity: { alignItems: 'center', paddingTop: 22 },
  avatarWrap: { alignSelf: 'stretch', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND.lime, borderWidth: 3, borderColor: BRAND.teal, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', marginTop: 16, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  quotes: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 22, padding: 14, marginTop: 16 },
  quoteLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  footer: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  footerText: { fontSize: 11 },
});