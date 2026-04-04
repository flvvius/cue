import React, { createContext, useCallback, useContext, useMemo } from "react";
import { Uniwind } from "uniwind";

type ThemeName = "light" | "dark";

type AppThemeContextType = {
  currentTheme: string;
  isLight: boolean;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = "dark";
  const isLight = false;
  const isDark = true;

  const setTheme = useCallback((newTheme: ThemeName) => {
    if (newTheme === "dark") {
      Uniwind.setTheme("dark");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    Uniwind.setTheme("dark");
  }, []);

  const value = useMemo(
    () => ({
      currentTheme: theme,
      isLight,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [setTheme, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
