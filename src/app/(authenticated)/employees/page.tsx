"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { employeesService } from "@/services/employees.service";
import { staffService } from "@/services/staff.service";
import { sitesService } from "@/services/sites.service";
import {
  ROLE_CONFIG,
  SHIFT_CONFIG,
  ATTENDANCE_STATUS_CONFIG,
  STAFF_TRANSACTION_CONFIG,
  SALARY_TYPE_CONFIG,
  hasPermission,
  getRoleLabel,
  getShiftLabel,
  getSalaryTypeLabel,
  getAttendanceStatusLabel,
  getStaffTransactionTypeLabel,
} from "@/lib/constants";
import type {
  Employee,
  EmployeeRole,
  ShiftType,
  SalaryType,
  StaffAttendanceStatus,
  StaffTransactionType,
  TransactionPaymentMethod,
  StaffAttendance,
  StaffTransaction,
} from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { formatINR, formatDateTimeIST, formatDateIST, getTodayDateString } from "@/lib/formatters";
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";
import {
  Plus,
  Search,
  X,
  Loader2,
  Check,
  UserPlus,
  Phone,
  Mail,
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  DollarSign,
  CreditCard,
  TrendingUp,
  Clock,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  FileText,
  Trash2,
  Shield,
  Briefcase,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

type ActiveTab = "directory" | "attendance" | "payroll" | "ledger";

export default function StaffManagementPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId, authorizedSites, isAdmin } = useSite();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<ActiveTab>("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  // Selected date for Daily Attendance tab (defaults to today YYYY-MM-DD)
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(getTodayDateString());

  // Selected month for Monthly Payroll tab (defaults to current month YYYY-MM)
  const currentMonthStr = useMemo(() => getTodayDateString().slice(0, 7), []);
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState<string>(currentMonthStr);

  // Modals state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    role: "OPERATOR" as EmployeeRole,
    shift: "" as ShiftType | "",
    site_id: "",
    pin: "1234",
    base_salary_rs: 15000,
    salary_type: "MONTHLY" as SalaryType,
    designation: "Parking Attendant",
    joining_date: getTodayDateString(),
  });

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    employee_id: "",
    amount_rs: 2000,
    payment_date: getTodayDateString(),
    payment_method: "CASH" as TransactionPaymentMethod,
    month: currentMonthStr,
    notes: "Salary Advance",
    transaction_ref: "",
  });

  const [showSalaryPayModal, setShowSalaryPayModal] = useState(false);
  const [salaryPayFormData, setSalaryPayFormData] = useState({
    employee_id: "",
    amount_rs: 0,
    payment_date: getTodayDateString(),
    payment_method: "CASH" as TransactionPaymentMethod,
    month: currentMonthStr,
    notes: "Monthly Salary Payout",
    transaction_ref: "",
  });

  const [selectedEmployeeForDrawer, setSelectedEmployeeForDrawer] = useState<Employee | null>(null);

  // Register back button handlers for all dialogs and drawer
  useBackHandler(showEmployeeModal, () => setShowEmployeeModal(false), 20);
  useBackHandler(showAdvanceModal, () => setShowAdvanceModal(false), 20);
  useBackHandler(showSalaryPayModal, () => setShowSalaryPayModal(false), 20);
  useBackHandler(!!selectedEmployeeForDrawer, () => setSelectedEmployeeForDrawer(null), 15);

  const effectiveSiteId = currentSiteId && currentSiteId !== "ALL" ? currentSiteId : employee?.site_id;

  // ─── QUERIES ─────────────────────────────────────────────

  // 1. All Employees
  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    queryKey: ["employees", effectiveSiteId],
    queryFn: () => employeesService.getAll(effectiveSiteId),
    enabled: !!employee,
  });

  // 2. Sites list for assignment
  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => sitesService.getAll(),
    enabled: !!employee,
  });

  // 3. Daily Attendance records for chosen date
  const { data: dailyAttendance = [], isLoading: isDailyAttendanceLoading } = useQuery({
    queryKey: ["daily-attendance", selectedAttendanceDate, effectiveSiteId],
    queryFn: () => staffService.getDailyAttendance(selectedAttendanceDate, effectiveSiteId),
    enabled: !!employee && activeTab === "attendance",
  });

  // 4. Monthly Attendance records for payroll calculation
  const { data: monthlyAttendance = [], isLoading: isMonthlyAttendanceLoading } = useQuery({
    queryKey: ["monthly-attendance", selectedPayrollMonth],
    queryFn: () => staffService.getAttendanceByMonth(selectedPayrollMonth),
    enabled: !!employee,
  });

  // 5. Staff Transactions & Ledger
  const { data: staffTransactions = [], isLoading: isTransactionsLoading } = useQuery({
    queryKey: ["staff-transactions", selectedPayrollMonth],
    queryFn: () => staffService.getTransactions(),
    enabled: !!employee,
  });

  // ─── MUTATIONS ───────────────────────────────────────────

  // Employee Create / Update
  const employeeMutation = useMutation({
    mutationFn: async (data: typeof employeeFormData) => {
      const payload = {
        name: data.name,
        mobile: data.mobile,
        email: data.email || undefined,
        role: data.role,
        shift: data.shift || undefined,
        site_id: data.site_id || effectiveSiteId || employee!.site_id,
        pin: data.pin || undefined,
        base_salary: (data.base_salary_rs || 0) * 100, // to paise
        salary_type: data.salary_type,
        designation: data.designation || undefined,
        joining_date: data.joining_date || undefined,
      };

      if (editEmployeeId) {
        await employeesService.update(editEmployeeId, payload);
      } else {
        await employeesService.create(payload.site_id, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      setShowEmployeeModal(false);
      setEditEmployeeId(null);
    },
    onError: (err: any) => {
      alert(err.message || "Failed to save employee");
    },
  });

  // Toggle Employee Active Status
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      employeesService.toggleActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  // Mark Daily Attendance Batch
  const attendanceMutation = useMutation({
    mutationFn: async (
      records: {
        site_id: string;
        employee_id: string;
        date: string;
        status: StaffAttendanceStatus;
        notes?: string | null;
      }[]
    ) => {
      await staffService.markAttendanceBatch(records, employee?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-attendance"] });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to record attendance");
    },
  });

  // Record Advance
  const recordAdvanceMutation = useMutation({
    mutationFn: async (data: typeof advanceFormData) => {
      await staffService.recordAdvance(
        {
          employee_id: data.employee_id,
          amount: data.amount_rs * 100, // paise
          payment_date: data.payment_date,
          payment_method: data.payment_method,
          month: data.month,
          notes: data.notes || undefined,
          transaction_ref: data.transaction_ref || undefined,
        },
        employee?.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["staff-transactions"] });
      setShowAdvanceModal(false);
      alert("Advance payment recorded successfully!");
    },
    onError: (err: any) => {
      alert(err.message || "Failed to record advance");
    },
  });

  // Record Salary Payout
  const recordSalaryMutation = useMutation({
    mutationFn: async (data: typeof salaryPayFormData) => {
      await staffService.recordSalaryPayment(
        {
          employee_id: data.employee_id,
          amount: data.amount_rs * 100, // paise
          payment_date: data.payment_date,
          payment_method: data.payment_method,
          month: data.month,
          notes: data.notes || undefined,
          transaction_ref: data.transaction_ref || undefined,
        },
        employee?.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["staff-transactions"] });
      setShowSalaryPayModal(false);
      alert("Salary payout recorded successfully!");
    },
    onError: (err: any) => {
      alert(err.message || "Failed to record salary payout");
    },
  });

  // Delete Transaction
  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => staffService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["staff-transactions"] });
    },
  });

  // ─── COMPUTED TOTALS & METRICS ───────────────────────────

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  const totalMonthlyPayrollBudget = useMemo(() => {
    return activeEmployees.reduce((sum, e) => sum + (e.base_salary || 0), 0);
  }, [activeEmployees]);

  const totalActiveAdvances = useMemo(() => {
    return activeEmployees.reduce((sum, e) => sum + (e.salary_advance || 0), 0);
  }, [activeEmployees]);

  // Today's attendance summary count
  const todayAttendanceCount = useMemo(() => {
    const todayStr = getTodayDateString();
    const recordsForToday = monthlyAttendance.filter((a) => a.date === todayStr);
    const present = recordsForToday.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
    return { present, total: activeEmployees.length };
  }, [monthlyAttendance, activeEmployees]);

  // Payroll summary table per employee for selected payroll month
  const monthlyPayrollSummaries = useMemo(() => {
    return activeEmployees.map((emp) => {
      return staffService.calculateMonthlyPayroll(
        emp,
        selectedPayrollMonth,
        monthlyAttendance,
        staffTransactions
      );
    });
  }, [activeEmployees, selectedPayrollMonth, monthlyAttendance, staffTransactions]);

  // Filtered employees for directory
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.mobile.includes(searchQuery) ||
        (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [employees, searchQuery, selectedRoleFilter]);

  // Handlers
  const handleOpenAddEmployee = () => {
    setEditEmployeeId(null);
    setEmployeeFormData({
      name: "",
      mobile: "",
      email: "",
      role: "OPERATOR",
      shift: "",
      site_id: effectiveSiteId || employee?.site_id || "",
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      base_salary_rs: 15000,
      salary_type: "MONTHLY",
      designation: "Parking Attendant",
      joining_date: getTodayDateString(),
    });
    setShowEmployeeModal(true);
  };

  const handleOpenEditEmployee = (emp: Employee) => {
    setEditEmployeeId(emp.id);
    setEmployeeFormData({
      name: emp.name,
      mobile: emp.mobile,
      email: emp.email || "",
      role: emp.role,
      shift: emp.shift || "",
      site_id: emp.site_id || effectiveSiteId || "",
      pin: emp.pin || "1234",
      base_salary_rs: (emp.base_salary || 0) / 100,
      salary_type: emp.salary_type || "MONTHLY",
      designation: emp.designation || "Parking Attendant",
      joining_date: emp.joining_date || getTodayDateString(),
    });
    setShowEmployeeModal(true);
  };

  const handleOpenGiveAdvance = (emp?: Employee) => {
    const targetEmp = emp || activeEmployees[0];
    setAdvanceFormData({
      employee_id: targetEmp ? targetEmp.id : "",
      amount_rs: 2000,
      payment_date: getTodayDateString(),
      payment_method: "CASH",
      month: selectedPayrollMonth,
      notes: `Advance for ${targetEmp?.name || "Staff"}`,
      transaction_ref: "",
    });
    setShowAdvanceModal(true);
  };

  const handleOpenPaySalary = (emp?: Employee) => {
    const targetEmp = emp || activeEmployees[0];
    const summary = monthlyPayrollSummaries.find((s) => s.employee_id === targetEmp?.id);
    const suggestedAmount = summary ? Math.round(summary.net_remaining_salary_due / 100) : 0;

    setSalaryPayFormData({
      employee_id: targetEmp ? targetEmp.id : "",
      amount_rs: suggestedAmount > 0 ? suggestedAmount : (targetEmp?.base_salary || 0) / 100,
      payment_date: getTodayDateString(),
      payment_method: "CASH",
      month: selectedPayrollMonth,
      notes: `Salary payout for ${selectedPayrollMonth}`,
      transaction_ref: "",
    });
    setShowSalaryPayModal(true);
  };

  const handleQuickMarkAttendance = (empId: string, status: StaffAttendanceStatus) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    attendanceMutation.mutate([
      {
        site_id: emp.site_id || effectiveSiteId || employee!.site_id,
        employee_id: emp.id,
        date: selectedAttendanceDate,
        status: status,
      },
    ]);
  };

  const handleMarkAllPresent = () => {
    const records = activeEmployees.map((emp) => ({
      site_id: emp.site_id || effectiveSiteId || employee!.site_id,
      employee_id: emp.id,
      date: selectedAttendanceDate,
      status: "PRESENT" as StaffAttendanceStatus,
    }));
    attendanceMutation.mutate(records);
  };

  return (
    <div className="p-4 md:p-6 pb-36 max-w-6xl mx-auto space-y-6 font-sans">
      {/* ────────── TOP HEADER WITH ACTIONS ────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rv" style={{ ["--i" as any]: 0 }}>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => router.push("/dashboard/")}
            className="w-10 h-10 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition-colors active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
                {t("employees.title")}
              </h1>
              <span className="pill px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold">
                PRO
              </span>
            </div>
            <p className="text-xs text-[var(--ink3)] flex items-center gap-1.5 mt-0.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>
                {currentSiteId === "ALL"
                  ? "All Organization Sites"
                  : currentSite?.name || "Main Site"}
              </span>
              <span>•</span>
              <span>{activeEmployees.length} {t("employees.activeStaff")}</span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenGiveAdvance()}
            className="pill px-4 py-2 bg-[var(--soft)] border border-[var(--line)] text-[var(--ink2)] hover:text-[var(--ink)] text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>{t("employees.recordAdvance")}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddEmployee}
            className="vx-btn accent !py-2.5 !px-4 text-xs font-bold shadow-lg shadow-[var(--accent)]/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>{t("employees.addStaffMember")}</span>
          </button>
        </div>
      </div>

      {/* ────────── 4 TOP METRIC CARDS ────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rv" style={{ ["--i" as any]: 1 }}>
        {/* Card 1: Active Staff */}
        <div className="vx-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--ink3)] uppercase tracking-wider">
              {t("employees.activeStaff")}
            </span>
            <div className="w-8 h-8 rounded-full bg-[var(--soft)] text-[var(--ink2)] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)]">
              {activeEmployees.length}
            </div>
            <p className="text-[11px] font-semibold text-[var(--ink3)] mt-0.5">
              {employees.length - activeEmployees.length} {t("common.none")}
            </p>
          </div>
        </div>

        {/* Card 2: Monthly Base Payroll */}
        <div className="vx-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--ink3)] uppercase tracking-wider">
              {t("employees.tabPayroll")}
            </span>
            <div className="w-8 h-8 rounded-full bg-[var(--green-soft)] text-[var(--green)] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)]">
              {formatINR(totalMonthlyPayrollBudget)}
            </div>
            <p className="text-[11px] font-semibold text-[var(--green)] mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {t("employees.grossSalary")}
            </p>
          </div>
        </div>

        {/* Card 3: Active Advances Outstanding */}
        <div className="vx-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--ink3)] uppercase tracking-wider">
              {t("employees.advanceBalance")}
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {formatINR(totalActiveAdvances)}
            </div>
            <p className="text-[11px] font-semibold text-[var(--ink3)] mt-0.5">
              {t("employees.deductions")}
            </p>
          </div>
        </div>

        {/* Card 4: Today Attendance */}
        <div className="vx-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[var(--ink3)] uppercase tracking-wider">
              {t("employees.presentToday")}
            </span>
            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)]">
              {todayAttendanceCount.present}/{todayAttendanceCount.total}
            </div>
            <p className="text-[11px] font-semibold text-[var(--accent)] mt-0.5">
              {todayAttendanceCount.total > 0
                ? `${Math.round((todayAttendanceCount.present / todayAttendanceCount.total) * 100)}% ${t("employees.presentToday")}`
                : t("common.noData")}
            </p>
          </div>
        </div>
      </div>

      {/* ────────── NAVIGATION TABS ────────── */}
      <div className="pill flex p-1.5 bg-[var(--soft)] gap-1 overflow-x-auto hide-scrollbar rv" style={{ ["--i" as any]: 2 }}>
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={cn(
            "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "directory"
              ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
              : "text-[var(--ink2)] hover:text-[var(--ink)]"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t("employees.tabDirectory")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          className={cn(
            "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "attendance"
              ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
              : "text-[var(--ink2)] hover:text-[var(--ink)]"
          )}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{t("employees.tabAttendance")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payroll")}
          className={cn(
            "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "payroll"
              ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
              : "text-[var(--ink2)] hover:text-[var(--ink)]"
          )}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{t("employees.tabPayroll")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={cn(
            "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "ledger"
              ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
              : "text-[var(--ink2)] hover:text-[var(--ink)]"
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t("employees.tabLedger")}</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: STAFF DIRECTORY                                     */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Search and Role Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("employees.searchPlaceholder")}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-card text-xs font-medium focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 shadow-sm"
              />
            </div>

            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="h-11 px-3.5 rounded-xl border border-input bg-card text-xs font-semibold text-foreground focus:outline-none focus:border-primary shadow-sm"
            >
              <option value="ALL">{t("employees.allRoles")}</option>
              {Object.entries(ROLE_CONFIG).map(([key]) => (
                <option key={key} value={key}>
                  {getRoleLabel(key as EmployeeRole, t)}
                </option>
              ))}
            </select>
          </div>

          {isEmployeesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border p-6">
              <div className="text-5xl mb-3">👥</div>
              <h3 className="text-base font-bold text-foreground mb-1">{t("employees.noStaffFound")}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                {searchQuery
                  ? t("employees.noStaffFound")
                  : t("employees.subtitle")}
              </p>
              <button
                type="button"
                onClick={handleOpenAddEmployee}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-95"
              >
                + {t("employees.addStaffMember")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredEmployees.map((emp) => {
                const shiftCfg = emp.shift ? SHIFT_CONFIG[emp.shift] : null;
                const advanceBal = emp.salary_advance || 0;
                const baseSalary = emp.base_salary || 0;

                return (
                  <div
                    key={emp.id}
                    className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between gap-4"
                  >
                    {/* Top Row: Avatar, Name, Designation & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shrink-0 shadow-sm",
                            emp.active
                              ? "bg-gradient-to-br from-primary to-orange-600"
                              : "bg-slate-500"
                          )}
                        >
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-foreground truncate">
                              {emp.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: emp.id, active: !emp.active })
                              }
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 transition-all",
                                emp.active
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-500/10 text-red-600 border border-red-500/20"
                              )}
                            >
                              {emp.active ? t("common.active") : t("employees.deactivate")}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                            {emp.designation || "Parking Attendant"} •{" "}
                            <span className="text-primary font-semibold">{getRoleLabel(emp.role, t)}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Salary & Advance Summary Pill */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                          {t("employees.baseSalary")} ({getSalaryTypeLabel(emp.salary_type || "MONTHLY", t)})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatINR(baseSalary)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                          {t("employees.advanceBalance")}
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            advanceBal > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {advanceBal > 0 ? formatINR(advanceBal) : "₹0 (Clear)"}
                        </span>
                      </div>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {emp.mobile}
                      </span>
                      {emp.shift && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-[10px]">
                          {getShiftLabel(emp.shift, t)}
                        </span>
                      )}
                      {emp.site_name && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                          📍 {emp.site_name}
                        </span>
                      )}
                      {emp.pin && (
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[10px]">
                          🔒 PIN: {emp.pin}
                        </span>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeForDrawer(emp)}
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        <span>{t("employees.staffDetails")}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenGiveAdvance(emp)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold transition-all"
                        >
                          + {t("employees.recordAdvance")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPaySalary(emp)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold transition-all"
                        >
                          {t("employees.paySalary")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditEmployee(emp)}
                          className="px-2.5 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 text-[11px] font-bold transition-all"
                        >
                          {t("common.edit")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: DAILY ATTENDANCE                                    */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          {/* Controls: Date Picker & Mark All Button */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {t("employees.attendanceFor")}
                </label>
                <input
                  type="date"
                  value={selectedAttendanceDate}
                  onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                  className="bg-transparent font-bold text-sm text-foreground focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={attendanceMutation.isPending}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("employees.markAllPresent")}</span>
              </button>
            </div>
          </div>

          {/* Attendance Roster Table */}
          {isDailyAttendanceLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : activeEmployees.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <p className="text-sm font-bold text-foreground">{t("employees.noStaffFound")}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeEmployees.map((emp) => {
                const currentRecord = dailyAttendance.find((a) => a.employee_id === emp.id);
                const currentStatus = currentRecord?.status;

                return (
                  <div
                    key={emp.id}
                    className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/30 transition-all"
                  >
                    {/* Employee Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted font-bold text-sm flex items-center justify-center text-foreground shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">{emp.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.designation || "Parking Staff"} • 📞 {emp.mobile}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                      {(["PRESENT", "HALF_DAY", "ABSENT", "PAID_LEAVE", "HOLIDAY"] as StaffAttendanceStatus[]).map(
                        (statusKey) => {
                          const cfg = ATTENDANCE_STATUS_CONFIG[statusKey];
                          const isSelected = currentStatus === statusKey;
                          return (
                            <button
                              key={statusKey}
                              type="button"
                              onClick={() => handleQuickMarkAttendance(emp.id, statusKey)}
                              disabled={attendanceMutation.isPending}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border",
                                isSelected
                                  ? `${cfg.badgeClass} ring-2 ring-primary shadow-sm font-black`
                                  : "border-border bg-background text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <span className="inline-block mr-1">{cfg.shortLabel}</span>
                              <span className="hidden sm:inline">{getAttendanceStatusLabel(statusKey, t)}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 3: SALARY & PAYROLL CALCULATIONS                      */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          {/* Month Selector Bar */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Select Payroll Month
                </label>
                <input
                  type="month"
                  value={selectedPayrollMonth}
                  onChange={(e) => setSelectedPayrollMonth(e.target.value)}
                  className="bg-transparent font-bold text-sm text-foreground focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                Total Month Due
              </span>
              <span className="text-lg font-black text-primary">
                {formatINR(
                  monthlyPayrollSummaries.reduce((sum, s) => sum + s.net_remaining_salary_due, 0)
                )}
              </span>
            </div>
          </div>

          {/* Payroll Breakdown Cards */}
          <div className="space-y-3">
            {monthlyPayrollSummaries.map((summary) => {
              const emp = employees.find((e) => e.id === summary.employee_id);
              const isFullyPaid = summary.net_remaining_salary_due <= 0 && summary.salary_paid_this_month > 0;

              return (
                <div
                  key={summary.employee_id}
                  className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-all flex flex-col gap-4"
                >
                  {/* Top: Staff Title & Action Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">
                          {summary.employee_name}
                        </h3>
                        {isFullyPaid && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            ✓ Fully Paid
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {summary.designation} • Base:{" "}
                        <strong className="text-foreground">{formatINR(summary.base_salary)}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenPaySalary(emp)}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:opacity-95 transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Pay Salary</span>
                    </button>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
                        Days Worked
                      </span>
                      <span className="font-bold text-foreground">
                        {summary.effective_worked_days} / {summary.total_month_days}d
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
                        Earned Gross
                      </span>
                      <span className="font-bold text-foreground">
                        {formatINR(summary.earned_salary)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
                        Salary Paid So Far
                      </span>
                      <span className="font-bold text-foreground">
                        {formatINR(summary.salary_paid_this_month)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
                        Net Remaining Due
                      </span>
                      <span
                        className={cn(
                          "font-black text-sm",
                          summary.net_remaining_salary_due > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatINR(summary.net_remaining_salary_due)}
                      </span>
                    </div>
                  </div>

                  {/* Footer info: Outstanding advance warning if present */}
                  {summary.active_advance_balance > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Outstanding Advance Balance: {formatINR(summary.active_advance_balance)}</span>
                      </span>
                      <span className="text-[10px] opacity-80">Can be adjusted from salary payout</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 4: ADVANCE & TRANSACTION HISTORY LEDGER               */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Complete Payment & Advance Ledger</h3>
            <span className="text-xs text-muted-foreground">{staffTransactions.length} records</span>
          </div>

          {isTransactionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : staffTransactions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <div className="text-4xl mb-2">💳</div>
              <h3 className="text-base font-bold text-foreground">No Transactions Recorded</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Advance payments and salary disbursements will be logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {staffTransactions.map((tx: any) => {
                const typeCfg = STAFF_TRANSACTION_CONFIG[tx.type as StaffTransactionType] || {
                  label: tx.type,
                  badgeClass: "bg-muted text-foreground",
                  isCredit: true,
                };

                return (
                  <div
                    key={tx.id}
                    className="bg-card border border-border/80 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                          tx.type === "ADVANCE_GIVEN"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : tx.type === "SALARY_PAYMENT"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-600"
                        )}
                      >
                        {tx.type === "ADVANCE_GIVEN" ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {tx.employee_name || "Employee"}
                          </h4>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                              typeCfg.badgeClass
                            )}
                          >
                            {typeCfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {formatDateIST(tx.payment_date)} • Mode: {tx.payment_method}{" "}
                          {tx.notes ? `• ${tx.notes}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-black text-sm text-foreground">
                        {formatINR(tx.amount)}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this transaction entry?")) {
                              deleteTransactionMutation.mutate(tx.id);
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT EMPLOYEE                                 */}
      {/* ────────────────────────────────────────────────────────── */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEmployeeModal(false)}
          />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editEmployeeId ? "Edit Staff Member" : "Add Staff Member"}
                </h2>
                <p className="text-xs text-muted-foreground">Manage profile, role, salary & PIN</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                employeeMutation.mutate(employeeFormData);
              }}
              className="p-6 overflow-y-auto space-y-4 pb-28"
            >
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={employeeFormData.name}
                  onChange={(e) =>
                    setEmployeeFormData({ ...employeeFormData, name: e.target.value })
                  }
                  placeholder="e.g. Ramesh Patil"
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={employeeFormData.mobile}
                    onChange={(e) =>
                      setEmployeeFormData({
                        ...employeeFormData,
                        mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    placeholder="10-digit mobile"
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-mono font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Designation</label>
                  <input
                    type="text"
                    value={employeeFormData.designation}
                    onChange={(e) =>
                      setEmployeeFormData({ ...employeeFormData, designation: e.target.value })
                    }
                    placeholder="e.g. Gate Supervisor"
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">{t("settings.role")} *</label>
                  <select
                    value={employeeFormData.role}
                    onChange={(e) =>
                      setEmployeeFormData({
                        ...employeeFormData,
                        role: e.target.value as EmployeeRole,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                  >
                    {Object.entries(ROLE_CONFIG).map(([key]) => (
                      <option key={key} value={key}>
                        {getRoleLabel(key as EmployeeRole, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">{t("settings.shift")}</label>
                  <select
                    value={employeeFormData.shift}
                    onChange={(e) =>
                      setEmployeeFormData({
                        ...employeeFormData,
                        shift: e.target.value as ShiftType | "",
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                  >
                    <option value="">{t("common.none")}</option>
                    {Object.entries(SHIFT_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>
                        {getShiftLabel(key as ShiftType, t)} ({val.start}-{val.end})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary Configuration */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  💰 {t("employees.baseSalary")}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1 font-medium">
                      {t("employees.baseSalary")} (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={employeeFormData.base_salary_rs === 0 ? "" : (employeeFormData.base_salary_rs ?? "")}
                      onChange={(e) =>
                        setEmployeeFormData({
                          ...employeeFormData,
                          base_salary_rs: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-bold focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1 font-medium">
                      {t("employees.salaryType")}
                    </label>
                    <select
                      value={employeeFormData.salary_type}
                      onChange={(e) =>
                        setEmployeeFormData({
                          ...employeeFormData,
                          salary_type: e.target.value as SalaryType,
                        })
                      }
                      className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                    >
                      {Object.entries(SALARY_TYPE_CONFIG).map(([key]) => (
                        <option key={key} value={key}>
                          {getSalaryTypeLabel(key as SalaryType, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Security PIN */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground block">
                    🔒 {t("employees.securityPin")}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEmployeeFormData((prev) => ({
                        ...prev,
                        pin: Math.floor(1000 + Math.random() * 9000).toString(),
                      }))
                    }
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Randomize
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={employeeFormData.pin}
                  onChange={(e) =>
                    setEmployeeFormData({
                      ...employeeFormData,
                      pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={employeeMutation.isPending}
                className="w-full h-12 rounded-2xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {employeeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editEmployeeId ? t("employees.editStaff") : t("employees.saveStaff")}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: GIVE ADVANCE                                        */}
      {/* ────────────────────────────────────────────────────────── */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAdvanceModal(false)}
          />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-md shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Salary Advance</h3>
                <p className="text-xs text-muted-foreground">Disburse advance funds to staff</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordAdvanceMutation.mutate(advanceFormData);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Select Staff *</label>
                <select
                  required
                  value={advanceFormData.employee_id}
                  onChange={(e) =>
                    setAdvanceFormData({ ...advanceFormData, employee_id: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                >
                  <option value="">Select an employee</option>
                  {activeEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation || e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Advance Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={advanceFormData.amount_rs === 0 ? "" : (advanceFormData.amount_rs ?? "")}
                    onChange={(e) =>
                      setAdvanceFormData({ ...advanceFormData, amount_rs: e.target.value === "" ? 0 : Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={advanceFormData.payment_method}
                    onChange={(e) =>
                      setAdvanceFormData({
                        ...advanceFormData,
                        payment_method: e.target.value as TransactionPaymentMethod,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 UPI</option>
                    <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                    <option value="CHEQUE">📑 Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Notes / Reason</label>
                <input
                  type="text"
                  value={advanceFormData.notes}
                  onChange={(e) =>
                    setAdvanceFormData({ ...advanceFormData, notes: e.target.value })
                  }
                  placeholder="e.g. Festival advance, Medical emergency"
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={recordAdvanceMutation.isPending || !advanceFormData.employee_id}
                className="w-full h-12 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {recordAdvanceMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Disburse Advance</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: PAY SALARY                                          */}
      {/* ────────────────────────────────────────────────────────── */}
      {showSalaryPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSalaryPayModal(false)}
          />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-md shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Salary Payout</h3>
                <p className="text-xs text-muted-foreground">Disburse monthly wages to staff</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSalaryPayModal(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordSalaryMutation.mutate(salaryPayFormData);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Select Staff *</label>
                <select
                  required
                  value={salaryPayFormData.employee_id}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const summary = monthlyPayrollSummaries.find((s) => s.employee_id === empId);
                    const suggested = summary ? Math.round(summary.net_remaining_salary_due / 100) : 0;
                    setSalaryPayFormData({
                      ...salaryPayFormData,
                      employee_id: empId,
                      amount_rs: suggested,
                    });
                  }}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                >
                  <option value="">Select an employee</option>
                  {activeEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation || e.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Payout Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={salaryPayFormData.amount_rs === 0 ? "" : (salaryPayFormData.amount_rs ?? "")}
                    onChange={(e) =>
                      setSalaryPayFormData({
                        ...salaryPayFormData,
                        amount_rs: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Salary Month
                  </label>
                  <input
                    type="month"
                    value={salaryPayFormData.month}
                    onChange={(e) =>
                      setSalaryPayFormData({ ...salaryPayFormData, month: e.target.value })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Payment Method</label>
                <select
                  value={salaryPayFormData.payment_method}
                  onChange={(e) =>
                    setSalaryPayFormData({
                      ...salaryPayFormData,
                      payment_method: e.target.value as TransactionPaymentMethod,
                    })
                  }
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="BANK_TRANSFER">🏦 Bank Transfer / NEFT</option>
                  <option value="CHEQUE">📑 Cheque</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Transaction Ref / Notes</label>
                <input
                  type="text"
                  value={salaryPayFormData.notes}
                  onChange={(e) =>
                    setSalaryPayFormData({ ...salaryPayFormData, notes: e.target.value })
                  }
                  placeholder="e.g. UTR number or cash receipt note"
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={recordSalaryMutation.isPending || !salaryPayFormData.employee_id}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {recordSalaryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Disburse Salary Payout</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* DRAWER: STAFF PROFILE & MONTHLY ATTENDANCE CALENDAR        */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedEmployeeForDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedEmployeeForDrawer(null)}
          />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedEmployeeForDrawer.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedEmployeeForDrawer.designation || "Staff"} • 📞 {selectedEmployeeForDrawer.mobile}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployeeForDrawer(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Financial Snapshot Card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Base Salary
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {formatINR(selectedEmployeeForDrawer.base_salary || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                    Active Advance
                  </span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {formatINR(selectedEmployeeForDrawer.salary_advance || 0)}
                  </span>
                </div>
              </div>

              {/* Attendance Log for this Month */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Attendance Records ({selectedPayrollMonth})
                </h4>
                <div className="grid grid-cols-7 gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border text-center">
                  {Array.from({ length: 31 }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `${selectedPayrollMonth}-${String(dayNum).padStart(2, "0")}`;
                    const rec = monthlyAttendance.find(
                      (a) => a.employee_id === selectedEmployeeForDrawer.id && a.date === dateStr
                    );
                    const status = rec?.status;
                    const cfg = status ? ATTENDANCE_STATUS_CONFIG[status] : null;

                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          "p-1.5 rounded-xl border flex flex-col items-center justify-center text-[10px]",
                          cfg ? cfg.badgeClass : "border-border/40 bg-background text-muted-foreground opacity-40"
                        )}
                      >
                        <span className="font-bold">{dayNum}</span>
                        <span className="text-[9px] font-black">{cfg?.shortLabel || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Staff Transactions */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Recent Disbursements & Advances
                </h4>
                <div className="space-y-2">
                  {staffTransactions
                    .filter((tx) => tx.employee_id === selectedEmployeeForDrawer.id)
                    .slice(0, 5)
                    .map((tx: any) => (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl border border-border bg-card flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-foreground block">
                            {STAFF_TRANSACTION_CONFIG[tx.type as StaffTransactionType]?.label || tx.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateIST(tx.payment_date)} • {tx.payment_method}
                          </span>
                        </div>
                        <span className="font-black text-foreground">{formatINR(tx.amount)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
