'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { getDB, getSQLite } from '@/database/connection';
import { initializeLocalSchema } from '@/database/schema';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType>({ isReady: false, error: null });

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        if (Capacitor.getPlatform() === 'web') {
          jeepSqlite(window);
          
          let jeepEl = document.querySelector('jeep-sqlite');
          if (!jeepEl) {
            jeepEl = document.createElement('jeep-sqlite');
            document.body.appendChild(jeepEl);
          }
          
          await customElements.whenDefined('jeep-sqlite');
          const sqlite = getSQLite();
          await sqlite.initWebStore();
        }

        // Initialize SQLite and Schema
        await getDB();
        await initializeLocalSchema();
        
        if (isMounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('Database Initialization Error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white">Database Initialization Issue</h2>
          <p className="text-xs text-red-400 font-mono bg-red-500/10 p-3 rounded-xl border border-red-500/20 break-words text-left">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Retry Launch
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 font-sans gap-4">
        <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Initializing Local Engine...</p>
      </div>
    );
  }

  return <DatabaseContext.Provider value={{ isReady, error }}>{children}</DatabaseContext.Provider>;
};
