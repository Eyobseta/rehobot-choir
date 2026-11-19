import React from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryHero } from './Memorykit';

/**
 * Teal hero for the Memories list. Pass children (search, actions, year
 * chips) and they render inside the hero, under the title row.
 * With no children it still works as a plain header.
 */
export default function MemoriesHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <MemoryHero
      icon="images"
      overline={t('tabs.memories', { defaultValue: 'Memories' })}
      title={t('memories.title', { defaultValue: 'Memories' })}
    >
      {children}
    </MemoryHero>
  );
}