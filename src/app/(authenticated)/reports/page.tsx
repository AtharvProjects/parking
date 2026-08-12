"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { sessionsService } from "@/services/sessions.service";
import { sitesService } from "@/services/sites.service";
import { employeesService } from "@/services/employees.service";
import { formatINR, formatDateTimeIST, formatTimeIST, formatDateIST, humanizeDuration, getTodayDateString } from "@/lib/formatters";
import { VEHICLE_TYPE_CONFIG, PAYMENT_METHOD_CONFIG, BUSINESS_NAME, SHIFT_CONFIG, ROLE_CONFIG } from "@/lib/constants";
import type { ShiftType, EmployeeRole } from "@/lib/database.types";
import { BillReceiptModal } from "@/components/bill-receipt-modal";
import {
  Download,
  IndianRupee,
  Car,
  Loader2,
  Check,
  Share2,
  Users,
  Building2,
  Clock,
  Filter,
  Calendar,
  Wallet,
  Smartphone,
  CreditCard,
  UserCheck,
  ArrowLeft,
  Printer
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { downloadNativeFile, sharePdfNative } from "@/lib/native-share";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSiteId, authorizedSites, isAdmin } = useSite();

  const [startDate, setStartDate] = useState(getTodayDateString);
  const [endDate, setEndDate] = useState(getTodayDateString);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(currentSiteId || "ALL");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("ALL");
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedReceiptSession, setSelectedReceiptSession] = useState<any | null>(null);


  // Fetch Sites for filter
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: () => sitesService.getAll(),
  });

  // Fetch Employees for filter
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesService.getAll(),
  });

  // Fetch Sessions for date range & site
  const { data: rawSessions, isLoading } = useQuery({
    queryKey: ["reports", startDate, endDate, selectedSiteId, employee?.company_id],
    queryFn: async () => {
      const companyId = employee?.company_id || localStorage.getItem("company_id") || "";
      const siteFilter = selectedSiteId === "ALL" ? undefined : selectedSiteId;
      return await sessionsService.getReports(startDate, endDate, siteFilter, companyId);
    },
    refetchInterval: 30_000,
  });

  // Apply in-memory filters (Operator & Shift)
  const filteredSessions = useMemo(() => {
    if (!rawSessions) return [];
    return rawSessions.filter((s: any) => {
      // Filter by Operator (either entry or exit operator)
      if (selectedOperatorId !== "ALL") {
        const matchesEntry = s.entry_operator_id === selectedOperatorId;
        const matchesExit = s.exit_operator_id === selectedOperatorId;
        if (!matchesEntry && !matchesExit) return false;
      }
      // Filter by Shift
      if (selectedShift !== "ALL") {
        const matchesEntryShift = s.entry_operator?.shift === selectedShift;
        const matchesExitShift = s.exit_operator?.shift === selectedShift;
        if (!matchesEntryShift && !matchesExitShift) return false;
      }
      return true;
    });
  }, [rawSessions, selectedOperatorId, selectedShift]);

  // Aggregate Metrics & Operator Breakdown
  const reportData = useMemo(() => {
    const sessions = filteredSessions;
    const completed = sessions.filter((s: any) => s.status === "COMPLETED");

    let totalGross = 0;
    let totalDiscount = 0;
    let totalCash = 0;
    let totalUpi = 0;
    let totalCard = 0;

    for (const s of completed) {
      const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
      const amount = payment?.amount ?? s.gross_amount ?? 0;
      const discount = payment?.discount_amount || 0;
      totalGross += amount;
      totalDiscount += discount;

      if (payment?.method === "CASH") totalCash += amount;
      else if (payment?.method === "UPI") totalUpi += amount;
      else if (payment?.method === "CARD") totalCard += amount;
    }

    const avgDuration = completed.length > 0
      ? completed.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0) / completed.length
      : 0;

    // Operator-wise performance breakdown
    const operatorMap = new Map<string, {
      id: string;
      name: string;
      mobile: string;
      shift?: string;
      entriesCount: number;
      exitsCount: number;
      cashCollected: number;
      upiCollected: number;
      cardCollected: number;
      totalCollected: number;
      discountsGiven: number;
    }>();

    for (const s of sessions) {
      // Entry operator stats
      const entryOpId = s.entry_operator_id || "unknown";
      const entryOpName = s.entry_operator?.name || s.entry_operator_name || "Unknown Operator";
      const entryOpMobile = s.entry_operator?.mobile || s.entry_operator_mobile || "-";
      const entryOpShift = s.entry_operator?.shift || s.entry_operator_shift;

      if (!operatorMap.has(entryOpId)) {
        operatorMap.set(entryOpId, {
          id: entryOpId,
          name: entryOpName,
          mobile: entryOpMobile,
          shift: entryOpShift,
          entriesCount: 0,
          exitsCount: 0,
          cashCollected: 0,
          upiCollected: 0,
          cardCollected: 0,
          totalCollected: 0,
          discountsGiven: 0,
        });
      }
      const entryOpData = operatorMap.get(entryOpId)!;
      entryOpData.entriesCount++;

      // Exit operator stats & payment collection
      if (s.status === "COMPLETED") {
        const exitOpId = s.exit_operator_id || entryOpId;
        const exitOpName = s.exit_operator?.name || s.exit_operator_name || entryOpName;
        const exitOpMobile = s.exit_operator?.mobile || s.exit_operator_mobile || entryOpMobile;
        const exitOpShift = s.exit_operator?.shift || s.exit_operator_shift || entryOpShift;

        if (!operatorMap.has(exitOpId)) {
          operatorMap.set(exitOpId, {
            id: exitOpId,
            name: exitOpName,
            mobile: exitOpMobile,
            shift: exitOpShift,
            entriesCount: 0,
            exitsCount: 0,
            cashCollected: 0,
            upiCollected: 0,
            cardCollected: 0,
            totalCollected: 0,
            discountsGiven: 0,
          });
        }
        const exitOpData = operatorMap.get(exitOpId)!;
        exitOpData.exitsCount++;

        const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
        const paidAmt = payment?.amount ?? s.gross_amount ?? 0;
        const discAmt = payment?.discount_amount || 0;

        exitOpData.totalCollected += paidAmt;
        exitOpData.discountsGiven += discAmt;

        if (payment?.method === "CASH") exitOpData.cashCollected += paidAmt;
        else if (payment?.method === "UPI") exitOpData.upiCollected += paidAmt;
        else if (payment?.method === "CARD") exitOpData.cardCollected += paidAmt;
      }
    }

    return {
      sessions,
      totalRevenue: totalGross,
      totalDiscount,
      totalCash,
      totalUpi,
      totalCard,
      totalVehicles: sessions.length,
      completedCount: completed.length,
      activeCount: sessions.filter((s: any) => s.status === "ACTIVE").length,
      avgDuration: Math.round(avgDuration),
      operatorBreakdown: Array.from(operatorMap.values()),
    };
  }, [filteredSessions]);

  // Quick Date Helpers
  const setQuickDate = (preset: "today" | "yesterday" | "week" | "month") => {
    const now = new Date();
    if (preset === "today") {
      const d = getTodayDateString(now);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === "yesterday") {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const d = getTodayDateString(y);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === "week") {
      const w = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(getTodayDateString(w));
      setEndDate(getTodayDateString(now));
    } else if (preset === "month") {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getTodayDateString(m));
      setEndDate(getTodayDateString(now));
    }
  };

  const exportCSV = async () => {
    if (!reportData?.sessions?.length) return;
    const headers = [
      "Vehicle",
      "Type",
      "Site",
      "Entry Time",
      "Entry Operator",
      "Exit Time",
      "Exit Operator",
      "Duration",
      "Gross (INR)",
      "Discount (INR)",
      "Net Paid (INR)",
      "Status",
      "Payment Mode",
      "Receipt Number"
    ];
    const rows = reportData.sessions.map((s: any) => {
      const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
      return [
        s.vehicle_number,
        s.vehicle_type,
        s.site_name || "Main Site",
        formatDateTimeIST(s.entry_at),
        s.entry_operator?.name || s.entry_operator_name || "-",
        s.exit_at ? formatDateTimeIST(s.exit_at) : "-",
        s.exit_operator?.name || s.exit_operator_name || "-",
        s.duration_minutes ? humanizeDuration(s.duration_minutes) : "-",
        s.gross_amount ? (s.gross_amount / 100).toFixed(2) : "-",
        payment?.discount_amount ? (payment.discount_amount / 100).toFixed(2) : "0.00",
        payment?.amount ? (payment.amount / 100).toFixed(2) : (s.gross_amount ? (s.gross_amount / 100).toFixed(2) : "-"),
        s.status,
        payment?.method || "-",
        payment?.receipt_number || "-",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `parking_report_${startDate}_to_${endDate}.csv`;
    
    if (Capacitor.isNativePlatform()) {
      const base64Data = btoa(unescape(encodeURIComponent(csv)));
      await downloadNativeFile(base64Data, filename);
    } else {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const generatePDFDoc = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${BUSINESS_NAME} - Parking & Operator Report`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Period: ${startDate} to ${endDate} | Site: ${selectedSiteId === "ALL" ? "All Sites" : (sites?.find(s => s.id === selectedSiteId)?.name || selectedSiteId)} | Shift: ${selectedShift}`, 14, 25);
    doc.text(`Total Vehicles: ${reportData.totalVehicles} | Exits: ${reportData.completedCount} | Net Revenue: ${formatINR(reportData.totalRevenue)} (Cash: ${formatINR(reportData.totalCash)} | UPI: ${formatINR(reportData.totalUpi)})`, 14, 31);

    // Operator Summary Table
    if (reportData.operatorBreakdown.length > 0) {
      doc.setFontSize(11);
      doc.text("Operator Performance & Cash Collection Summary", 14, 40);
      const opTable = reportData.operatorBreakdown.map((op) => [
        op.name,
        op.shift ? `${op.shift} Shift` : "-",
        String(op.entriesCount),
        String(op.exitsCount),
        formatINR(op.cashCollected),
        formatINR(op.upiCollected),
        formatINR(op.totalCollected),
      ]);
      autoTable(doc, {
        startY: 44,
        head: [["Operator", "Shift", "Entries", "Exits", "Cash In Hand", "UPI / Online", "Total Collected"]],
        body: opTable,
        styles: { fontSize: 8 },
      });
    }

    // Detailed Sessions Table
    if (reportData.sessions.length > 0) {
      const nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 50;
      doc.setFontSize(11);
      doc.text("Detailed Vehicle Transaction Register", 14, nextY);
      const sessionTable = reportData.sessions.map((s: any) => {
        const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
        return [
          s.vehicle_number,
          VEHICLE_TYPE_CONFIG[s.vehicle_type as keyof typeof VEHICLE_TYPE_CONFIG]?.label || s.vehicle_type,
          formatDateTimeIST(s.entry_at),
          s.entry_operator?.name || "-",
          s.exit_at ? formatDateTimeIST(s.exit_at) : "-",
          payment?.amount ? formatINR(payment.amount) : "-",
          payment?.method || "-",
          s.status,
        ];
      });
      autoTable(doc, {
        startY: nextY + 4,
        head: [["Vehicle", "Type", "Entry", "Operator", "Exit", "Amount", "Mode", "Status"]],
        body: sessionTable,
        styles: { fontSize: 7 },
      });
    }

    return doc;
  };

  const exportPDF = () => {
    if (!reportData?.sessions?.length) return;
    const doc = generatePDFDoc();
    const filename = `parking_report_${startDate}_to_${endDate}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64Data = doc.output("datauristring").split(",")[1];
      downloadNativeFile(base64Data, filename);
    } else {
      doc.save(filename);
    }
  };

  const sharePDF = async () => {
    if (!reportData?.sessions?.length) return;
    const doc = generatePDFDoc();
    const filename = `parking_report_${startDate}_to_${endDate}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const base64Data = doc.output("datauristring").split(",")[1];
      await sharePdfNative(base64Data, filename, `${BUSINESS_NAME} Report (${startDate} to ${endDate})`);
    } else {
      doc.save(filename);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-36 space-y-5 max-w-2xl mx-auto font-sans">
      
      {/* ────────── HEADER WITH BACK BUTTON ────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-9 h-9 rounded-full bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Operation Reports</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Live multi-site & operator audit trail
            </p>
          </div>
        </div>
      </div>


      {/* ────────── FILTER CONTROLS ────────── */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 shadow-sm space-y-3.5">
        
        {/* Quick Date Presets */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
          <button
            type="button"
            onClick={() => setQuickDate("today")}
            className="px-3 py-1 rounded-xl text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setQuickDate("yesterday")}
            className="px-3 py-1 rounded-xl text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setQuickDate("week")}
            className="px-3 py-1 rounded-xl text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setQuickDate("month")}
            className="px-3 py-1 rounded-xl text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
          >
            This Month
          </button>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Multi-Criteria Filters: Site, Operator, Shift */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/60">
          
          {/* Site Filter */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Parking Site</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            >
              <option value="ALL">🏢 All Sites (Combined)</option>
              {(sites || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Operator Filter */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Staff / Operator</label>
            <select
              value={selectedOperatorId}
              onChange={(e) => setSelectedOperatorId(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            >
              <option value="ALL">👥 All Operators</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({ROLE_CONFIG[emp.role as EmployeeRole]?.label || emp.role})</option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Assigned Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full h-10 px-2.5 rounded-xl border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            >
              <option value="ALL">🕒 All Shifts</option>
              {Object.entries(SHIFT_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label} ({val.start}-{val.end})</option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* ────────── EXPORT BUTTONS ────────── */}
      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={exportCSV} 
          disabled={!reportData?.sessions?.length}
          className="flex items-center justify-center gap-1.5 border border-border bg-card py-2.5 rounded-2xl font-bold shadow-sm text-xs text-foreground hover:bg-muted transition-all active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-primary" /> CSV Data
        </button>
        <button 
          onClick={exportPDF} 
          disabled={!reportData?.sessions?.length}
          className="flex items-center justify-center gap-1.5 border border-border bg-card py-2.5 rounded-2xl font-bold shadow-sm text-xs text-foreground hover:bg-muted transition-all active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-primary" /> PDF Audit
        </button>
        <button 
          onClick={sharePDF} 
          disabled={!reportData?.sessions?.length}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary to-orange-600 text-white py-2.5 rounded-2xl font-bold shadow-md shadow-primary/20 text-xs hover:opacity-95 transition-all active:scale-95 disabled:opacity-50"
        >
          <Share2 className="w-3.5 h-3.5" /> Share Report
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {!isLoading && reportData && (
        <div className="space-y-4">
          
          {/* ────────── TOP TOTALS GRID ────────── */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Total Revenue */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Collection</span>
                <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-primary">{formatINR(reportData.totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {reportData.completedCount} paid transactions
                </p>
              </div>
            </div>

            {/* Total Entries */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Vehicles Logged</span>
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-foreground">{reportData.totalVehicles}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
                  {reportData.activeCount} currently parked
                </p>
              </div>
            </div>

          </div>

          {/* ────────── PAYMENT METHOD CHIPS ────────── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border/80 rounded-2xl p-3 text-center shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Cash in Hand</span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">{formatINR(reportData.totalCash)}</span>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-3 text-center shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">UPI / Online</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400 block mt-0.5">{formatINR(reportData.totalUpi)}</span>
            </div>
            <div className="bg-card border border-border/80 rounded-2xl p-3 text-center shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Discounts</span>
              <span className="text-sm font-black text-red-500 block mt-0.5">{formatINR(reportData.totalDiscount)}</span>
            </div>
          </div>

          {/* ────────── OPERATOR PERFORMANCE BREAKDOWN ────────── */}
          <div className="bg-card border border-border rounded-[28px] p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Operator Performance & Cash Audit</span>
                </h3>
                <p className="text-[11px] text-muted-foreground">Breakdown of entries, exits, and collections by staff</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {reportData.operatorBreakdown.map((op) => (
                <div key={op.id} className="p-3.5 rounded-2xl bg-muted/60 border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{op.name}</h4>
                        <p className="text-[10px] text-muted-foreground">{op.mobile}</p>
                      </div>
                    </div>
                    {op.shift && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                        {SHIFT_CONFIG[op.shift as ShiftType]?.label || op.shift} Shift
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40 text-center">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Entries</span>
                      <span className="text-xs font-bold text-foreground">{op.entriesCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Exits</span>
                      <span className="text-xs font-bold text-foreground">{op.exitsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Cash</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatINR(op.cashCollected)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Total</span>
                      <span className="text-xs font-black text-primary">{formatINR(op.totalCollected)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {reportData.operatorBreakdown.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">No operator activity for selected filters</div>
              )}
            </div>
          </div>

          {/* ────────── DETAILED SESSION LOG ────────── */}
          <div className="bg-card border border-border rounded-[28px] p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold text-foreground px-1 pb-1">
              Vehicle Transaction Register ({reportData.sessions.length})
            </h3>
            <div className="space-y-1.5">
              {reportData.sessions.slice(0, 50).map((s: any) => {
                const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedReceiptSession(s)}
                    className="p-3 rounded-2xl bg-muted/40 hover:bg-muted transition-colors flex items-center justify-between text-xs cursor-pointer active:scale-[0.99]"
                  >
                    <div>
                      <div className="font-mono font-bold text-foreground">{s.vehicle_number}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{s.site_name || "Site"}</span>
                        <span>•</span>
                        <span>In: {formatTimeIST(s.entry_at)} ({s.entry_operator?.name?.split(" ")[0] || "Staff"})</span>
                        {s.exit_at && (
                          <>
                            <span>•</span>
                            <span>Out: {formatTimeIST(s.exit_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">
                        {payment?.amount ? formatINR(payment.amount) : (s.gross_amount ? formatINR(s.gross_amount) : "-")}
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full inline-block mt-0.5",
                        s.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600"
                      )}>
                        {payment?.method ? `${payment.method} • ` : ""}{s.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {reportData.sessions.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground font-medium">
                  No sessions found matching selected filters
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ────────── RECEIPT MODAL ────────── */}
      {selectedReceiptSession && (
        <BillReceiptModal
          session={selectedReceiptSession}
          onClose={() => setSelectedReceiptSession(null)}
        />
      )}

    </div>
  );
}

