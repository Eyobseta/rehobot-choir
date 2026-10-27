import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, PrimaryButton } from '../auth/Auth_UI';
import {
  EthDate, ETH_MONTHS_EN, ETH_MONTHS_AM, daysInEthMonth, formatEthDate, ethTodayFromInstant,
} from '../../utils/ethiopianCalendar';

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
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: GAP,
    backgroundColor: on ? BRAND.violet : colors.background,
    alignItems: 'center' as const,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20, maxHeight: '85%' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 2, marginBottom: 14 }}>
            {t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })}
          </Text>

          <ScrollView>
            <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>{t('funding.yearLabel')}</Text>

            <ScrollView
              ref={yearScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              onContentSizeChange={scrollToSelected}
            >
              {years.map((y) => (
                <Pressable key={y} onPress={() => set({ year: y })} style={chip(d.year === y, YEAR_W)}>
                  <Text style={{ color: d.year === y ? '#FFF' : colors.text, fontWeight: '700' }}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>{t('funding.monthLabel')}</Text>

            <ScrollView
              ref={monthScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              onContentSizeChange={scrollToSelected}
            >
              {months.map((m, i) => (
                <Pressable key={m} onPress={() => set({ month: i + 1 })} style={chip(d.month === i + 1, MONTH_W)}>
                  <Text style={{ color: d.month === i + 1 ? '#FFF' : colors.text, fontWeight: '700' }}>{m}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>{t('funding.dayLabel')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: daysInEthMonth(d.year, d.month) }, (_, i) => i + 1).map((day) => (
                <Pressable key={day} onPress={() => set({ day })}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: d.day === day ? BRAND.violet : colors.background }}>
                  <Text style={{ color: d.day === day ? '#FFF' : colors.text, fontWeight: '700' }}>{day}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center', marginVertical: 14 }}>{formatEthDate(d, lang)}</Text>
          <PrimaryButton label={t('funding.done')} onPress={() => { onConfirm(d); onClose(); }} />
          <Pressable onPress={onClose} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}