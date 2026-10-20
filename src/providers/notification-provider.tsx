"use client";

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { notificationService, type NotificationConfig } from "@/services/notification.service";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions.service";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";

interface NotificationContextType {
  config: NotificationConfig;
  updateConfig: (newConfig: Partial<NotificationConfig>) => void;
  sendTestAlert: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  config: notificationService.getConfig(),
  updateConfig: () => {},
  sendTestAlert: async () => false,
  requestPermissions: async () => false,
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { employee, status } = useAuth();
  const { currentSite, currentSiteId } = useSite();
  const [config, setConfig] = useState<NotificationConfig>(() => notificationService.getConfig());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const querySiteId = currentSiteId === "ALL" ? "" : currentSiteId;

  // Fetch active vehicles to monitor for remaining checkouts
  const { data: activeVehicles } = useQuery({
    queryKey: ["active-vehicles", querySiteId, employee?.company_id],
    queryFn: () => sessionsService.getActiveSessions(querySiteId),
    enabled: status === "authenticated" && !!employee,
    refetchInterval: 30_000,
  });

  // Request permissions and register notification listeners on mount
  useEffect(() => {
    notificationService.requestPermissions();

    if (Capacitor.isNativePlatform()) {
      // Listen for notification action clicks (tapping on alert)
      const sub = LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        const route = action.notification.extra?.route || "/gate/active";
        router.push(route);
      });

      return () => {
        sub.then((s) => s.remove());
      };
    }
  }, [router]);

  // Periodic checkout scanner
  useEffect(() => {
    if (!config.enabled || status !== "authenticated" || !activeVehicles?.length) {
      return;
    }

    const runCheck = async () => {
      try {
        await notificationService.checkAndNotifyActiveVehicles(
          activeVehicles,
          currentSite?.name || "Terminal"
        );
      } catch (err) {
        console.warn("Notification check error:", err);
      }
    };

    // Run immediately when active vehicles change
    runCheck();

    // Re-check every 60 seconds
    checkIntervalRef.current = setInterval(runCheck, 60_000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [activeVehicles, config.enabled, status, currentSite?.name]);

  const updateConfig = (newConfig: Partial<NotificationConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    notificationService.saveConfig(updated);
    if (updated.enabled) {
      notificationService.requestPermissions();
    }
  };

  const sendTestAlert = async () => {
    return notificationService.sendTestNotification();
  };

  const requestPermissions = async () => {
    return notificationService.requestPermissions();
  };

  return (
    <NotificationContext.Provider
      value={{
        config,
        updateConfig,
        sendTestAlert,
        requestPermissions,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
