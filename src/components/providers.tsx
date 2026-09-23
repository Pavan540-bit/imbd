"use client";

import { ThemeProvider } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";

type PrivacyValue = { hidden: boolean; toggle: () => void };

const PrivacyContext = createContext<PrivacyValue>({ hidden: false, toggle: () => {} });

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(window.localStorage.getItem("pf-hide-balances") === "1");
  }, []);
  function toggle() {
    setHidden((value) => {
      window.localStorage.setItem("pf-hide-balances", value ? "0" : "1");
      return !value;
    });
  }
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
    </ThemeProvider>
  );
}
