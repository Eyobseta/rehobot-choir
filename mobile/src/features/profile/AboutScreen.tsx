import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Linking, StyleSheet, Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND } from '../auth/Auth_UI';
import { Group, InfoRow, NavRow, ScreenHero, SectionLabel } from './SettingsKit';
import { me } from '../../services/auth';

// ---------- App Info ----------
// Only non-translatable constants live here; every user-facing string
// is read from i18n at render time.
const APP_INFO = {
  contactEmail: 'eyobseta50@gmail.com',
  developerName: 'Eyob Seta',
  developerNickname: 'JOSE',
  organization: 'Rehobot Choir · Negelle Arsi No. 1 Kale Hiwot Church',
  year: new Date().getFullYear(),
};

export default function AboutScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await me();
        setIsLeader(res.user.role === 'LEADER' || res.user.role === 'ADMIN');
      } catch {
        setIsLeader(false);
      }
    })();
  }, []);

  // --- CRASH-PROOF VERSION INFO ---
  let appVersion: string = '1.0.0';
  let buildNumber: string | number = '—';
  let runtimeVersion: string = '—';
  let sdkVersion: string = '—';

  try {
    const cfg = Constants.expoConfig;
    if (cfg) {
      appVersion = cfg.version ?? appVersion;
      buildNumber =
        Platform.OS === 'ios'
          ? cfg.ios?.buildNumber ?? '—'
          : cfg.android?.versionCode ?? '—';
      runtimeVersion = String(cfg.runtimeVersion ?? '—');
      sdkVersion = String(cfg.sdkVersion ?? '—');
    }
  } catch (e) {}

  let updateId: string | null = null;
  let updateChannel: string | number = '—';
  let updateCreatedAt = '—';
  let isEmbedded = true;

  try {
    updateId = Updates.updateId ?? null;
    updateChannel = Updates.channel ?? '—';
    updateCreatedAt = Updates.createdAt
      ? new Date(Updates.createdAt).toLocaleString()
      : '—';
    isEmbedded = Updates.isEmbeddedLaunch ?? true;
  } catch (e) {}

  let deviceName = 'Unknown device';
  let deviceModel = '—';
  let deviceOS: string = Platform.OS;

  try {
    deviceName = Device.deviceName ?? 'Unknown device';
    deviceModel = Device.modelName ?? '—';
    deviceOS = String(`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`).trim();
  } catch (e) {}
  // --------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="information-circle"
        overline={t('tabs.profile', { defaultValue: 'Profile' })}
        title={t('about.title', { defaultValue: 'About' })}
        subtitle={APP_INFO.organization}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand card */}
        <View style={[styles.brandCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.brandRing}>
            <View style={styles.brandLogo}>
              <Ionicons name="musical-notes" size={28} color={BRAND.teal} />
            </View>
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: 14 }]}>
            {t('common.appName')}
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}
          >
            {t('about.tagline', { defaultValue: 'Sing together, grow together' })}
          </Text>
          <View style={[styles.versionPill, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[typography.caption, { color: colors.text, fontWeight: '800' }]}>
              v{appVersion} ({buildNumber})
            </Text>
          </View>
        </View>

        {/* Developer */}
        <SectionLabel title={t('about.developerSection', { defaultValue: 'Built by' })} />
        <Group>
          <InfoRow
            icon="code-slash"
            tone="lavender"
            label={t('about.developer', { defaultValue: 'Developer' })}
            value={`${APP_INFO.developerNickname} · ${APP_INFO.developerName}`}
            numberOfLines={3}
            selectable
          />
          <InfoRow
            icon="mail"
            tone="mint"
            label={t('about.developerEmail', { defaultValue: 'Developer email' })}
            value={APP_INFO.contactEmail}
            numberOfLines={3}
            selectable
            last
          />
        </Group>

        {/* Build */}
        <SectionLabel title={t('about.buildSection', { defaultValue: 'Build' })} />
        <Group>
          <InfoRow
            icon="cloud-download"
            tone="lavender"
            label={t('about.updateChannel', { defaultValue: 'Update channel' })}
            value={String(updateChannel)}
            numberOfLines={3}
            selectable
          />
          <InfoRow
            icon="git-commit"
            tone="mint"
            label={t('about.updateId', { defaultValue: 'Update ID' })}
            value={
              isEmbedded
                ? t('about.embedded', { defaultValue: 'Embedded (original build)' })
                : updateId ?? '—'
            }
            numberOfLines={3}
            selectable
          />
          <InfoRow
            icon="time"
            tone="peach"
            label={t('about.updateDate', { defaultValue: 'Update published' })}
            value={isEmbedded ? '—' : updateCreatedAt}
            numberOfLines={3}
            selectable
          />
          <InfoRow
            icon="layers"
            tone="lime"
            label={t('about.runtimeVersion', { defaultValue: 'Runtime version' })}
            value={String(runtimeVersion)}
            numberOfLines={3}
            selectable
          />
          <InfoRow
            icon="cube"
            tone="lavender"
            label={t('about.sdkVersion', { defaultValue: 'Expo SDK' })}
            value={String(sdkVersion)}
            numberOfLines={3}
            selectable
            last
          />
        </Group>

        {/* Device (leaders only) */}
        {isLeader && (
          <>
            <SectionLabel title={t('about.deviceSection', { defaultValue: 'Device (leaders only)' })} />
            <Group>
              <InfoRow
                icon="phone-portrait"
                tone="lavender"
                label={t('about.deviceName', { defaultValue: 'Device' })}
                value={deviceName}
                numberOfLines={3}
                selectable
              />
              <InfoRow
                icon="hardware-chip"
                tone="mint"
                label={t('about.deviceModel', { defaultValue: 'Model' })}
                value={deviceModel}
                numberOfLines={3}
                selectable
              />
              <InfoRow
                icon="logo-android"
                tone="lime"
                label={t('about.deviceOs', { defaultValue: 'OS' })}
                value={deviceOS}
                numberOfLines={3}
                selectable
                last
              />
            </Group>
          </>
        )}

        {/* Contact */}
        <SectionLabel title={t('about.contactSection', { defaultValue: 'Contact' })} />
        <Group>
          <NavRow
            icon="mail"
            tone="peach"
            label={t('about.email', { defaultValue: 'Email' })}
            value={APP_INFO.contactEmail}
            onPress={() => Linking.openURL(`mailto:${APP_INFO.contactEmail}`).catch(() => {})}
            last
          />
        </Group>

        {/* Legal */}
        <SectionLabel title={t('about.legalSection', { defaultValue: 'Legal' })} />
        <Group>
          <NavRow
            icon="shield-checkmark"
            tone="lavender"
            label={t('about.privacy', { defaultValue: 'Privacy Policy' })}
            onPress={() =>
              Alert.alert(
                t('about.privacy', { defaultValue: 'Privacy Policy' }),
                t('about.privacyBody', {
                  defaultValue:
                    'This app keeps all data inside the Rehobot Choir. Contact the choir leadership for data requests.',
                }),
              )
            }
          />
          <NavRow
            icon="document-text"
            tone="mint"
            label={t('about.terms', { defaultValue: 'Terms of Service' })}
            onPress={() =>
              Alert.alert(
                t('about.terms', { defaultValue: 'Terms of Service' }),
                t('about.termsBody', {
                  defaultValue:
                    'By using this app you agree to respect choir members, keep their information private, and only post content you have the right to share.',
                }),
              )
            }
            last
          />
        </Group>

        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, textAlign: 'center', marginTop: 28, lineHeight: 18 },
          ]}
        >
          {t('about.footer', {
            nick: APP_INFO.developerNickname,
            name: APP_INFO.developerName,
            year: APP_INFO.year,
            defaultValue: 'Made with ♥ by {{nick}} ({{name}})\n© {{year}} Rehobot Choir',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  brandRing: {
    width: 78,
    height: 78,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: BRAND.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: BRAND.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionPill: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
});