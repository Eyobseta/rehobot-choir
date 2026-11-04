import React, { useState } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { HelpProvider } from './HelpContext';
import HelpFab from './HelpFab';
import HelpModal from './HelpModal';

export default function HelpRoot({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<any>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <HelpProvider navigationRef={navigationRef}>
      {!open ? <HelpFab onPress={() => setOpen(true)} /> : null}
      <HelpModal
        visible={open}
        onClose={() => setOpen(false)}
        navigationRef={navigationRef}
      />
    </HelpProvider>
  );
}