/**
 * Android & Web Notification Service for Pending Vehicle Checkouts.
 * Uses @capacitor/local-notifications with fallback to Web Notifications API.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { ActiveVehicle } from '@/lib/database.types';
import { humanizeDuration } from '@/lib/formatters';

export interface NotificationConfig {
  enabled: boolean;
  after1Hour: boolean;
  after2Hours: boolean;
  after4Hours: boolean;
  after6Hours: boolean;
  overstayAlert: boolean;
  periodicReminder: boolean;
  periodicIntervalMinutes: number; // 30, 60, 120
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: true,
  after1Hour: true,
  after2Hours: true,
  after4Hours: true,
  after6Hours: false,
  overstayAlert: true,
  periodicReminder: false,
  periodicIntervalMinutes: 60,
  soundEnabled: true,
  vibrationEnabled: true,
};

const STORAGE_KEY = 'swp_notification_config';
const NOTIFIED_CACHE_KEY = 'swp_notified_vehicles';

export const notificationService = {
  getConfig(): NotificationConfig {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CONFIG;
  },

  saveConfig(config: NotificationConfig): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    }
  },

  /**
   * Request permissions from Android (API 33+) or Browser
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const check = await LocalNotifications.checkPermissions();
        if (check.display === 'granted') {
          await this.createChannel();
          return true;
        }
        const request = await LocalNotifications.requestPermissions();
        if (request.display === 'granted') {
          await this.createChannel();
          return true;
        }
        return false;
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission();
          return perm === 'granted';
        }
      }
    } catch (err) {
      console.warn('Notification permission request error:', err);
    }
    return false;
  },

  /**
   * Initialize Android high-importance notification channel
   */
  async createChannel(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.createChannel({
        id: 'parking_checkout_alerts',
        name: 'Parking Checkout Alerts',
        description: 'Notifications for parked vehicles pending checkout and overstays',
        importance: 5, // High / Heads-up
        visibility: 1, // Public
        sound: 'res_custom_notification',
        vibration: true,
        lights: true,
        lightColor: '#EA580C',
      });
    } catch (err) {
      console.warn('Channel creation notice:', err);
    }
  },

  /**
   * Send a test alert immediately
   */
  async sendTestNotification(): Promise<boolean> {
    const permGranted = await this.requestPermissions();
    if (!permGranted && Capacitor.isNativePlatform()) {
      return false;
    }

    const title = '🚗 Parking Alert: MH 12 AB 1234';
    const body = 'Vehicle has been parked for 1h 30m. Ready for checkout.';

    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Date.now() % 100000),
              channelId: 'parking_checkout_alerts',
              schedule: { at: new Date(Date.now() + 1000) },
              smallIcon: 'ic_stat_parking',
              actionTypeId: 'OPEN_ACTIVE_VEHICLES',
              extra: { route: '/gate/active' },
            },
          ],
        });
        return true;
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
        return true;
      }
    } catch (err) {
      console.error('Test notification failed:', err);
    }
    return false;
  },

  /**
   * Scan active vehicles and trigger alerts based on configured thresholds
   */
  async checkAndNotifyActiveVehicles(vehicles: ActiveVehicle[], siteName?: string): Promise<number> {
    const config = this.getConfig();
    if (!config.enabled || !vehicles.length) return 0;

    // Retrieve already notified map { [vehicleId_threshold]: timestamp }
    const notifiedMap: Record<string, number> = this.getNotifiedCache();
    const now = Date.now();
    let sentCount = 0;

    for (const vehicle of vehicles) {
      const elapsedMin = vehicle.elapsed_minutes;
      const vehicleNum = vehicle.vehicle_number;
      const driver = vehicle.driver_number ? ` (Driver: ${vehicle.driver_number})` : '';
      const location = siteName || vehicle.site_name || 'Terminal';

      // 1. Overstay Alert (Urgent)
      if (config.overstayAlert && vehicle.is_overstaying) {
        const key = `${vehicle.id}_overstay`;
        // Only re-notify overstay once every 4 hours
        if (!notifiedMap[key] || now - notifiedMap[key] > 4 * 60 * 60 * 1000) {
          await this.triggerAlert({
            id: this.hashString(key),
            title: `⚠️ OVERSTAY ALERT: ${vehicleNum}`,
            body: `Vehicle parked for ${humanizeDuration(elapsedMin)} at ${location}${driver}. Exceeded threshold!`,
          });
          notifiedMap[key] = now;
          sentCount++;
          continue;
        }
      }

      // 2. 6-Hour Alert
      if (config.after6Hours && elapsedMin >= 360) {
        const key = `${vehicle.id}_6h`;
        if (!notifiedMap[key]) {
          await this.triggerAlert({
            id: this.hashString(key),
            title: `⏱️ 6-Hour Alert: ${vehicleNum}`,
            body: `Parked for ${humanizeDuration(elapsedMin)} at ${location}${driver}. Pending checkout.`,
          });
          notifiedMap[key] = now;
          sentCount++;
          continue;
        }
      }

      // 3. 4-Hour Alert
      if (config.after4Hours && elapsedMin >= 240) {
        const key = `${vehicle.id}_4h`;
        if (!notifiedMap[key]) {
          await this.triggerAlert({
            id: this.hashString(key),
            title: `⏱️ 4-Hour Alert: ${vehicleNum}`,
            body: `Parked for ${humanizeDuration(elapsedMin)} at ${location}${driver}.`,
          });
          notifiedMap[key] = now;
          sentCount++;
          continue;
        }
      }

      // 4. 2-Hour Alert
      if (config.after2Hours && elapsedMin >= 120) {
        const key = `${vehicle.id}_2h`;
        if (!notifiedMap[key]) {
          await this.triggerAlert({
            id: this.hashString(key),
            title: `⏱️ 2-Hour Alert: ${vehicleNum}`,
            body: `Parked for ${humanizeDuration(elapsedMin)} at ${location}${driver}.`,
          });
          notifiedMap[key] = now;
          sentCount++;
          continue;
        }
      }

      // 5. 1-Hour Alert
      if (config.after1Hour && elapsedMin >= 60) {
        const key = `${vehicle.id}_1h`;
        if (!notifiedMap[key]) {
          await this.triggerAlert({
            id: this.hashString(key),
            title: `⏱️ 1-Hour Alert: ${vehicleNum}`,
            body: `Parked for ${humanizeDuration(elapsedMin)} at ${location}${driver}.`,
          });
          notifiedMap[key] = now;
          sentCount++;
          continue;
        }
      }
    }

    // Save updated cache (clean old entries older than 48 hours)
    this.saveNotifiedCache(notifiedMap);
    return sentCount;
  },

  /**
   * Internal trigger function sending to Capacitor LocalNotifications or Web
   */
  async triggerAlert({ id, title, body }: { id: number; title: string; body: string }): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.abs(id),
              title,
              body,
              channelId: 'parking_checkout_alerts',
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_stat_parking',
              actionTypeId: 'OPEN_ACTIVE_VEHICLES',
              extra: { route: '/gate/active' },
            },
          ],
        });
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.warn('Trigger alert error:', err);
    }
  },

  getNotifiedCache(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(NOTIFIED_CACHE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  saveNotifiedCache(cache: Record<string, number>): void {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const pruned: Record<string, number> = {};
      for (const [key, ts] of Object.entries(cache)) {
        if (now - ts < 48 * 60 * 60 * 1000) {
          pruned[key] = ts;
        }
      }
      localStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(pruned));
    } catch (err) {
      console.error('Failed to save notification cache:', err);
    }
  },

  hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash) % 1000000;
  },
};
