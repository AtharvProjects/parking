import React from "react";
import { formatINR, formatDateTimeIST } from "@/lib/formatters";
import type { SessionWithRelations } from "@/lib/database.types";
import { BUSINESS_NAME } from "@/lib/constants";
import { Printer, MessageCircle, X, Download } from "lucide-react";
import { generatePdfBill } from "@/lib/pdf-bill";
import { sharePdfNative, downloadPdfNative } from "@/lib/native-share";
import { Capacitor } from "@capacitor/core";
import { useQuery } from "@tanstack/react-query";
import { sitesService } from "@/services/sites.service";
import { useAuth } from "@/providers/auth-provider";

export function BillReceiptModal({
  session,
  onClose,
}: {
  session: SessionWithRelations;
  onClose: () => void;
}) {
  const { employee } = useAuth();
  
  const { data: site } = useQuery({
    queryKey: ["site", employee?.site_id],
    queryFn: () => sitesService.getById(employee!.site_id),
    enabled: !!employee,
  });

  const payment = Array.isArray(session.payment) ? session.payment[0] : session.payment;

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
      
      const brandName = site?.brand_name || site?.name || BUSINESS_NAME;
      
      const text = `*${brandName}* - Parking Receipt\n\nVehicle: ${session.vehicle_number}\nReceipt: ${payment?.receipt_number || "N/A"}\nEntry: ${formatDateTimeIST(session.entry_at)}\nDuration: ${durationStr}\n\n*Total Amount: ${amountStr}*\n\nThank you for visiting!`;

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
            max-width: 80mm; /* Standard thermal printer width */
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

      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 print-area">
        
        {/* Receipt Header */}
        <div className="bg-primary p-6 text-center text-primary-foreground print:bg-white print:text-black print:border-b print:border-dashed">
          <h2 className="text-xl font-bold tracking-tight mb-1">{site?.brand_name || site?.name || BUSINESS_NAME}</h2>
          <p className="text-xs opacity-90 uppercase tracking-widest font-medium print:opacity-100">Parking Receipt</p>
        </div>

        {/* Receipt Body - Thermal Paper Style */}
        <div className="p-6 bg-amber-50/30 print:bg-white print:p-4">
          <div className="flex justify-between items-end mb-6 pb-4 border-b-2 border-dashed border-gray-200 print:mb-4 print:pb-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 print:text-black">Vehicle No.</p>
              <p className="text-lg font-mono font-bold text-gray-900">{session.vehicle_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 print:text-black">Receipt No.</p>
              <p className="text-sm font-mono font-medium text-gray-900">{payment?.receipt_number || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-3 mb-6 text-sm text-gray-600 print:text-black print:mb-4">
            <div className="flex justify-between">
              <span>Vehicle Type</span>
              <span className="font-medium text-gray-900">{session.vehicle_type}</span>
            </div>
            <div className="flex justify-between">
              <span>Entry Time</span>
              <span className="font-medium text-gray-900">{formatDateTimeIST(session.entry_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Exit Time</span>
              <span className="font-medium text-gray-900">{session.exit_at ? formatDateTimeIST(session.exit_at) : "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Duration</span>
              <span className="font-medium text-gray-900">{session.duration_minutes ? `${Math.floor(session.duration_minutes/60)}h ${session.duration_minutes%60}m` : "-"}</span>
            </div>
          </div>

          {payment && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100 print:border-none print:p-0">
              <div className="flex justify-between text-sm print:text-black">
                <span className="text-gray-500 print:text-black">Payment Method</span>
                <span className="font-medium text-gray-900">{payment.method}</span>
              </div>
              {payment.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 print:text-black">
                  <span>Discount</span>
                  <span>-{formatINR(payment.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2 print:border-t-2 print:border-dashed print:border-black">
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="text-xl font-bold text-primary print:text-black">{formatINR(payment.amount)}</span>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center text-xs text-gray-400 print:text-black">
            <p>Thank you for visiting!</p>
            <p className="mt-1">Operator: {session.exit_operator?.name || session.entry_operator?.name}</p>
          </div>
        </div>

        {/* Action Bar (Hidden in Print) */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3 no-print">
          <button 
            onClick={handleWhatsAppShare} 
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#25D366] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            <MessageCircle className="w-5 h-5" />
            Share Bill on WhatsApp
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" /> Close
            </button>
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors hidden sm:flex">
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
