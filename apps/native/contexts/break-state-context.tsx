import { api } from "@cue/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import React from "react";
import * as SecureStore from "expo-secure-store";

const BREAK_STATE_STORAGE_KEY = "cue.break-state.v1";

type ActiveBreak = {
  appPackage: string;
  appName: string;
  alternative?: string;
  startedAt: number;
  endsAt: number;
  durationMinutes: number;
};

type BreakStateContextValue = {
  activeBreak: ActiveBreak | null;
  isHydrated: boolean;
  sessionResetCutoffs: Record<string, number>;
  startBreak: (breakState: ActiveBreak) => void;
  finishBreak: (appPackage: string, cutoffTimestamp: number) => void;
};

const BreakStateContext = React.createContext<BreakStateContextValue | null>(null);

type PersistedBreakState = {
  activeBreak: ActiveBreak | null;
  sessionResetCutoffs: Record<string, number>;
};

async function readPersistedBreakState(): Promise<PersistedBreakState> {
  try {
    const rawValue = await SecureStore.getItemAsync(BREAK_STATE_STORAGE_KEY);
    if (!rawValue) {
      return {
        activeBreak: null,
        sessionResetCutoffs: {},
      };
    }

    const parsed = JSON.parse(rawValue) as PersistedBreakState;
    const now = Date.now();
    const activeBreak = parsed.activeBreak && parsed.activeBreak.endsAt > now
      ? parsed.activeBreak
      : null;

    const sessionResetCutoffs = {
      ...(parsed.sessionResetCutoffs ?? {}),
    };

    if (parsed.activeBreak && parsed.activeBreak.endsAt <= now) {
      sessionResetCutoffs[parsed.activeBreak.appPackage] = Math.max(
        sessionResetCutoffs[parsed.activeBreak.appPackage] ?? 0,
        parsed.activeBreak.endsAt,
      );
    }

    return {
      activeBreak,
      sessionResetCutoffs,
    };
  } catch {
    return {
      activeBreak: null,
      sessionResetCutoffs: {},
    };
  }
}

async function persistBreakState(nextState: PersistedBreakState) {
  try {
    await SecureStore.setItemAsync(BREAK_STATE_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Best effort persistence only.
  }
}

export function BreakStateProvider({ children }: React.PropsWithChildren) {
  const startBreakForCurrentUser = useMutation(api.breaks.startForCurrentUser);
  const finishBreakForCurrentUser = useMutation(api.breaks.finishForCurrentUser);
  const [activeBreak, setActiveBreak] = React.useState<ActiveBreak | null>(null);
  const [sessionResetCutoffs, setSessionResetCutoffs] = React.useState<Record<string, number>>({});
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    void readPersistedBreakState().then((storedState) => {
      if (!isMounted) {
        return;
      }

      setActiveBreak(storedState.activeBreak);
      setSessionResetCutoffs(storedState.sessionResetCutoffs);
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const startBreak = React.useCallback((breakState: ActiveBreak) => {
    setActiveBreak(breakState);
    setSessionResetCutoffs((currentState) => ({
      ...currentState,
      [breakState.appPackage]: breakState.endsAt,
    }));
    void startBreakForCurrentUser({
      appPackage: breakState.appPackage,
      appName: breakState.appName,
      alternative: breakState.alternative,
      startedAt: breakState.startedAt,
      plannedEndsAt: breakState.endsAt,
    });
  }, [startBreakForCurrentUser]);

  const finishBreak = React.useCallback((appPackage: string, cutoffTimestamp: number) => {
    const currentBreak = activeBreak?.appPackage === appPackage ? activeBreak : null;
    const endedEarly = currentBreak ? cutoffTimestamp < currentBreak.endsAt : false;
    setActiveBreak((currentBreak) => (currentBreak?.appPackage === appPackage ? null : currentBreak));
    setSessionResetCutoffs((currentState) => {
      if (endedEarly) {
        const nextState = { ...currentState };
        delete nextState[appPackage];
        return nextState;
      }

      return {
        ...currentState,
        [appPackage]: cutoffTimestamp,
      };
    });
    void finishBreakForCurrentUser({
      appPackage,
      finishedAt: cutoffTimestamp,
      endedEarly,
    });
  }, [activeBreak, finishBreakForCurrentUser]);

  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void persistBreakState({
      activeBreak,
      sessionResetCutoffs,
    });
  }, [activeBreak, isHydrated, sessionResetCutoffs]);

  const contextValue = React.useMemo(
    () => ({
      activeBreak,
      isHydrated,
      sessionResetCutoffs,
      startBreak,
      finishBreak,
    }),
    [activeBreak, finishBreak, isHydrated, sessionResetCutoffs, startBreak],
  );

  return (
    <BreakStateContext.Provider value={contextValue}>
      {children}
    </BreakStateContext.Provider>
  );
}

export function useBreakState() {
  const context = React.useContext(BreakStateContext);

  if (!context) {
    throw new Error("useBreakState must be used within BreakStateProvider");
  }

  return context;
}
