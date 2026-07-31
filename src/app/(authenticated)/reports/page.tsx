"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { supabase } from "@/lib/supabase";
import type { SessionWithRelations } from "@/lib/database.types";
import { formatINR, formatDateTimeIST, humanizeDuration } from "@/lib/formatters";
import { VEHICLE_TYPE_CONFIG, SESSION_STATUS_CONFIG, PAYMENT_METHOD_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Calendar, Download, IndianRupee, Car, FileText, Loader2, Check } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { downloadNativeFile } from "@/lib/native-share";

const COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#22C55E", "#F59E0B"];

export default function ReportsPage() {
  const { employee } = useAuth();
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports", startDate, endDate, employee?.site_id],
    queryFn: async () => {
      const startISO = new Date(startDate).toISOString();
      const endISO = new Date(endDate + "T23:59:59").toISOString();

      const { data: sessions, error } = await supabase
        .from("parking_sessions")
        .select(`
          *,
          entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
          exit_operator:employees!parking_sessions_exit_operator_id_fkey(name),
          payment:payments(amount, status, method, receipt_number)
        `)
        .gte("entry_at", startISO)
        .lte("entry_at", endISO)
        .is("deleted_at", null)
        .order("entry_at", { ascending: false })
        .returns<SessionWithRelations[]>();

      if (error) throw error;

      const completed = (sessions || []).filter((s: any) => s.status === "COMPLETED");
      const totalRevenue = completed.reduce((sum: number, s: any) => sum + (s.gross_amount || 0), 0);
      const avgDuration = completed.length > 0
        ? completed.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0) / completed.length
        : 0;

      // Vehicle type breakdown
      const typeMap = new Map<string, { count: number; revenue: number }>();
      for (const s of (sessions as any[]) || []) {
        const entry = typeMap.get(s.vehicle_type) || { count: 0, revenue: 0 };
        entry.count++;
        entry.revenue += s.gross_amount || 0;
        typeMap.set(s.vehicle_type, entry);
      }

      // Payment method breakdown
      const methodMap = new Map<string, number>();
      for (const s of completed) {
        const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
        if (payment?.method) {
          methodMap.set(payment.method, (methodMap.get(payment.method) || 0) + (payment.amount || 0));
        }
      }

      return {
        sessions: sessions || [],
        totalRevenue,
        totalVehicles: (sessions || []).length,
        completedCount: completed.length,
        activeCount: (sessions || []).filter((s: any) => s.status === "ACTIVE").length,
        avgDuration: Math.round(avgDuration),
        vehicleTypes: Array.from(typeMap.entries()).map(([type, data]) => ({
          name: VEHICLE_TYPE_CONFIG[type as keyof typeof VEHICLE_TYPE_CONFIG]?.label || type,
          ...data,
        })),
        paymentMethods: Array.from(methodMap.entries()).map(([method, amount]) => ({
          name: PAYMENT_METHOD_CONFIG[method as keyof typeof PAYMENT_METHOD_CONFIG]?.label || method,
          amount,
        })),
      };
    },
    enabled: !!employee,
  });

  const exportCSV = async () => {
    if (!reportData?.sessions?.length) return;
    const headers = ["Vehicle", "Type", "Entry", "Exit", "Duration", "Amount", "Status", "Payment"];
    const rows = reportData.sessions.map((s: any) => {
      const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
      return [
        s.vehicle_number,
        s.vehicle_type,
        formatDateTimeIST(s.entry_at),
        s.exit_at ? formatDateTimeIST(s.exit_at) : "-",
        s.duration_minutes ? humanizeDuration(s.duration_minutes) : "-",
        s.gross_amount ? (s.gross_amount / 100).toFixed(2) : "-",
        s.status,
        payment?.method || "-",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `report_${startDate}_${endDate}.csv`;
    
    if (Capacitor.isNativePlatform()) {
      const base64Data = btoa(unescape(encodeURIComponent(csv)));
      await downloadNativeFile(base64Data, filename);
    } else {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportPDF = () => {
    if (!reportData?.sessions?.length) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("THE EAST PALACE - Parking Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 28);
    doc.text(`Total Revenue: ${formatINR(reportData.totalRevenue)}`, 14, 34);
    doc.text(`Total Vehicles: ${reportData.totalVehicles}`, 14, 40);

    const tableData = reportData.sessions.map((s: any) => {
      const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
      return [
        s.vehicle_number,
        s.vehicle_type,
        formatDateTimeIST(s.entry_at),
        s.exit_at ? formatDateTimeIST(s.exit_at) : "-",
        s.duration_minutes ? humanizeDuration(s.duration_minutes) : "-",
        s.gross_amount ? formatINR(s.gross_amount) : "-",
        s.status,
      ];
    });

    autoTable(doc, {
      startY: 48,
      head: [["Vehicle", "Type", "Entry", "Exit", "Duration", "Amount", "Status"]],
      body: tableData,
      styles: { fontSize: 8 },
    });

    const filename = `report_${startDate}_${endDate}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64Data = doc.output("datauristring").split(',')[1];
      downloadNativeFile(base64Data, filename);
    } else {
      doc.save(filename);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">Reports</h1>
        <p className="text-[15px] font-medium text-gray-400">Generate and export parking operation reports.</p>
      </div>

      {/* Date Range Pill */}
      <div className="flex items-center">
        <div className="flex items-center gap-2 bg-gray-100/80 rounded-2xl px-4 py-2.5 shadow-sm">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="bg-transparent text-sm font-semibold text-gray-600 focus:outline-none w-[110px]" 
          />
          <span className="text-gray-400 font-medium px-1">-</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="bg-transparent text-sm font-semibold text-gray-600 focus:outline-none w-[110px]" 
          />
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex items-center gap-3">
        <button 
          onClick={exportCSV} 
          className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary py-3.5 rounded-2xl font-bold shadow-sm hover:bg-primary/20 transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button 
          onClick={exportPDF} 
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-bold shadow-[0_4px_15px_rgba(108,77,255,0.3)] hover:opacity-90 transition-opacity"
        >
          Export PDF
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {reportData && (
        <div className="space-y-4">
          {/* Summary Cards Vertical Stack */}
          <div className="bg-white border border-gray-50 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-1">
              <Car className="w-4 h-4" /> Total Entries
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{reportData.totalVehicles}</p>
          </div>

          <div className="bg-white border border-gray-50 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-1">
              <div className="w-4 h-4 rounded-full border-2 border-gray-400 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-gray-400" strokeWidth={3} />
              </div> 
              Completed Exits
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{reportData.completedCount}</p>
          </div>

          <div className="bg-white border border-gray-50 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-1">
              <IndianRupee className="w-4 h-4" /> Total Revenue
            </div>
            <p className="text-3xl font-extrabold text-primary">{formatINR(reportData.totalRevenue)}</p>
          </div>

          <div className="bg-white border border-gray-50 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium mb-1">
              <IndianRupee className="w-4 h-4" /> Discounts Given
            </div>
            <p className="text-3xl font-extrabold text-red-500">₹0</p>
          </div>

          {/* Sessions Table Container (Truncated top style) */}
          <div className="bg-gray-100/50 rounded-[32px] rounded-b-none p-4 mt-6">
            <div className="grid grid-cols-4 gap-2 px-2 pb-2">
              <div className="text-[12px] font-bold text-gray-400 col-span-2">Vehicle</div>
              <div className="text-[12px] font-bold text-gray-400 text-center">Type</div>
              <div className="text-[12px] font-bold text-gray-400 text-right">Entry</div>
            </div>
            <div className="bg-white rounded-[24px] p-2 shadow-sm space-y-1">
              {reportData.sessions.slice(0, 50).map((s: any) => (
                <div key={s.id} className="grid grid-cols-4 gap-2 items-center p-3 rounded-2xl hover:bg-gray-50">
                  <div className="col-span-2 font-mono font-bold text-sm">{s.vehicle_number}</div>
                  <div className="text-center text-sm font-medium text-gray-600">
                    {VEHICLE_TYPE_CONFIG[s.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label || s.vehicle_type}
                  </div>
                  <div className="text-right text-[11px] font-medium text-gray-500">
                    {new Date(s.entry_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
              {reportData.sessions.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm font-medium">No sessions found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
