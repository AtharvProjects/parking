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
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";
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
  Printer,
  FileText
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { downloadNativeFile, sharePdfNative } from "@/lib/native-share";
import { cn } from "@/lib/utils";
import { AnimatedCount } from "@/components/animated-count";

export default function ReportsPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSiteId, authorizedSites, isAdmin } = useSite();
  const { t, language } = useLanguage();

  const [startDate, setStartDate] = useState(getTodayDateString);
  const [endDate, setEndDate] = useState(getTodayDateString);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(currentSiteId || "ALL");
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("ALL");
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedReceiptSession, setSelectedReceiptSession] = useState<any | null>(null);

  useBackHandler(!!selectedReceiptSession, () => setSelectedReceiptSession(null), 20);


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
    queryKey: ["reports", startDate, endDate, selectedSiteId, selectedOperatorId, employee?.company_id],
    queryFn: async () => {
      const siteFilter = selectedSiteId === "ALL" ? undefined : selectedSiteId;
      const operatorFilter = selectedOperatorId === "ALL" ? undefined : selectedOperatorId;
      return await sessionsService.getReports(startDate, endDate, siteFilter, operatorFilter);
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
    <div className="p-4 md:p-6 pb-36 space-y-6 max-w-4xl mx-auto font-sans">
      
      {/* ────────── HEADER WITH BACK BUTTON ────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 rv" style={{ ["--i" as any]: 0 }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/")}
            className="w-10 h-10 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">{t("reports.operationReports")}</h1>
            <p className="text-xs text-[var(--ink3)] font-medium mt-0.5">
              {t("reports.reportsSubtitle")}
            </p>
          </div>
        </div>

        {/* Export Action Pills */}
        <div className="flex items-center gap-2">
          <button 
            onClick={exportCSV} 
            disabled={!reportData?.sessions?.length}
            className="vx-btn soft !py-2.5 !px-3.5 text-xs font-bold disabled:opacity-50"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>CSV</span>
          </button>
          <button 
            onClick={exportPDF} 
            disabled={!reportData?.sessions?.length}
            className="vx-btn soft !py-2.5 !px-3.5 text-xs font-bold disabled:opacity-50"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>PDF</span>
          </button>
          <button 
            onClick={sharePDF} 
            disabled={!reportData?.sessions?.length}
            className="vx-btn accent !py-2.5 !px-4 text-xs font-bold shadow-md disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* ────────── QUICK STATEMENTS (VERTIX REFERENCE REP CARDS) ────────── */}
      <section className="vx-card rv" style={{ ["--i" as any]: 1 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--ink)]">Official Reports & Statements</h3>
          <span className="text-xs text-[var(--ink3)]">Auto-compiled</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3.5 bg-[var(--soft)] rounded-2xl border border-[var(--line)] hover:translate-x-1 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-[var(--card)] flex items-center justify-center text-[var(--accent)] shadow-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--ink)] truncate">Daily Parking Audit Summary</div>
              <small className="block text-[10.5px] text-[var(--ink3)]">PDF Statement · {startDate} to {endDate}</small>
            </div>
            <button
              type="button"
              onClick={exportPDF}
              disabled={!reportData?.sessions?.length}
              className="vx-btn soft !py-1.5 !px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-[var(--soft)] rounded-2xl border border-[var(--line)] hover:translate-x-1 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-[var(--card)] flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[var(--ink)] truncate">Shift Handover & Cash Audit</div>
              <small className="block text-[10.5px] text-[var(--ink3)]">Full collection breakdown by staff</small>
            </div>
            <button
              type="button"
              onClick={exportCSV}
              disabled={!reportData?.sessions?.length}
              className="vx-btn soft !py-1.5 !px-3 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ────────── FILTER CONTROLS ────────── */}
      <div className="vx-card p-5 space-y-4 rv" style={{ ["--i" as any]: 2 }}>
        
        {/* Quick Date Presets */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--ink)]">Filter Period</span>
          <div className="pill flex p-1 bg-[var(--soft)] gap-1 overflow-x-auto hide-scrollbar">
            {[
              { id: "today", label: t("reports.today") },
              { id: "yesterday", label: t("reports.yesterday") },
              { id: "week", label: t("reports.last7Days") },
              { id: "month", label: t("reports.thisMonth") },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setQuickDate(p.id as any)}
                className="px-3 py-1 text-xs font-bold rounded-full text-[var(--ink3)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-[var(--ink3)] block mb-1">{t("reports.fromDate")}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--ink3)] block mb-1">{t("reports.toDate")}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Multi-Criteria Filters: Site, Operator, Shift */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--line)]">
          {/* Site Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink3)] block mb-1">{t("reports.parkingSite")}</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">🏢 {t("nav.allSites")}</option>
              {(sites || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Operator Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink3)] block mb-1">{t("reports.staffOperator")}</label>
            <select
              value={selectedOperatorId}
              onChange={(e) => setSelectedOperatorId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">👥 {t("reports.allOperators")}</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({ROLE_CONFIG[emp.role as EmployeeRole]?.label || emp.role})</option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div>
            <label className="text-[11px] font-bold text-[var(--ink3)] block mb-1">{t("reports.assignedShift")}</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">🕒 {t("reports.allShifts")}</option>
              {Object.entries(SHIFT_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label} ({val.start}-{val.end})</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
        </div>
      )}

      {!isLoading && reportData && (
        <div className="space-y-5">
          
          {/* ────────── TOP TOTALS GRID WITH ANIMATED COUNTERS ────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rv" style={{ ["--i" as any]: 3 }}>
            
            {/* Total Revenue */}
            <div className="vx-card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--ink3)] uppercase tracking-wider">{t("reports.totalCollection")}</span>
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold">
                  ₹
                </div>
              </div>
              <div className="my-2">
                <AnimatedCount
                  value={reportData.totalRevenue}
                  formatter={formatINR}
                  className="text-3xl sm:text-4xl font-black text-[var(--accent)]"
                />
                <p className="text-xs text-[var(--ink3)] mt-1 font-medium">
                  {reportData.completedCount} {t("reports.paidTransactions")}
                </p>
              </div>
            </div>

            {/* Total Entries */}
            <div className="vx-card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--ink3)] uppercase tracking-wider">{t("reports.vehiclesLogged")}</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <AnimatedCount
                  value={reportData.totalVehicles}
                  className="text-3xl sm:text-4xl font-black text-[var(--ink)]"
                />
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                  {reportData.activeCount} {t("reports.currentlyParked")}
                </p>
              </div>
            </div>

          </div>

          {/* ────────── PAYMENT METHOD CHIPS ────────── */}
          <div className="grid grid-cols-3 gap-3 rv" style={{ ["--i" as any]: 4 }}>
            <div className="vx-card p-4 text-center">
              <span className="text-[10.5px] font-bold text-[var(--ink3)] uppercase block">{t("reports.cashInHand")}</span>
              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-1">
                {formatINR(reportData.totalCash)}
              </span>
            </div>
            <div className="vx-card p-4 text-center">
              <span className="text-[10.5px] font-bold text-[var(--ink3)] uppercase block">{t("reports.upiOnline")}</span>
              <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 block mt-1">
                {formatINR(reportData.totalUpi)}
              </span>
            </div>
            <div className="vx-card p-4 text-center">
              <span className="text-[10.5px] font-bold text-[var(--ink3)] uppercase block">{t("reports.discounts")}</span>
              <span className="text-base sm:text-lg font-black text-red-500 block mt-1">
                {formatINR(reportData.totalDiscount)}
              </span>
            </div>
          </div>

          {/* ────────── OPERATOR PERFORMANCE BREAKDOWN ────────── */}
          <div className="vx-card p-5 space-y-4 rv" style={{ ["--i" as any]: 5 }}>
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[var(--accent)]" />
                  <span>{t("reports.operatorAudit")}</span>
                </h3>
                <p className="text-xs text-[var(--ink3)]">{t("reports.operatorAuditDesc")}</p>
              </div>
            </div>

            <div className="space-y-3">
              {reportData.operatorBreakdown.map((op) => (
                <div key={op.id} className="p-4 rounded-2xl bg-[var(--soft)] border border-[var(--line)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--ink)]">{op.name}</h4>
                        <p className="text-[10px] text-[var(--ink3)]">{op.mobile}</p>
                      </div>
                    </div>
                    {op.shift && (
                      <span className="px-2.5 py-1 rounded-full bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] text-[10px] font-bold">
                        {SHIFT_CONFIG[op.shift as ShiftType]?.label || op.shift}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-[var(--line)] text-center">
                    <div>
                      <span className="text-[10px] text-[var(--ink3)] font-semibold block">{t("reports.entries")}</span>
                      <span className="text-xs font-extrabold text-[var(--ink)]">{op.entriesCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--ink3)] font-semibold block">{t("reports.exits")}</span>
                      <span className="text-xs font-extrabold text-[var(--ink)]">{op.exitsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--ink3)] font-semibold block">{t("reports.cash")}</span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{formatINR(op.cashCollected)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--ink3)] font-semibold block">{t("reports.total")}</span>
                      <span className="text-xs font-black text-[var(--accent)]">{formatINR(op.totalCollected)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {reportData.operatorBreakdown.length === 0 && (
                <div className="text-center py-6 text-xs text-[var(--ink3)]">{t("reports.noActivity")}</div>
              )}
            </div>
          </div>

          {/* ────────── DETAILED SESSION LOG ────────── */}
          <div className="vx-card p-5 space-y-3 rv" style={{ ["--i" as any]: 6 }}>
            <h3 className="text-sm font-bold text-[var(--ink)]">
              {t("reports.transactionRegister")} ({reportData.sessions.length})
            </h3>
            <div className="space-y-2">
              {reportData.sessions.slice(0, 50).map((s: any) => {
                const payment = Array.isArray(s.payment) ? s.payment[0] : s.payment;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedReceiptSession(s)}
                    className="p-3.5 rounded-2xl bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] transition-all flex items-center justify-between text-xs cursor-pointer active:scale-[0.99]"
                  >
                    <div>
                      <div className="font-mono font-bold text-[var(--ink)]">{s.vehicle_number}</div>
                      <div className="text-[10.5px] text-[var(--ink3)] mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{s.site_name || t("gate.mainSite")}</span>
                        <span>•</span>
                        <span>{t("search.entryTime")}: {formatTimeIST(s.entry_at)} ({s.entry_operator?.name?.split(" ")[0] || t("common.staff")})</span>
                        {s.exit_at && (
                          <>
                            <span>•</span>
                            <span>{t("search.exitTime")}: {formatTimeIST(s.exit_at)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-xs sm:text-sm text-[var(--accent)]">
                        {payment?.amount ? formatINR(payment.amount) : (s.gross_amount ? formatINR(s.gross_amount) : "-")}
                      </div>
                      <span className="vx-badge vx-up mt-0.5">
                        {s.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {reportData.sessions.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--ink3)] font-medium">
                  {t("reports.noSessions")}
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

