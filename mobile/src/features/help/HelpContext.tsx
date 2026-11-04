import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useMe } from '../chat/chatSession';
import { KB } from './kb';
import { fetchHelpEntries } from './helpApi';
import { canSee } from './helpMatcher';
import type { HelpEntry, HelpRole } from './helpTypes';

type HelpContextValue = {
  entries: HelpEntry[];
  role: HelpRole;
  currentRoute: string | null;
};

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

export function useHelpContext(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error('useHelpContext must be inside <HelpProvider>');
  return ctx;
}

export function HelpProvider({
  children,
  navigationRef,
}: {
  children: React.ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<any>;
}) {
  const me = useMe();
  const role: HelpRole =
    me?.role === 'LEADER' || me?.role === 'ADMIN' ? me.role : 'MEMBER';

  // Bundled KB is available instantly (and offline). ADMIN sees everything.
  const bundled = useMemo(() => KB.filter((e) => canSee(e, role)), [role]);
  const [entries, setEntries] = useState<HelpEntry[]>(bundled);

  useEffect(() => {
    let cancelled = false;
    setEntries(bundled);
    (async () => {
      try {
        const fresh = await fetchHelpEntries();
        if (cancelled) return;
        if (Array.isArray(fresh) && fresh.length > 0) {
          setEntries(fresh.filter((e) => canSee(e, role)));
        }
      } catch {
        // offline / server down — bundled KB is fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundled, role]);

  const [currentRoute, setCurrentRoute] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      try {
        setCurrentRoute(navigationRef.getCurrentRoute?.()?.name ?? null);
      } catch {
        setCurrentRoute(null);
      }
    };
    update();
    const unsub = navigationRef.addListener?.('state', update);
    return () => {
      unsub?.();
    };
  }, [navigationRef]);

  const value = useMemo<HelpContextValue>(
    () => ({ entries, role, currentRoute }),
    [entries, role, currentRoute],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}