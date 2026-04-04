import React from "react";

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
  sessionResetCutoffs: Record<string, number>;
  startBreak: (breakState: ActiveBreak) => void;
  finishBreak: (appPackage: string, cutoffTimestamp: number) => void;
};

const BreakStateContext = React.createContext<BreakStateContextValue | null>(null);

export function BreakStateProvider({ children }: React.PropsWithChildren) {
  const [activeBreak, setActiveBreak] = React.useState<ActiveBreak | null>(null);
  const [sessionResetCutoffs, setSessionResetCutoffs] = React.useState<Record<string, number>>({});

  const startBreak = React.useCallback((breakState: ActiveBreak) => {
    setActiveBreak(breakState);
    setSessionResetCutoffs((currentState) => ({
      ...currentState,
      [breakState.appPackage]: breakState.endsAt,
    }));
  }, []);

  const finishBreak = React.useCallback((appPackage: string, cutoffTimestamp: number) => {
    setActiveBreak((currentBreak) => (currentBreak?.appPackage === appPackage ? null : currentBreak));
    setSessionResetCutoffs((currentState) => ({
      ...currentState,
      [appPackage]: cutoffTimestamp,
    }));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      activeBreak,
      sessionResetCutoffs,
      startBreak,
      finishBreak,
    }),
    [activeBreak, finishBreak, sessionResetCutoffs, startBreak],
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
