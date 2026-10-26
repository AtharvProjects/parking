"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { sitesService } from "@/services/sites.service";
import { ratesService } from "@/services/rates.service";
import { employeesService } from "@/services/employees.service";
import { useTheme } from "@/providers/theme-provider";
import { hasPermission } from "@/lib/constants";
import { ROLE_CONFIG, SHIFT_CONFIG } from "@/lib/constants";
import type { Site, Employee, EmployeeRole, ShiftType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Save, Loader2, Moon, Sun, Building, CreditCard, Car, X, Check, Plus,
  Users, MapPin, ChevronRight, Trash2, Phone, Mail, Shield, Edit2, ArrowLeft,
  Bell, Clock, Volume2, Vibrate, AlertTriangle, Sparkles, Send
} from "lucide-react";
import { useNotifications } from "@/providers/notification-provider";
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";
import { LANGUAGES } from "@/lib/i18n";

type SettingsTab = "general" | "sites" | "users" | "notifications";

export default function SettingsPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const isAdmin = hasPermission(employee?.role, 'SETTINGS');
  const { t } = useLanguage();

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "general", label: t("settings.general"), icon: <Building className="w-4 h-4" /> },
    { id: "notifications", label: t("settings.alerts"), icon: <Bell className="w-4 h-4" /> },
    { id: "sites", label: t("settings.sites"), icon: <MapPin className="w-4 h-4" />, adminOnly: true },
    { id: "users", label: t("settings.users"), icon: <Users className="w-4 h-4" />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-36 font-sans space-y-6">
      <div className="flex items-center gap-3.5 rv" style={{ ["--i" as any]: 0 }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard/")}
          className="w-10 h-10 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] transition-colors active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">{t("settings.title")}</h1>
          <p className="text-xs text-[var(--ink3)] mt-0.5">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Vertix Tab Bar */}
      <div className="pill flex p-1.5 bg-[var(--soft)] gap-1 overflow-x-auto hide-scrollbar rv" style={{ ["--i" as any]: 1 }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
                : "text-[var(--ink2)] hover:text-[var(--ink)]"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rv" style={{ ["--i" as any]: 2 }}>
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "sites" && isAdmin && <SitesTab />}
        {activeTab === "users" && isAdmin && <UsersTab />}
      </div>
    </div>
  );
}

