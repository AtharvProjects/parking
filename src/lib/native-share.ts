import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface WhatsAppDirectSharePlugin {
  sharePdfToNumber(options: { phone: string; filePath: string; text?: string }): Promise<{ success: boolean }>;
}

const WhatsAppDirectShare = registerPlugin<WhatsAppDirectSharePlugin>('WhatsAppDirectShare');

/**
 * Shares an actual PDF file document directly to the driver's WhatsApp chat.
 * Writes the base64 data to cache and invokes the native WhatsApp Intent with the JID and PDF attached.
 */
export async function sharePdfNative(base64Data: string, filename: string, text: string, driverNumber?: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Write the PDF file to device cache storage
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 2. Direct WhatsApp chat target for the entered driver phone number
      if (driverNumber && driverNumber.trim()) {
        try {
          const res = await WhatsAppDirectShare.sharePdfToNumber({
            phone: driverNumber.trim(),
            filePath: filename,
            text: text,
          });
          if (res && res.success) {
            return true;
          }
        } catch (pluginErr) {
          console.warn('Direct WhatsApp plugin notice, trying fallback share:', pluginErr);
        }
      }

      // 3. Fallback: Share sheet with PDF file attached
      const fileUri = await Filesystem.getUri({
        path: filename,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        text: text,
        url: fileUri.uri,
        dialogTitle: 'Share PDF on WhatsApp',
      });
      
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('canceled')) {
        return true;
      }
      console.error('Error sharing PDF native:', err);
      return false;
    }
  } else {
    // 4. Web / Browser fallback with Web Share API file attachment
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: text,
        });
        return true;
      } else {
        // Fallback for desktop browsers: download PDF and open WhatsApp web chat
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const cleanPhone = driverNumber ? driverNumber.replace(/\D/g, '') : '';
        const phoneParam = cleanPhone ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : '';
        const waUrl = phoneParam 
          ? `https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(text)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
        return true;
      }
    } catch (e) {
      console.warn('Web share file failed:', e);
      return false;
    }
  }
}

/**
 * Downloads the PDF file directly to device Documents or downloads folder.
 */
export async function downloadPdfNative(base64Data: string, filename: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
      });
      
      alert(`PDF downloaded to Documents: ${filename}`);
      return true;
    } catch (err) {
      console.error('Error downloading native to Documents:', err);
      try {
        const fallbackResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: filename,
          text: 'Save your parking PDF receipt',
          url: fallbackResult.uri,
          dialogTitle: 'Save PDF Receipt',
        });
        return true;
      } catch (fallbackErr) {
        console.error('Fallback PDF sharing failed:', fallbackErr);
        return false;
      }
    }
  } else {
    // Browser download
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
}

export const downloadNativeFile = downloadPdfNative;
