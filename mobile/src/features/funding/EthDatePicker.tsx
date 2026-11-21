import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { PrimaryButton } from '../auth/Auth_UI';
import {
  EthDate, ETH_MONTHS_EN, ETH_MONTHS_AM, daysInEthMonth, formatEthDate, ethTodayFromInstant,
} from '../../utils/ethiopianCalendar';
import { ActionBtn, FieldLabel } from './fundingKit';

type Props = {
  visible: boolean; title: string; value: EthDate;
  onClose: () => void; onConfirm: (d: EthDate) => void;
  minYear?: number; maxYear?: number;
};

// Fixed chip widths + gaps make every chip's x-position deterministic:
// chip i starts at exactly i * STRIDE, so no measuring is needed.
const GAP = 8; // must equal marginRight in `chip`
const YEAR_W = 64;
const YEAR_STRIDE = YEAR_W + GAP;
const MONTH_W = 100;
const MONTH_STRIDE = MONTH_W + GAP;

export default function EthDatePicker({ visible, title, value, onClose, onConfirm, minYear, maxYear }: Props) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const months = lang === 'am' ? ETH_MONTHS_AM : ETH_MONTHS_EN;
  const [d, setD] = useState<EthDate>(value);

  const yearScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);

  const thisYear = ethTodayFromInstant(new Date()).year;
  const lo = Math.min(minYear ?? thisYear - 100, value.year);
  const hi = Math.max(maxYear ?? thisYear, value.year);

  // DESCENDING ORDER: 2019, 2018, 2017... so current is on the left
  const years = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);

  // Jump both horizontal lists to the INITIAL value (the prop, not local state,
  // so we never scroll against a stale selection).
  const scrollToSelected = () => {
    const yi = years.indexOf(value.year);
    if (yi >= 0) {
      yearScrollRef.current?.scrollTo({ x: yi * YEAR_STRIDE, animated: false });
    }
    monthScrollRef.current?.scrollTo({
      x: Math.max(0, (value.month - 1) * MONTH_STRIDE - MONTH_STRIDE), // peek previous month
      animated: false,
    });
  };

  // Reset local state when opened + fallback scroll.
  // Some Android builds drop a scrollTo fired during the first layout pass
  // while the Modal is still sliding in, so we retry shortly after.
  useEffect(() => {
    if (!visible) return;
    setD(value);
    const id = setTimeout(scrollToSelected, 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value]);

  const set = (p: Partial<EthDate>) =>
    setD((cur) => {
      const n = { ...cur, ...p };
      n.day = Math.min(n.day, daysInEthMonth(n.year, n.month));
      return n;
    });

  const chip = (on: boolean, width: number) => ({
    width,
    height: 44,
    justifyContent: 'center' as const,
    borderRadius: 14,
    marginRight: GAP,
    backgroundColor: on ? colors.primary : colors.surfaceAlt,
    alignItems: 'center' as const,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30,
          paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 20, maxHeight: '88%',
          borderTopWidth: 1, borderColor: colors.border,
        }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 }} />
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 2, marginBottom: 14 }}>
            {t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <FieldLabel text={t('funding.yearLabel')} />

            <ScrollView
              ref={yearScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              onContentSizeChange={scrollToSelected}
            >
              {years.map((y) => (
                <Pressable key={y} onPress={() => set({ year: y })} accessibilityRole="button" accessibilityState={{ selected: d.year === y }} style={chip(d.year === y, YEAR_W)}>
                  <Text style={{ color: d.year === y ? colors.primaryText : colors.text, fontWeight: '800' }}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <FieldLabel text={t('funding.monthLabel')} />

            <ScrollView
              ref={monthScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              onContentSizeChange={scrollToSelected}
            >
              {months.map((m, i) => (
                <Pressable key={m} onPress={() => set({ month: i + 1 })} accessibilityRole="button" accessibilityState={{ selected: d.month === i + 1 }} style={chip(d.month === i + 1, MONTH_W)}>
                  <Text style={{ color: d.month === i + 1 ? colors.primaryText : colors.text, fontWeight: '800' }}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <FieldLabel text={t('funding.dayLabel')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: daysInEthMonth(d.year, d.month) }, (_, i) => i + 1).map((day) => (
                <Pressable key={day} onPress={() => set({ day })} accessibilityRole="button" accessibilityState={{ selected: d.day === day }}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: d.day === day ? colors.primary : colors.surfaceAlt }}>
                  <Text style={{ color: d.day === day ? colors.primaryText : colors.text, fontWeight: '800' }}>{day}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginVertical: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt,
          }}>
            <Ionicons name="calendar" size={16} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '800' }}>{formatEthDate(d, lang)}</Text>
          </View>
          <PrimaryButton label={t('funding.done')} onPress={() => { onConfirm(d); onClose(); }} />
          <ActionBtn variant="ghost" label={t('common.cancel')} onPress={onClose} style={{ marginTop: 4 }} />
        </View>
      </View>
    </Modal>
  );
}