/**
 * Universal Image Capture, Compression, and State Preservation Utility.
 * Handles Android Activity lifecycle recreation, Capacitor Native Camera, and Web/File fallback.
 */
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export async function captureOrPickImage(
  source: "camera" | "gallery" = "camera",
  slot: "front" | "rear" = "front"
): Promise<string | null> {
  // Save current capturing slot in localStorage in case Android kills/recreates the activity
  if (typeof window !== "undefined") {
    localStorage.setItem("swp_capturing_photo_slot", slot);
  }

  // 1. Try Capacitor Native Camera on mobile devices
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        width: 800,
        correctOrientation: true,
        saveToGallery: false,
      });

      if (image.base64String) {
        const base64Data = `data:image/${image.format || "jpeg"};base64,${image.base64String}`;
        return base64Data;
      }
    } catch (err) {
      console.warn("Capacitor camera error, trying HTML fallback:", err);
    }
  }

  // 2. Web / In-app HTML5 File Input Fallback with Canvas Compression
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") {
      input.capture = "environment";
    }

    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const compressedBase64 = await compressImageFile(file, 800, 0.65);
        resolve(compressedBase64);
      } catch (err) {
        console.error("Compression error:", err);
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Register App restored result listener for Android activity recreation recovery
 */
export function registerCameraRestoreListener(
  onRestored: (slot: "front" | "rear", base64Data: string) => void
) {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener("appRestoredResult", (data) => {
    if (data.pluginId === "Camera" && data.data) {
      const slot = (typeof window !== "undefined"
        ? (localStorage.getItem("swp_capturing_photo_slot") as "front" | "rear")
        : null) || "front";

      if (data.data.base64String) {
        const base64Data = `data:image/${data.data.format || "jpeg"};base64,${data.data.base64String}`;
        onRestored(slot, base64Data);
      }
    }
  });
}

/**
 * Compress and scale an image File using an offscreen Canvas
 */
export function compressImageFile(
  file: File,
  maxWidth = 800,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
      img.src = event.target?.result as string;
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
