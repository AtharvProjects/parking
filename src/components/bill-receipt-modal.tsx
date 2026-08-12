"use client";

import React from "react";
import { formatINR, formatDateTimeIST, formatDateIST } from "@/lib/formatters";
import type { SessionWithRelations } from "@/lib/database.types";
import { BUSINESS_NAME } from "@/lib/constants";
import { Printer, MessageCircle, X, Download, Calendar, Clock, Building2, User } from "lucide-react";
import { generatePdfBill } from "@/lib/pdf-bill";
import { sharePdfNative, downloadPdfNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
import { useQuery } from "@tanstack/react-query";
import { sitesService } from "@/services/sites.service";
import { useSite } from "@/providers/site-provider";

export function BillReceiptModal({
  session,
  onClose,
}: {
  session: SessionWithRelations;
  onClose: () => void;
}) {
  const { currentSite } = useSite();
  const targetSiteId = session.site_id || currentSite?.id;

  const { data: site } = useQuery({
    queryKey: ["site", targetSiteId],
    queryFn: () => targetSiteId ? sitesService.getById(targetSiteId) : Promise.resolve(currentSite),
    enabled: !!targetSiteId,
    initialData: currentSite || undefined,
  });

  const payment = Array.isArray(session.payment) ? session.payment[0] : session.payment;
  const brandName = site?.brand_name || site?.name || BUSINESS_NAME;
  const receiptDate = formatDateIST(session.exit_at || session.entry_at);
  const operatorName = session.exit_operator?.name || session.entry_operator?.name || "Gate Attendant";

  const handleWhatsAppShare = async () => {
    if (!session.driver_number) {
      alert("No driver phone number provided for this session.");
      return;
    }
    
    try {
      const filename = `parking-bill-${session.vehicle_number}-${session.id.slice(-6)}.pdf`;
      const pdfData = {
        id: session.id,
        vehicleNumber: session.vehicle_number,
        vehicleType: session.vehicle_type,
        driverNumber: session.driver_number,
        notes: session.notes,
        entryAt: session.entry_at,
        exitAt: session.exit_at,
        durationMinutes: session.duration_minutes,
        grossAmount: session.gross_amount,
        paymentMethod: payment?.method,
        paymentStatus: payment?.status,
        receiptNumber: payment?.receipt_number,
        entryOperatorName: session.entry_operator?.name,
        exitOperatorName: session.exit_operator?.name,
        site: site,
      };

      const amountStr = payment ? formatINR(payment.amount) : "N/A";
      const durationStr = session.duration_minutes 
        ? `${Math.floor(session.duration_minutes/60)}h ${session.duration_minutes%60}m` 
        : "-";
      
      const text = `*${brandName}* - Parking Receipt\n\nDate: ${receiptDate}\nVehicle: ${session.vehicle_number}\nReceipt: ${payment?.receipt_number || "N/A"}\nEntry: ${formatDateTimeIST(session.entry_at)}\n${session.exit_at ? `Exit: ${formatDateTimeIST(session.exit_at)}\n` : ""}Duration: ${durationStr}\n\n*Total Amount: ${amountStr}*\n\nThank you for visiting!`;

      if (Capacitor.isNativePlatform()) {
        const base64 = await generatePdfBill(pdfData, "base64", "thermal");
        await sharePdfNative(base64 as string, filename, text);
      } else {
        await generatePdfBill(pdfData, false, "thermal"); 
        window.open(`https://wa.me/91${session.driver_number}?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch(err) {
      console.error("Error generating or sharing bill:", err);
      alert("Could not generate bill for sharing.");
    }
  };

  const handleDownload = async () => {
    try {
      const filename = `parking-bill-${session.vehicle_number}-${session.id.slice(-6)}.pdf`;
      const pdfData = {
        id: session.id,
        vehicleNumber: session.vehicle_number,
        vehicleType: session.vehicle_type,
        driverNumber: session.driver_number || "",
        notes: session.notes,
        entryAt: session.entry_at,
        exitAt: session.exit_at,
        durationMinutes: session.duration_minutes,
        grossAmount: session.gross_amount,
        paymentMethod: payment?.method,
        paymentStatus: payment?.status,
        receiptNumber: payment?.receipt_number,
        entryOperatorName: session.entry_operator?.name,
        exitOperatorName: session.exit_operator?.name,
        site: site,
      };

      if (Capacitor.isNativePlatform()) {
        const base64 = await generatePdfBill(pdfData, "base64", "thermal");
        await downloadPdfNative(base64 as string, filename);
      } else {
        await generatePdfBill(pdfData, false, "thermal");
      }
    } catch(err) {
      console.error("Error downloading bill:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:block">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 80mm;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm no-print" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 print-area text-slate-900">
        
        {/* Receipt Header */}
        <div className="bg-primary p-5 text-center text-primary-foreground print:bg-white print:text-black print:border-b print:border-dashed">
          <h2 className="text-lg font-bold tracking-tight mb-0.5">{brandName}</h2>
          <p className="text-[11px] opacity-90 uppercase tracking-widest font-semibold print:opacity-100">
            {session.exit_at ? "Official Exit Receipt" : "Parking Entry Slip"}
          </p>
          <p className="text-[10px] opacity-80 mt-1">Date: {receiptDate}</p>
        </div>

        {/* Receipt Body - Thermal Paper Style */}
        <div className="p-5 bg-amber-50/20 print:bg-white print:p-4 text-xs space-y-4">
          
          <div className="flex justify-between items-end pb-3 border-b-2 border-dashed border-slate-200 print:pb-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Vehicle No.</p>
              <p className="text-base font-mono font-black text-slate-900">{session.vehicle_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Receipt No.</p>
              <p className="text-xs font-mono font-bold text-slate-900">{payment?.receipt_number || `SWP-${session.id.slice(-6).toUpperCase()}`}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-slate-600 print:text-black">
            <div className="flex justify-between">
              <span className="text-slate-500">Category</span>
              <span className="font-bold text-slate-900">{session.vehicle_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Entry</span>
              <span className="font-semibold text-slate-900">{formatDateTimeIST(session.entry_at)}</span>
            </div>
            {session.exit_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Exit</span>
                <span className="font-semibold text-slate-900">{formatDateTimeIST(session.exit_at)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span className="font-bold text-primary">{session.duration_minutes ? `${Math.floor(session.duration_minutes/60)}h ${session.duration_minutes%60}m` : "Active"}</span>
            </div>
          </div>

          {payment && (
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100 print:border-none print:p-0">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Payment Mode</span>
                <span className="font-bold text-slate-900">{payment.method || "CASH"}</span>
              </div>
              {payment.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatINR(payment.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                <span className="font-bold text-slate-900">Total Paid</span>
                <span className="text-lg font-black text-primary print:text-black">{formatINR(payment.amount)}</span>
              </div>
            </div>
          )}
          
          <div className="pt-2 text-center text-[10px] text-slate-400 print:text-black space-y-1">
            <p>Thank you for parking with us!</p>
            <p className="font-medium text-slate-500">Operator: {operatorName}</p>
          </div>
        </div>

        {/* Action Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5 no-print">
          {session.driver_number && (
            <button 
              onClick={handleWhatsAppShare} 
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              Share on WhatsApp
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleDownload} 
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
          <button 
            onClick={onClose} 
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
