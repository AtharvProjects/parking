import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function sharePdfNative(base64Data: string, filename: string, text: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: 'Parking Receipt',
      text: text,
      url: result.uri,
      dialogTitle: 'Share Receipt',
    });
    
    return true;
  } catch (err) {
    console.error('Error sharing native:', err);
    return false;
  }
}

export async function downloadPdfNative(base64Data: string, filename: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
    });
    
    alert(`File downloaded to Documents folder: ${filename}`);
    return true;
  } catch (err) {
    console.error('Error downloading native:', err);
    // Fallback: If Documents directory fails, save to Cache and use share sheet
    try {
      const fallbackResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: 'Download Receipt',
        text: 'Save your receipt',
        url: fallbackResult.uri,
        dialogTitle: 'Save Receipt',
      });
      return true;
    } catch(fallbackErr) {
      console.error('Fallback sharing failed:', fallbackErr);
      return false;
    }
  }
}

export const downloadNativeFile = downloadPdfNative;
