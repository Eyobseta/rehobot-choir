import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { subscribeRole, getRole } from '../../services/role';
import { WaterDrops, BRAND } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import MemberFunding from './MemberFunding';
import LeaderFunding from './LeaderFunding';

/**
 * Profile > Funding. One screen.
 * Everyone sees "My funding". Leaders also get a "Review" tab (verification queue + totals).
 */
export default function FundingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [leader, setLeader] = useState(getRole() === 'LEADER');
  const [tab, setTab] = useState<'mine' | 'review'>('mine');
  useEffect(() => subscribeRole((r) => setLeader(r === 'LEADER')), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 1. Pinned Header */}
      <ScreenHero
        icon="wallet"
        title={t('funding.title')}
        subtitle={t('funding.subtitle')}
        onBack={() => navigation.goBack()}
      />

      {/* 2. Pinned Tabs (My funding / Review) */}
      {leader && (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            {(['mine', 'review'] as const).map((k) => {
              const active = tab === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setTab(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: active ? BRAND.violet : 'transparent' }}
                >
                  <Text style={{ color: active ? '#FFFFFF' : colors.text, fontWeight: '800', fontSize: 13 }}>
                    {k === 'mine' ? t('funding.tabMine') : t('funding.tabReview')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. Scrollable Content */}
      <View style={{ flex: 1, marginTop: 12 }}>
        {tab === 'review' && leader ? <LeaderFunding /> : <MemberFunding />}
      </View>
      
      <WaterDrops />
    </View>
  );
}