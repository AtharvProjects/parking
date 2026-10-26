"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { useLanguage } from "@/providers/language-provider";
import { sessionsService } from "@/services/sessions.service";
import { VEHICLE_TYPE_CONFIG, VEHICLE_TYPES, BUSINESS_NAME } from "@/lib/constants";
import type { VehicleType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { generatePdfBill } from "@/lib/pdf-bill";
import { formatDateTimeIST, formatDateIST, formatTimeIST } from "@/lib/formatters";
import { sharePdfNative, downloadPdfNative, downloadImageNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
import { captureOrPickImage, compressImageFile, registerCameraRestoreListener } from "@/lib/image-utils";
import { useBackHandler } from "@/providers/back-button-provider";
import { openWhatsAppDirect } from "@/lib/whatsapp";
import { GateSubmitButton } from "@/components/gate-submit-button";
import {
  Check,
  Loader2,
  Hash,
  Phone,
  User,
  FileText,
  Printer,
  MessageCircle,
  Download,
  Camera as CameraIcon,
  X,
  ArrowLeft,
  Building2,
  ChevronDown,
  Image as ImageIcon,
  Plus,
  AlertTriangle
} from "lucide-react";

const DRAFT_KEY = "swp_gate_entry_draft";

function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function GateEntryPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, authorizedSites, switchSite } = useSite();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [driverNumber, setDriverNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [rearPhoto, setRearPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<'front' | 'rear' | null>(null);

  // Restore draft state on initial mount (in case activity was recreated)
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.vehicleNumber) setVehicleNumber(draft.vehicleNumber);
      if (draft.vehicleType) setVehicleType(draft.vehicleType);
      if (draft.driverNumber) setDriverNumber(draft.driverNumber);
      if (draft.driverName) setDriverName(draft.driverName);
      if (draft.notes) setNotes(draft.notes);
      if (draft.frontPhoto) {
        setFrontPhoto(draft.frontPhoto);
      } else if (typeof window !== "undefined") {
        const lastFront = localStorage.getItem("swp_last_captured_front");
        if (lastFront) setFrontPhoto(lastFront);
      }
      if (draft.rearPhoto) {
        setRearPhoto(draft.rearPhoto);
      } else if (typeof window !== "undefined") {
        const lastRear = localStorage.getItem("swp_last_captured_rear");
        if (lastRear) setRearPhoto(lastRear);
      }
    } else if (typeof window !== "undefined") {
      const lastFront = localStorage.getItem("swp_last_captured_front");
      if (lastFront) setFrontPhoto(lastFront);
      const lastRear = localStorage.getItem("swp_last_captured_rear");
      if (lastRear) setRearPhoto(lastRear);
    }
    setInitialLoaded(true);

    // Listen for restored camera result after app restart
    registerCameraRestoreListener((slot, base64Data) => {
      if (slot === "front") {
        setFrontPhoto(base64Data);
      } else {
        setRearPhoto(base64Data);
      }
      try {
        const currentDraft = loadDraft() || {};
        if (slot === "front") {
          currentDraft.frontPhoto = base64Data;
        } else {
          currentDraft.rearPhoto = base64Data;
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(currentDraft));
      } catch (e) {
        console.warn("Could not save restored photo to draft:", e);
      }
    });
  }, []);

  // Continuously save form state to draft storage including compressed photos
  useEffect(() => {
    if (!initialLoaded || typeof window === "undefined") return;
    try {
      const draft = {
        vehicleNumber,
        vehicleType,
        driverNumber,
        driverName,
        notes,
        frontPhoto,
        rearPhoto,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn("Could not write draft to localStorage:", e);
    }
  }, [vehicleNumber, vehicleType, driverNumber, driverName, notes, frontPhoto, rearPhoto, initialLoaded]);

  // Concrete active site ID for the entry transaction
  const effectiveSiteId = (currentSiteId && currentSiteId !== "ALL")
    ? currentSiteId
    : (authorizedSites[0]?.id || employee?.site_id || "");

  const activeSite = authorizedSites.find((s) => s.id === effectiveSiteId) || currentSite;

  const entryMutation = useMutation({
    mutationFn: (data: Parameters<typeof sessionsService.createEntry>[0]) =>
      sessionsService.createEntry(data),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem("swp_last_captured_front");
        localStorage.removeItem("swp_last_captured_rear");
      }
      queryClient.invalidateQueries({ queryKey: ["active-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: any) => {
      console.error("Entry submission error:", err);
      const msg = err?.message || "Failed to save vehicle entry. Please try again.";
      alert(msg);
    },
  });

  const resetForm = useCallback(() => {
    setVehicleNumber("");
    setVehicleType(null);
    setDriverNumber("");
    setDriverName("");
    setNotes("");
    setFrontPhoto(null);
    setRearPhoto(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem("swp_last_captured_front");
      localStorage.removeItem("swp_last_captured_rear");
    }
    entryMutation.reset();
  }, [entryMutation]);

  useBackHandler(entryMutation.isSuccess, resetForm, 10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      alert("Please enter a vehicle registration number");
      return;
    }
    if (!vehicleType) {
      alert("Please select a vehicle category");
      return;
    }
    if (!effectiveSiteId) {
      alert(t("gate.selectActiveSite") || "Please select an active site");
      return;
    }

    const operatorId = employee?.id || (typeof window !== "undefined" ? localStorage.getItem("current_employee_id") : null) || "c96dd7dd-cdcc-4889-b90f-38bf7d7fd6bd";

    entryMutation.mutate({
      site_id: effectiveSiteId,
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      vehicle_type: vehicleType,
      driver_number: driverNumber.trim(),
      driver_name: driverName.trim() || undefined,
      notes: notes.trim() || undefined,
      vehicle_photos: frontPhoto || rearPhoto ? { front: frontPhoto || undefined, rear: rearPhoto || undefined } : undefined,
      entry_operator_id: operatorId,
    });
  };

  const handlePrintEntryTicket = async () => {
    if (!entryMutation.data) return;
    try {
      const filename = `entry-ticket-${entryMutation.data.vehicle_number}-${entryMutation.data.id.slice(-6)}.pdf`;
      const pdfData = {
        id: entryMutation.data.id,
        vehicleNumber: entryMutation.data.vehicle_number,
        vehicleType: entryMutation.data.vehicle_type,
        driverNumber: entryMutation.data.driver_number || "",
        driverName: entryMutation.data.driver_name || "",
        entryAt: entryMutation.data.entry_at,
        entryOperatorName: employee?.name || "Gate Operator",
        site: activeSite,
      };

      if (Capacitor.isNativePlatform()) {
        const base64 = await generatePdfBill(pdfData, "base64", "thermal", "entry", language);
        await downloadPdfNative(base64 as string, filename);
      } else {
        await generatePdfBill(pdfData, false, "thermal", "entry", language);
      }
    } catch (err) {
      console.error("Failed to generate entry bill:", err);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!entryMutation.data) return;
    const session = entryMutation.data;
    
    let targetPhone = session.driver_number?.trim() || driverNumber?.trim();
    if (!targetPhone) {
      const input = prompt(t("gate.enterDriverMobile"));
      if (!input || !input.trim()) return;
      targetPhone = input.trim();
    }

    try {
      const filename = `entry-ticket-${session.vehicle_number.toUpperCase()}-${session.id.slice(-6)}.pdf`;
      const pdfData = {
        id: session.id,
        vehicleNumber: session.vehicle_number,
        vehicleType: session.vehicle_type,
        driverNumber: targetPhone,
        driverName: session.driver_name || (driverName ? driverName : ""),
        entryAt: session.entry_at,
        entryOperatorName: employee?.name || "Gate Operator",
        site: activeSite,
      };

      const brandName = activeSite?.brand_name || activeSite?.name || BUSINESS_NAME;
      const driverLine = session.driver_name ? `\n${t("whatsapp.driverLabel")}: ${session.driver_name}` : (driverName ? `\n${t("whatsapp.driverLabel")}: ${driverName}` : "");
      const text = `*${brandName}* - ${t("whatsapp.entrySlipTitle")}\n\n${t("whatsapp.dateLabel")}: ${formatDateIST(session.entry_at)}\n${t("whatsapp.timeLabel")}: ${formatTimeIST(session.entry_at)}\n${t("whatsapp.vehicleLabel")}: ${session.vehicle_number}${driverLine}\n${t("whatsapp.categoryLabel")}: ${VEHICLE_TYPE_CONFIG[session.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label || session.vehicle_type}\n${t("whatsapp.entryOperatorLabel")}: ${employee?.name || t("common.staff")}\n\n*${t("whatsapp.keepForCheckout")}*`;

      // Generate base64 PDF and send actual PDF document to WhatsApp
      const base64 = await generatePdfBill(pdfData, "base64", "thermal", "entry", language);
      await sharePdfNative(base64 as string, filename, text, targetPhone);
    } catch (err) {
      console.error("Error sharing PDF ticket on WhatsApp:", err);
      alert(t("gate.couldNotGeneratePdf"));
    }
  };

  const handleCapturePhoto = async (e: React.MouseEvent, type: 'front' | 'rear', source: 'camera' | 'gallery' = 'camera') => {
    e.preventDefault();
    e.stopPropagation();
    setIsCapturing(type);
    
    // Generous 120s timer so user has ample time to frame, shoot, and review on iPad
    const safetyTimer = setTimeout(() => {
      setIsCapturing(null);
    }, 120000);

    try {
      console.log(`[GatePhoto] Capturing ${type} photo via ${source}...`);
      const base64Data = await captureOrPickImage(source, type);
      console.log(`[GatePhoto] Captured ${type} data length:`, base64Data ? `${base64Data.length} chars` : 'null');
      if (base64Data) {
        if (type === 'front') {
          setFrontPhoto(base64Data);
        } else {
          setRearPhoto(base64Data);
        }
        try {
          const currentDraft = loadDraft() || {};
          if (type === 'front') {
            currentDraft.frontPhoto = base64Data;
          } else {
            currentDraft.rearPhoto = base64Data;
          }
          localStorage.setItem(DRAFT_KEY, JSON.stringify(currentDraft));
        } catch (e) {
          console.warn("Could not write photo to draft storage:", e);
        }
      }
    } catch (error) {
      console.error('[GatePhoto] Error capturing photo:', error);
    } finally {
      clearTimeout(safetyTimer);
      setIsCapturing(null);
    }
  };

  // Success state
  if (entryMutation.isSuccess && entryMutation.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center max-w-md mx-auto rv" style={{ ["--i" as any]: 0 }}>
        <div className="w-20 h-20 rounded-full bg-[var(--green-soft)] flex items-center justify-center mb-5 animate-in zoom-in-75 duration-300">
          <Check className="w-10 h-10 text-[var(--green)]" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-black text-[var(--ink)] mb-1">{t("gate.vehicleCheckedIn")}</h2>
        <p className="text-sm font-mono font-bold text-[var(--accent)] mb-1">
          {entryMutation.data.vehicle_number} ({VEHICLE_TYPE_CONFIG[entryMutation.data.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label})
        </p>
        {entryMutation.data.driver_name && (
          <p className="text-xs text-[var(--ink)] font-semibold mb-1">
            {t("gate.driver")}: <span className="text-[var(--accent)] font-bold">{entryMutation.data.driver_name}</span>
          </p>
        )}
        <p className="text-xs text-[var(--ink3)] mb-1">
          {t("common.site")}: <span className="font-semibold text-[var(--ink)]">{activeSite?.name || t("gate.mainSite")}</span>
        </p>
        <p className="text-xs text-[var(--ink3)] mb-4">
          {t("gate.timestamp")}: <span className="font-semibold text-[var(--ink)]">{formatDateTimeIST(entryMutation.data.entry_at)}</span>
        </p>

        {(() => {
          const photos = entryMutation.data.vehicle_photos as { front?: string; rear?: string } | null;
          if (!photos) return null;
          return (
            <div className="flex items-center justify-center gap-3 mb-5">
              {photos.front && (
                <div 
                  onClick={() => downloadImageNative(photos.front!, `${entryMutation.data.vehicle_number}-front.jpg`)}
                  className="relative rounded-xl overflow-hidden border border-[var(--line)] w-28 h-18 shadow-sm cursor-pointer group hover:border-[var(--accent)] transition-all"
                  title="Tap to download front photo"
                >
                  <img src={photos.front} alt="Front" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-[8px] font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Download className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Front</span>
                  </span>
                </div>
              )}
              {photos.rear && (
                <div 
                  onClick={() => downloadImageNative(photos.rear!, `${entryMutation.data.vehicle_number}-rear.jpg`)}
                  className="relative rounded-xl overflow-hidden border border-[var(--line)] w-28 h-18 shadow-sm cursor-pointer group hover:border-[var(--accent)] transition-all"
                  title="Tap to download rear photo"
                >
                  <img src={photos.rear} alt="Rear" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-[8px] font-bold text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Download className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Rear</span>
                  </span>
                </div>
              )}
            </div>
          );
        })()}
        
        <div className="w-full space-y-2.5">
          <button
            type="button"
            onClick={handlePrintEntryTicket}
            className="w-full vx-btn soft !py-3.5 !rounded-2xl text-xs font-bold"
          >
            <Download className="w-4 h-4" />
            <span>{t("gate.downloadThermalTicket")}</span>
          </button>

          {entryMutation.data.driver_number && (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full vx-btn !bg-[#25D366] !text-white !py-3.5 !rounded-2xl text-xs font-bold shadow-md hover:opacity-95 border-none"
              style={{ backgroundColor: "#25D366", color: "#ffffff" }}
            >
              <MessageCircle className="w-4 h-4 text-white fill-white/20" />
              <span className="text-white font-bold">{t("gate.shareTicketWhatsApp")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="w-full vx-btn accent !py-3.5 !rounded-2xl text-xs font-bold shadow-lg"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t("gate.registerNextVehicle")}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/")}
            className="w-full py-2.5 text-xs font-semibold text-[var(--ink3)] hover:text-[var(--ink)] transition-colors"
          >
            {t("gate.backToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-36 max-w-xl mx-auto space-y-5 font-sans">
      
      {/* ────────── TOP BAR WITH BACK BUTTON & SITE INFO ────────── */}
      <div className="flex items-center justify-between rv" style={{ ["--i" as any]: 0 }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/")}
            className="w-10 h-10 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">{t("gate.newVehicleEntry")}</h1>
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink3)] font-medium mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{t("gate.location")}: <strong className="text-[var(--ink)]">{activeSite?.name || t("gate.mainSite")}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ────────── ENTRY FORM ────────── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Error message */}
        {entryMutation.isError && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
            {(entryMutation.error as Error)?.message || t("gate.failedCreateEntry")}
          </div>
        )}

        {/* Vehicle Registration Number */}
        <div className="vx-card p-4 space-y-2 rv" style={{ ["--i" as any]: 1 }}>
          <label className="text-xs font-bold text-[var(--ink)] block">
            {t("gate.vehicleRegNumber")} <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ink3)]">
              <Hash className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              autoFocus
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder={t("gate.vehicleRegPlaceholder")}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-[var(--line)] bg-[var(--soft)] font-mono text-base font-bold text-[var(--ink)] tracking-wider uppercase placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
            />
          </div>
        </div>

        {/* Vehicle Category Selector */}
        <div className="vx-card p-4 space-y-2.5 rv" style={{ ["--i" as any]: 2 }}>
          <label className="text-xs font-bold text-[var(--ink)] block">
            {t("gate.selectVehicleCategory")} <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {VEHICLE_TYPES.map((type) => {
              const cfg = VEHICLE_TYPE_CONFIG[type];
              const isSelected = vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all active:scale-95 text-center min-h-[96px]",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]"
                      : "border-[var(--line)] bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink)]"
                  )}
                >
                  <span className="text-2xl mb-1.5">{cfg.icon}</span>
                  <span className="text-xs font-bold leading-tight">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Driver Name */}
        <div className="vx-card p-4 space-y-2 rv" style={{ ["--i" as any]: 3 }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--ink)] block">
              {t("gate.driverName")} ({t("common.optional")})
            </label>
            <span className="text-[10px] text-[var(--ink3)] font-medium">{t("gate.forSlipsRecords")}</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ink3)]">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder={t("gate.driverNamePlaceholder")}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
            />
          </div>
        </div>

        {/* Driver Phone Number */}
        <div className="vx-card p-4 space-y-2 rv" style={{ ["--i" as any]: 4 }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--ink)] block">
              {t("gate.driverPhone")} ({t("common.optional")})
            </label>
            <span className="text-[10px] text-[var(--ink3)] font-medium">{t("gate.forWhatsAppTicket")}</span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ink3)]">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="tel"
              maxLength={10}
              value={driverNumber}
              onChange={(e) => setDriverNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder={t("gate.driverPhonePlaceholder")}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all font-mono"
            />
          </div>
        </div>

        {/* Parking Notes / Bay Assignment */}
        <div className="vx-card p-4 space-y-2 rv" style={{ ["--i" as any]: 5 }}>
          <label className="text-xs font-bold text-[var(--ink)] block">
            {t("gate.notesBay")} ({t("common.optional")})
          </label>
          <div className="relative">
            <div className="absolute top-3 left-3.5 pointer-events-none text-[var(--ink3)]">
              <FileText className="w-4 h-4" />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("gate.notesPlaceholder")}
              rows={2}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--ink)] placeholder:text-[var(--ink3)] resize-none"
            />
          </div>
        </div>

        {/* Vehicle Photo Capture */}
        <div className="vx-card p-4 space-y-2.5 rv" style={{ ["--i" as any]: 6 }}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--ink)] block">
              {t("gate.vehiclePhotos")} ({t("common.optional")})
            </label>
            <span className="text-[10px] text-[var(--ink3)] font-medium">{t("gate.syncedAcrossDevices")}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Front Photo */}
            <div className="space-y-1">
              {frontPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[var(--accent)] aspect-video shadow-md bg-black/5">
                  <img
                    src={frontPhoto}
                    alt="Front"
                    className="w-full h-full object-cover"
                    onError={() => console.warn("Failed to render front photo")}
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shadow">
                    <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                    <span>Front Photo</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFrontPhoto(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black transition-transform active:scale-95 shadow-md"
                    title="Remove Photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={isCapturing !== null}
                    onClick={(e) => handleCapturePhoto(e, 'front', 'camera')}
                    className="w-full aspect-video rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--soft)] hover:bg-[var(--soft2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1.5 text-[var(--ink3)] hover:text-[var(--ink)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isCapturing === 'front' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
                        <span className="text-[10px] font-bold text-[var(--accent)]">Opening Camera...</span>
                      </>
                    ) : (
                      <>
                        <CameraIcon className="w-5 h-5 text-[var(--accent)]" />
                        <span className="text-[11px] font-bold">{t("gate.takeFrontPhoto")}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCapturing !== null}
                    onClick={(e) => handleCapturePhoto(e, 'front', 'gallery')}
                    className="text-[10px] text-[var(--ink3)] hover:text-[var(--accent)] font-semibold flex items-center justify-center gap-1 py-1"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>
              )}
            </div>

            {/* Rear Photo */}
            <div className="space-y-1">
              {rearPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[var(--accent)] aspect-video shadow-md bg-black/5">
                  <img
                    src={rearPhoto}
                    alt="Rear"
                    className="w-full h-full object-cover"
                    onError={() => console.warn("Failed to render rear photo")}
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shadow">
                    <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                    <span>Rear Photo</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRearPhoto(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black transition-transform active:scale-95 shadow-md"
                    title="Remove Photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={isCapturing !== null}
                    onClick={(e) => handleCapturePhoto(e, 'rear', 'camera')}
                    className="w-full aspect-video rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--soft)] hover:bg-[var(--soft2)] hover:border-[var(--accent)] flex flex-col items-center justify-center gap-1.5 text-[var(--ink3)] hover:text-[var(--ink)] transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isCapturing === 'rear' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
                        <span className="text-[10px] font-bold text-[var(--accent)]">Opening Camera...</span>
                      </>
                    ) : (
                      <>
                        <CameraIcon className="w-5 h-5 text-[var(--accent)]" />
                        <span className="text-[11px] font-bold">{t("gate.takeRearPhoto")}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCapturing !== null}
                    onClick={(e) => handleCapturePhoto(e, 'rear', 'gallery')}
                    className="text-[10px] text-[var(--ink3)] hover:text-[var(--accent)] font-semibold flex items-center justify-center gap-1 py-1"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Error Feedback Banner */}
        {entryMutation.isError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{(entryMutation.error as any)?.message || "Failed to save entry. Please try again."}</span>
          </div>
        )}

        {/* Submit Button — animated with GSAP confetti on success */}
        <GateSubmitButton
          isPending={entryMutation.isPending}
          isSuccess={entryMutation.isSuccess}
          disabled={!vehicleNumber.trim() || !vehicleType || entryMutation.isPending || isCapturing !== null}
          label={t("gate.generateEntrySlip")}
          savingLabel={t("gate.savingEntry")}
          successLabel={t("gate.entryRecorded") || "Entry Recorded!"}
        />

      </form>

    </div>
  );
}
