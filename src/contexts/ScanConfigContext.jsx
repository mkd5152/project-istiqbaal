import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'scan.config.v1';
const defaultConfig = {
  eventId: null,
  eventLocationId: null,
  eventEntryPointId: null, // NOTE: this is event_entry_points.id
  dumpHeaderId: null,      // optional
};

const Ctx = createContext({
  config: defaultConfig,
  setConfig: () => {},
  clearConfig: () => {},
  isComplete: false,
});

export function ScanConfigProvider({ children }) {
  const [config, setConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : defaultConfig;
    } catch {
      return defaultConfig;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(config)); } catch {}
  }, [config]);

  const clearConfig = () => setConfig(defaultConfig);
  const isComplete = !!(config.eventId && config.eventLocationId && config.eventEntryPointId);

  const value = useMemo(() => ({ config, setConfig, clearConfig, isComplete }), [config, isComplete]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScanConfig() {
  return useContext(Ctx);
}