// ─── GENERAL TAB ───────────────────────────────────────────
function GeneralTab() {
  const { employee } = useAuth();
  const { theme, toggle } = useTheme();
  const { language: currentLang, setLanguage, t } = useLanguage();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Site>>({});
  const [rates, setRates] = useState<Record<string, { hourly: number; daily: number }>>({});

  const { data: site, isLoading: isSiteLoading } = useQuery({
    queryKey: ["site", employee?.site_id],
    queryFn: () => sitesService.getById(employee!.site_id),
    enabled: !!employee,
  });

  const { data: activeRates, isLoading: isRatesLoading } = useQuery({
    queryKey: ["active-rates", employee?.site_id],
    queryFn: () => ratesService.getActive(employee!.site_id),
    enabled: !!employee,
  });

  React.useEffect(() => {
    if (site) setFormData(site);
    if (activeRates) {
      const ratesMap: Record<string, { hourly: number; daily: number }> = {};
      activeRates.forEach((r) => {
        ratesMap[r.vehicle_type] = { hourly: r.hourly_rate / 100, daily: r.daily_rate / 100 };
      });
      setRates(ratesMap);
    }
  }, [site, activeRates]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await sitesService.update(employee!.site_id, formData);
      if (activeRates) {
        for (const vType of ["TRAILOR", "BODY_VEHICLE", "EICHER"]) {
          const original = activeRates.find(r => r.vehicle_type === vType);
          const current = rates[vType];
          if (current) {
            const newHourlyPaise = current.hourly * 100;
            const newDailyPaise = current.daily * 100;
            if (!original || original.hourly_rate !== newHourlyPaise || original.daily_rate !== newDailyPaise) {
              await ratesService.create(employee!.site_id, {
                vehicle_type: vType as any,
                hourly_rate: newHourlyPaise,
                daily_rate: newDailyPaise,
                effective_from: new Date().toISOString()
              }, employee!.id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site"] });
      queryClient.invalidateQueries({ queryKey: ["active-rates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      alert(t("settings.saveSuccess"));
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? 0 : Number(value)) : value,
    }));
  };

  const handleRateChange = (vehicleType: string, field: "hourly" | "daily", value: string) => {
    setRates((prev: any) => ({
      ...prev,
      [vehicleType]: {
        ...prev[vehicleType],
        [field]: value === "" ? 0 : Number(value)
      }
    }));
  };

  if (isSiteLoading || isRatesLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" /></div>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-5">
      {/* App Theme */}
      <div className="vx-card p-5">
        <h2 className="text-sm font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <Moon className="w-4 h-4 text-[var(--accent)]" /> {t("settings.theme")}
        </h2>
        <div className="flex items-center justify-between p-4 bg-[var(--soft)] rounded-xl border border-[var(--line)]">
          <div>
            <p className="text-xs font-bold text-[var(--ink)]">{t("settings.darkMode")}</p>
            <p className="text-[11px] text-[var(--ink3)]">{t("settings.toggleThemeDesc")}</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            className={cn("vx-sw", theme === "dark" && "on")}
            aria-label="Toggle dark mode"
          />
        </div>
      </div>

      {/* Language Selector */}
      <div className="vx-card p-5">
        <h2 className="text-sm font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <span className="text-base">🌐</span> {t("settings.language")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all active:scale-95",
                currentLang === lang.code
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-bold shadow-sm"
                  : "border-[var(--line)] bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink)]"
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-xs font-bold">{lang.nativeLabel}</span>
              {currentLang === lang.code && (
                <Check className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Business Info */}
      <div className="vx-card p-5">
        <h2 className="text-sm font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-[var(--accent)]" /> {t("settings.siteDetails")}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.siteName")}</label>
            <input type="text" name="name" value={formData.name || ""} onChange={handleChange} className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.contactNumber")}</label>
              <input type="text" name="contact_number" value={formData.contact_number || ""} onChange={handleChange} placeholder="+91 9999999999" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.brandName")}</label>
              <input type="text" name="brand_name" value={formData.brand_name || ""} onChange={handleChange} className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.city")}</label>
              <input type="text" name="city" value={formData.city || ""} onChange={handleChange} className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.totalSlots")}</label>
              <input type="number" name="total_slots" value={formData.total_slots === 0 ? "" : (formData.total_slots ?? "")} onChange={handleChange} placeholder="0" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Billing Rules */}
      <div className="vx-card p-5">
        <h2 className="text-sm font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--accent)]" /> {t("settings.billingRules")}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.gracePeriod")}</label>
              <input type="number" name="grace_period_minutes" value={formData.grace_period_minutes === 0 ? "" : (formData.grace_period_minutes ?? "")} onChange={handleChange} placeholder="0" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.roundingInterval")}</label>
              <input type="number" name="rounding_interval_min" value={formData.rounding_interval_min === 0 ? "" : (formData.rounding_interval_min ?? "")} onChange={handleChange} placeholder="0" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.dailySwitchover")}</label>
              <input type="number" name="day_rate_switchover_hrs" value={formData.day_rate_switchover_hrs === 0 ? "" : (formData.day_rate_switchover_hrs ?? "")} onChange={handleChange} placeholder="0" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t("settings.overstayAlert")}</label>
              <input type="number" name="overstay_alert_hrs" value={formData.overstay_alert_hrs === 0 ? "" : (formData.overstay_alert_hrs ?? "")} onChange={handleChange} placeholder="0" className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Parking Rates */}
      <div className="vx-card p-5">
        <h2 className="text-sm font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <Car className="w-4 h-4 text-[var(--accent)]" /> {t("settings.parkingRates")} (₹)
        </h2>
        <div className="space-y-3">
          {["TRAILOR", "BODY_VEHICLE", "EICHER"].map((vType) => (
            <div key={vType} className="grid grid-cols-3 gap-3 items-end bg-[var(--soft)] p-3.5 rounded-2xl border border-[var(--line)]">
              <div>
                <label className="text-xs font-bold text-[var(--ink)] block mb-1">{vType.replace('_', ' ')}</label>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--ink3)] block mb-1">{t("settings.hourlyRate")}</label>
                <input 
                  type="number" 
                  value={rates[vType]?.hourly === 0 ? "" : (rates[vType]?.hourly ?? "")} 
                  onChange={(e) => handleRateChange(vType, "hourly", e.target.value)} 
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[var(--ink3)] block mb-1">{t("settings.daily24h")}</label>
                <input 
                  type="number" 
                  value={rates[vType]?.daily === 0 ? "" : (rates[vType]?.daily ?? "")} 
                  onChange={(e) => handleRateChange(vType, "daily", e.target.value)} 
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="w-full vx-btn accent !py-3.5 !rounded-2xl text-sm font-bold shadow-lg shadow-[var(--accent)]/20"
      >
        {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> {t("settings.saveChanges")}</>}
      </button>
    </form>
  );
}

// ─── SITES TAB ─────────────────────────────────────────────
function SitesTab() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useBackHandler(showForm, () => setShowForm(false), 20);

  const [formData, setFormData] = useState({
    name: "", brand_name: "", address: "", city: "", state: "Maharashtra",
    total_slots: 100, grace_period_minutes: 15, rounding_interval_min: 30,
    day_rate_switchover_hrs: 12, overstay_alert_hrs: 24, daily_revenue_target: 10000,
    contact_number: ""
  });

  const { data: sites, isLoading } = useQuery({
    queryKey: ["all-sites"],
    queryFn: () => sitesService.getAll(),
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        await sitesService.update(editId, formData);
      } else {
        await sitesService.create(formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-sites"] });
      queryClient.invalidateQueries({ queryKey: ["site"] });
      setShowForm(false);
      setEditId(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (siteId: string) => sitesService.delete(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-sites"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "", brand_name: "", address: "", city: "", state: "Maharashtra",
      total_slots: 100, grace_period_minutes: 15, rounding_interval_min: 30,
      day_rate_switchover_hrs: 12, overstay_alert_hrs: 24, daily_revenue_target: 10000,
      contact_number: ""
    });
  };

  const handleEdit = (site: Site) => {
    setFormData({
      name: site.name, brand_name: site.brand_name || "", address: site.address || "",
      city: site.city || "", state: site.state || "Maharashtra",
      total_slots: site.total_slots || 100, grace_period_minutes: site.grace_period_minutes || 15,
      rounding_interval_min: site.rounding_interval_min || 30,
      day_rate_switchover_hrs: site.day_rate_switchover_hrs || 12,
      overstay_alert_hrs: site.overstay_alert_hrs || 24,
      daily_revenue_target: site.daily_revenue_target || 10000,
      contact_number: (site as any).contact_number || ""
    });
    setEditId(site.id);
    setShowForm(true);
  };

  const handleDelete = (site: Site) => {
    if (confirm(`Are you sure you want to delete "${site.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(site.id);
    }
  };

  if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--ink)]">Parking Sites</h2>
          <p className="text-xs text-[var(--ink3)]">{(sites || []).length} sites configured</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); resetForm(); }}
          className="vx-btn accent !py-2.5 !px-4 text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Add Site
        </button>
      </div>

      {/* Sites List */}
      <div className="space-y-3">
        {(sites || []).map((site) => (
          <div key={site.id} className="vx-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">{site.name}</p>
                  <p className="text-xs text-[var(--ink3)]">{site.city || 'No city'} • {site.total_slots} slots</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleEdit(site)} className="w-8 h-8 rounded-full bg-[var(--soft)] hover:bg-[var(--soft2)] flex items-center justify-center text-[var(--ink2)] transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {(sites || []).length > 1 && (
                  <button onClick={() => handleDelete(site)} className="w-8 h-8 rounded-full bg-[var(--red-soft)] hover:opacity-80 flex items-center justify-center text-[var(--red)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {site.brand_name && <span className="pill px-2.5 py-0.5 bg-[var(--soft)] text-[10px] font-semibold text-[var(--ink2)]">{site.brand_name}</span>}
              <span className="pill px-2.5 py-0.5 bg-[var(--green-soft)] text-[var(--green)] text-[10px] font-semibold">Grace: {site.grace_period_minutes}m</span>
              <span className="pill px-2.5 py-0.5 bg-[var(--soft)] text-[var(--ink2)] text-[10px] font-semibold">Daily Switch: {site.day_rate_switchover_hrs}h</span>
            </div>
          </div>
        ))}
      </div>

      {/* Site Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative vx-card border border-[var(--line)] rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
              <h2 className="text-base text-[var(--ink)] font-bold">{editId ? "Edit" : "Add"} Site</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Site Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  placeholder="e.g. Main Gate, East Wing"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Brand Name</label>
                  <input type="text" value={formData.brand_name} onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                    placeholder="For receipts"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Contact Number</label>
                  <input type="tel" value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="Phone number"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street / Area"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">City</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Pune"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">State</label>
                  <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Maharashtra"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Total Slots</label>
                  <input
                    type="number"
                    value={formData.total_slots === 0 ? "" : (formData.total_slots ?? "")}
                    onChange={(e) => setFormData({ ...formData, total_slots: e.target.value === "" ? 0 : Number(e.target.value) })}
                    placeholder="0"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Grace Period (min)</label>
                  <input
                    type="number"
                    value={formData.grace_period_minutes === 0 ? "" : (formData.grace_period_minutes ?? "")}
                    onChange={(e) => setFormData({ ...formData, grace_period_minutes: e.target.value === "" ? 0 : Number(e.target.value) })}
                    placeholder="0"
                    className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
              {createMutation.isError && (
                <p className="text-[var(--red)] text-xs font-semibold">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || createMutation.isPending}
                className="w-full vx-btn accent !py-3.5 !rounded-2xl text-sm font-bold shadow-lg shadow-[var(--accent)]/20 mt-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{editId ? "Update" : "Create"} Site</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── USERS TAB ─────────────────────────────────────────────
function UsersTab() {
  const router = useRouter();
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useBackHandler(showForm, () => setShowForm(false), 20);

  const [formData, setFormData] = useState({
    name: "", mobile: "", email: "", role: "OPERATOR" as EmployeeRole,
    shift: "" as ShiftType | "", site_id: employee?.site_id || "", pin: "1234"
  });

  const { data: allEmployees, isLoading: isEmpLoading } = useQuery({
    queryKey: ["all-employees"],
    queryFn: () => employeesService.getAllByCompany(),
    enabled: !!employee,
  });

  const { data: sites } = useQuery({
    queryKey: ["all-sites"],
    queryFn: () => sitesService.getAll(),
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const input = {
        ...data,
        shift: (data.shift || undefined) as ShiftType | undefined,
        pin: data.pin || undefined
      };
      if (editId) {
        await employeesService.update(editId, input);
      } else {
        await employeesService.create(data.site_id, input);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setEditId(null);
      setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "", site_id: employee?.site_id || "", pin: "1234" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => employeesService.toggleActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const filtered = (allEmployees || []).filter(
    (e: any) => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.mobile.includes(searchQuery) || (e.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (emp: any) => {
    setFormData({
      name: emp.name, mobile: emp.mobile, email: emp.email || "",
      role: emp.role, shift: emp.shift || "", site_id: emp.site_id,
      pin: emp.pin || ""
    });
    setEditId(emp.id);
    setShowForm(true);
  };

  const generateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData((prev) => ({ ...prev, pin: randomPin }));
  };

  const handleDelete = (emp: any) => {
    if (emp.id === employee?.id) {
      alert("You cannot delete your own account!");
      return;
    }
    if (confirm(`Are you sure you want to remove "${emp.name}"?`)) {
      deleteMutation.mutate(emp.id);
    }
  };

  if (isEmpLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--ink)]">Team Members</h2>
          <p className="text-xs text-[var(--ink3)]">{(allEmployees || []).length} users across all sites</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/employees/")}
            className="pill px-3.5 py-2 bg-[var(--soft)] border border-[var(--line)] text-xs font-semibold text-[var(--ink2)] hover:text-[var(--ink)] flex items-center gap-1.5 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-[var(--accent)]" /> Staff Hub
          </button>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "", site_id: employee?.site_id || "", pin: "1234" }); }}
            className="vx-btn accent !py-2.5 !px-4 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Add User
          </button>
        </div>
      </div>

      {/* Staff Hub Promotion Banner */}
      <div className="vx-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--ink)]">Complete Staff, Salary & Attendance Hub</h4>
            <p className="text-[11px] text-[var(--ink3)] mt-0.5">
              Track daily attendance, disburse salary advances, and calculate net monthly payroll.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/employees/")}
          className="pill px-4 py-2 bg-[var(--btn)] text-[var(--on-ink)] text-xs font-semibold flex items-center gap-1 shrink-0"
        >
          <span>Open Hub</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="vx-sbox">
        <Users className="w-4 h-4 text-[var(--ink3)]" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, mobile, or email..."
          className="w-full text-xs"
        />
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {filtered.map((emp: any) => (
          <div key={emp.id} className="vx-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm", emp.active ? "bg-[var(--accent)]" : "bg-[var(--ink3)]")}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">{emp.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="pill px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold">{ROLE_CONFIG[emp.role as EmployeeRole]?.label || emp.role}</span>
                    {emp.site_name && <span className="pill px-2.5 py-0.5 bg-[var(--soft)] text-[var(--ink2)] text-[10px] font-semibold">{emp.site_name}</span>}
                    {emp.shift && <span className="pill px-2.5 py-0.5 bg-[var(--soft)] text-[var(--ink2)] text-[10px] font-semibold">{SHIFT_CONFIG[emp.shift as ShiftType]?.label}</span>}
                    {emp.pin ? (
                      <span className="pill px-2.5 py-0.5 bg-[var(--green-soft)] text-[var(--green)] text-[10px] font-mono font-semibold">
                        🔒 PIN: {emp.pin}
                      </span>
                    ) : (
                      <span className="pill px-2.5 py-0.5 bg-[var(--red-soft)] text-[var(--red)] text-[10px] font-semibold">
                        ⚠️ No PIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-1 text-[var(--ink3)] font-mono">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {emp.mobile}</span>
                    {emp.email && <span className="flex items-center gap-1 font-sans"><Mail className="w-3 h-3" /> {emp.email}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 justify-end border-t border-[var(--line)] pt-2.5">
              <button
                onClick={() => toggleMutation.mutate({ id: emp.id, active: !emp.active })}
                className={cn("pill px-3 py-1 text-xs font-semibold", emp.active ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--soft)] text-[var(--ink3)]")}
              >
                {emp.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => handleEdit(emp)} className="pill px-3 py-1 text-xs font-semibold bg-[var(--soft)] text-[var(--ink)] hover:bg-[var(--soft2)]">
                Edit
              </button>
              {emp.id !== employee?.id && (
                <button onClick={() => handleDelete(emp)} className="pill px-3 py-1 text-xs font-semibold bg-[var(--red-soft)] text-[var(--red)] hover:opacity-80">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !isEmpLoading && (
        <div className="text-center py-16 vx-card border border-[var(--line)]">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-sm font-bold text-[var(--ink)] mb-1">No Users Found</h3>
          <p className="text-xs text-[var(--ink3)]">Add your first team member</p>
        </div>
      )}

      {/* User Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative vx-card border border-[var(--line)] rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--line)] shrink-0">
              <h2 className="text-base text-[var(--ink)] font-bold">{editId ? "Edit" : "Add"} User</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  placeholder="e.g. Ramesh Patil"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Mobile Number *</label>
                <input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required
                  placeholder="10-digit mobile number"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Email (Optional for Operators)</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@parking.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Role *</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                    className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]">
                    {Object.entries(ROLE_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Assigned Site *</label>
                  <select value={formData.site_id} onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]">
                    {(sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">Shift Assignment</label>
                <select value={formData.shift} onChange={(e) => setFormData({ ...formData, shift: e.target.value as ShiftType | "" })}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]">
                  <option value="">No shift assigned</option>
                  {Object.entries(SHIFT_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label} ({val.start}-{val.end})</option>)}
                </select>
              </div>
              {/* Security PIN Configuration */}
              <div className="p-3.5 bg-[var(--soft)] rounded-2xl border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[var(--ink)] font-bold flex items-center gap-1.5">
                    <span>🔒 Quick Security PIN (4–6 Digits)</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-xs text-[var(--accent)] font-semibold hover:underline"
                  >
                    Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  placeholder="e.g. 1234"
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-mono text-base tracking-widest focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-[var(--ink3)]">
                  Attendants use this PIN for fast 1-second login on Android POS / mobile devices.
                </p>
              </div>

              {createMutation.isError && (
                <p className="text-[var(--red)] text-xs font-semibold">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || !formData.mobile || !formData.site_id || createMutation.isPending}
                className="w-full vx-btn accent !py-3.5 !rounded-2xl text-sm font-bold shadow-lg shadow-[var(--accent)]/20 mt-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{editId ? "Update" : "Add"} User</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIONS & ALERTS TAB ────────────────────────────
function NotificationsTab() {
  const { config, updateConfig, sendTestAlert, requestPermissions } = useNotifications();
  const [testSent, setTestSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleTestNotification = async () => {
    setIsSending(true);
    setTestSent(false);
    try {
      const success = await sendTestAlert();
      if (success) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
      } else {
        alert("Please enable notification permissions in your device settings.");
      }
    } catch {
      alert("Failed to send test alert. Please check permissions.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Master Toggle Card */}
      <div className="vx-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors",
              config.enabled ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--soft)] text-[var(--ink3)]"
            )}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--ink)]">Checkout & Overstay Alerts</h2>
              <p className="text-xs text-[var(--ink3)]">Receive push alerts for parked vehicles pending checkout</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className={cn("vx-sw", config.enabled && "on")}
            aria-label="Toggle alerts"
          />
        </div>
      </div>

      {/* Notification Triggers Card */}
      <div className="vx-card p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
          <Clock className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--ink)]">Elapsed Duration Triggers</h2>
        </div>

        <div className="space-y-2.5">
          {/* 1 Hour Alert */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">⏱️ 1-Hour Reminder</span>
              <p className="text-[11px] text-[var(--ink3)]">Alert when a vehicle has been parked for over 1 hour</p>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.after1Hour}
              onChange={(e) => updateConfig({ after1Hour: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* 2 Hours Alert */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">⏱️ 2-Hour Reminder</span>
              <p className="text-[11px] text-[var(--ink3)]">Alert when a vehicle has been parked for over 2 hours</p>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.after2Hours}
              onChange={(e) => updateConfig({ after2Hours: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* 4 Hours Alert */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">⏱️ 4-Hour Extended Reminder</span>
              <p className="text-[11px] text-[var(--ink3)]">Alert when parked duration reaches 4 hours</p>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.after4Hours}
              onChange={(e) => updateConfig({ after4Hours: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* 6 Hours Alert */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">⏱️ 6-Hour Extended Reminder</span>
              <p className="text-[11px] text-[var(--ink3)]">Alert when parked duration reaches 6 hours</p>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.after6Hours}
              onChange={(e) => updateConfig({ after6Hours: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Overstay Alert */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent)]/30">
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-xs font-bold text-[var(--accent)]">Site Overstay Threshold Alert</span>
              </div>
              <p className="text-[11px] text-[var(--accent)]/80">Urgent alert when parked duration exceeds site's max limit</p>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.overstayAlert}
              onChange={(e) => updateConfig({ overstayAlert: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Preferences & Sound Card */}
      <div className="vx-card p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--ink)]">Alert Delivery & Feedback</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Sound */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <p className="text-xs font-bold text-[var(--ink)]">Sound Chime</p>
                <p className="text-[10px] text-[var(--ink3)]">Play alert sound</p>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.soundEnabled}
              onChange={(e) => updateConfig({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Vibration */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
            <div className="flex items-center gap-2.5">
              <Vibrate className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <p className="text-xs font-bold text-[var(--ink)]">Vibration</p>
                <p className="text-[10px] text-[var(--ink3)]">Haptic feedback</p>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!config.enabled}
              checked={config.vibrationEnabled}
              onChange={(e) => updateConfig({ vibrationEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-[var(--accent)] accent-[var(--accent)] cursor-pointer disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Test Notification Action */}
      <div className="vx-card p-5 space-y-3 border border-[var(--accent)]/20">
        <div>
          <h3 className="text-xs font-bold text-[var(--ink)]">Test Local Notification</h3>
          <p className="text-[11px] text-[var(--ink3)]">Trigger an instant test notification to check sound, banner, and vibration on device</p>
        </div>

        <button
          type="button"
          disabled={isSending}
          onClick={handleTestNotification}
          className="w-full vx-btn accent !py-3 !rounded-2xl text-xs font-bold shadow-lg shadow-[var(--accent)]/20"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : testSent ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Test Notification Sent! Check Notification Tray</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Sample Parking Alert</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}



