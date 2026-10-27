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

const CHIP_WIDTH = 64; // Adjusted slightly to fit text better
const MONTH_CHIP_WIDTH = 100;

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

  // Reset local state when opened
  useEffect(() => { if (visible) setD(value); }, [visible, value]);

  const thisYear = ethTodayFromInstant(new Date()).year;
  const lo = Math.min(minYear ?? thisYear - 100, value.year);
  const hi = Math.max(maxYear ?? thisYear, value.year);
  
  // DESCENDING ORDER: 2019, 2018, 2017... so current is on the left
  const years = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);

  const set = (p: Partial<EthDate>) =>
    setD((cur) => {
      const n = { ...cur, ...p };
      n.day = Math.min(n.day, daysInEthMonth(n.year, n.month));
      return n;
    });

  const chip = (on: boolean) => ({
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8,
    backgroundColor: on ? BRAND.violet : colors.background,
    minWidth: 50,
    alignItems: 'center' as const,
  });

  // Helper to scroll year list exactly when it finishes rendering
  const handleYearLayout = () => {
    const yearIndex = years.indexOf(d.year);
    if (yearIndex !== -1 && yearScrollRef.current) {
      yearScrollRef.current.scrollTo({ x: Math.max(0, yearIndex * CHIP_WIDTH - 40), animated: false });
    }
  };

  // Helper to scroll month list exactly when it finishes rendering
  const handleMonthLayout = () => {
    const monthIndex = d.month - 1;
    if (monthIndex !== -1 && monthScrollRef.current) {
      monthScrollRef.current.scrollTo({ x: Math.max(0, monthIndex * MONTH_CHIP_WIDTH - 40), animated: false });
    }
  };

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
              onContentSizeChange={handleYearLayout} // TRIGGERS SCROLL WHEN RENDERED
            >
              {years.map((y) => (
                <Pressable key={y} onPress={() => set({ year: y })} style={chip(d.year === y)}>
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
              onContentSizeChange={handleMonthLayout} // TRIGGERS SCROLL WHEN RENDERED
            >
              {months.map((m, i) => (
                <Pressable key={m} onPress={() => set({ month: i + 1 })} style={chip(d.month === i + 1)}>
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