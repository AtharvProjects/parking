import { Capacitor } from '@capacitor/core';

/**
 * Clean and format Indian / international phone number for WhatsApp direct chat link.
 * Examples:
 *   "8329284039" -> "918329284039"
 *   "+91 8329284039" -> "918329284039"
 *   "08329284039" -> "918329284039"
 *   "918329284039" -> "918329284039"
 */
export function formatWhatsAppPhoneNumber(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return `91${cleaned.slice(1)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned;
  }
  return cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
}

/**
 * Direct redirect to driver's WhatsApp chat with pre-filled message text.
 * Works seamlessly across Android Capacitor app, mobile browsers, and desktop.
 */
export function openWhatsAppDirect(phone: string, messageText: string): boolean {
  if (!phone || !phone.trim()) {
    return false;
  }

  const formattedPhone = formatWhatsAppPhoneNumber(phone.trim());
  const encodedText = encodeURIComponent(messageText);
  
  // 1. Primary WhatsApp universal web / app redirect
  const waWebUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
  // 2. WhatsApp deep link URI scheme for native Android/iOS
  const waSchemeUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`;

  if (typeof window !== "undefined") {
    if (Capacitor.isNativePlatform()) {
      // On Android Native / Capacitor:
      // Try opening native scheme to launch WhatsApp directly into the chat
      try {
        window.location.href = waSchemeUrl;
        // Fallback to web intent if scheme is not handled immediately
        setTimeout(() => {
          window.open(waWebUrl, "_system");
        }, 600);
      } catch (e) {
        window.open(waWebUrl, "_system");
      }
    } else {
      // On Web / Desktop / Mobile Browser:
      window.open(waWebUrl, "_blank");
    }
    return true;
  }

  return false;
}
