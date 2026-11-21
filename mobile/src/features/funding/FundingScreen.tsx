import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { subscribeRole, getRole } from '../../services/role';
import { ScreenHero } from '../profile/SettingsKit';
import { SegmentedControl } from './fundingKit';
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
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { key: 'mine', label: t('funding.tabMine'), icon: 'person-outline' },
              { key: 'review', label: t('funding.tabReview'), icon: 'shield-checkmark-outline' },
            ]}
          />
        </View>
      )}

      {/* 3. Scrollable Content */}
      <View style={{ flex: 1, marginTop: 12 }}>
        {tab === 'review' && leader ? <LeaderFunding /> : <MemberFunding />}
      </View>
    </View>
  );
}