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
  Users, MapPin, ChevronRight, Trash2, Phone, Mail, Shield, Edit2, ArrowLeft
} from "lucide-react";

type SettingsTab = "general" | "sites" | "users";

export default function SettingsPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const isAdmin = hasPermission(employee?.role, 'SETTINGS');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "general", label: "General", icon: <Building className="w-4 h-4" /> },
    { id: "sites", label: "Sites", icon: <MapPin className="w-4 h-4" />, adminOnly: true },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" />, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto pb-36 font-sans">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-9 h-9 rounded-full bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-heading-lg text-foreground">Settings</h1>
          <p className="text-caption">Manage your parking configuration and preferences</p>
        </div>
      </div>


      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1 mb-6">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-label transition-all duration-200",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "general" && <GeneralTab />}
      {activeTab === "sites" && isAdmin && <SitesTab />}
      {activeTab === "users" && isAdmin && <UsersTab />}
    </div>
  );
}

// ─── GENERAL TAB ───────────────────────────────────────────
function GeneralTab() {
  const { employee } = useAuth();
  const { theme, toggle } = useTheme();
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
      alert("Settings and Rates saved successfully!");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleRateChange = (vehicleType: string, field: "hourly" | "daily", value: string) => {
    setRates((prev) => ({
      ...prev,
      [vehicleType]: {
        ...prev[vehicleType],
        [field]: Number(value) || 0
      }
    }));
  };

  if (isSiteLoading || isRatesLoading) return <div className="p-6 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-6">
      {/* App Theme */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-label text-foreground mb-4 flex items-center gap-2"><Moon className="w-4 h-4" /> App Theme</h2>
        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div>
            <p className="text-body-sm font-medium">Dark Mode</p>
            <p className="text-caption">Toggle between light and dark appearance</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="w-14 h-8 rounded-full bg-primary/20 relative transition-base flex items-center p-1"
          >
            <div className={cn("w-6 h-6 rounded-full bg-primary flex items-center justify-center transition-base text-white", theme === "dark" ? "translate-x-6" : "translate-x-0")}>
              {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </div>
          </button>
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-label text-foreground mb-4 flex items-center gap-2"><Building className="w-4 h-4" /> Business Info</h2>
        <div className="space-y-4">
          <div>
            <label className="text-caption block mb-1">Business Name</label>
            <input type="text" name="name" value={formData.name || ""} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1">Contact Number</label>
              <input type="text" name="contact_number" value={formData.contact_number || ""} onChange={handleChange} placeholder="+91 9999999999" className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-caption block mb-1">Brand Name (Receipts)</label>
              <input type="text" name="brand_name" value={formData.brand_name || ""} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1">City</label>
              <input type="text" name="city" value={formData.city || ""} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-caption block mb-1">Total Slots</label>
              <input type="number" name="total_slots" value={formData.total_slots || 0} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Billing Rules */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-label text-foreground mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Billing Rules</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1">Grace Period (mins)</label>
              <input type="number" name="grace_period_minutes" value={formData.grace_period_minutes || 0} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-caption block mb-1">Rounding Interval (mins)</label>
              <input type="number" name="rounding_interval_min" value={formData.rounding_interval_min || 0} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1">Daily Rate Switch (hrs)</label>
              <input type="number" name="day_rate_switchover_hrs" value={formData.day_rate_switchover_hrs || 0} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-caption block mb-1">Overstay Alert (hrs)</label>
              <input type="number" name="overstay_alert_hrs" value={formData.overstay_alert_hrs || 0} onChange={handleChange} className="w-full h-11 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Parking Rates */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-label text-foreground mb-4 flex items-center gap-2"><Car className="w-4 h-4" /> Parking Rates (₹)</h2>
        <div className="space-y-4">
          {["TRAILOR", "BODY_VEHICLE", "EICHER"].map((vType) => (
            <div key={vType} className="grid grid-cols-3 gap-4 items-end bg-muted/50 p-3 rounded-xl border border-border/50">
              <div>
                <label className="text-caption block mb-1 font-medium">{vType.replace('_', ' ')}</label>
              </div>
              <div>
                <label className="text-caption block mb-1 text-muted-foreground text-xs">Hourly Rate</label>
                <input 
                  type="number" 
                  value={rates[vType]?.hourly || 0} 
                  onChange={(e) => handleRateChange(vType, "hourly", e.target.value)} 
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" 
                />
              </div>
              <div>
                <label className="text-caption block mb-1 text-muted-foreground text-xs">Daily Rate (24h)</label>
                <input 
                  type="number" 
                  value={rates[vType]?.daily || 0} 
                  onChange={(e) => handleRateChange(vType, "daily", e.target.value)} 
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-body-sm focus:outline-none focus:border-primary" 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-base"
      >
        {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Settings</>}
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
          <h2 className="text-heading-md text-foreground">Parking Sites</h2>
          <p className="text-caption">{(sites || []).length} sites configured</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); resetForm(); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base"
        >
          <Plus className="w-4 h-4" /> Add Site
        </button>
      </div>

      {/* Sites List */}
      <div className="space-y-3">
        {(sites || []).map((site) => (
          <div key={site.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-label text-foreground">{site.name}</p>
                  <p className="text-caption">{site.city || 'No city'} • {site.total_slots} slots</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(site)} className="p-2 rounded-lg bg-muted hover:bg-border transition-base">
                  <Edit2 className="w-4 h-4 text-foreground" />
                </button>
                {(sites || []).length > 1 && (
                  <button onClick={() => handleDelete(site)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-base">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {site.brand_name && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">{site.brand_name}</span>}
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">Grace: {site.grace_period_minutes}min</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-semibold">Daily Switch: {site.day_rate_switchover_hrs}h</span>
            </div>
          </div>
        ))}
      </div>

      {/* Site Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-heading-md text-foreground font-bold">{editId ? "Edit" : "Add"} Site</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-label mb-1.5 block">Site Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  placeholder="e.g. Main Gate, East Wing"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">Brand Name</label>
                  <input type="text" value={formData.brand_name} onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                    placeholder="For receipts"
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-label mb-1.5 block">Contact Number</label>
                  <input type="tel" value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="Phone number"
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="text-label mb-1.5 block">Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street / Area"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">City</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Pune"
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-label mb-1.5 block">State</label>
                  <input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Maharashtra"
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">Total Slots</label>
                  <input type="number" value={formData.total_slots} onChange={(e) => setFormData({ ...formData, total_slots: Number(e.target.value) })}
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-label mb-1.5 block">Grace Period (min)</label>
                  <input type="number" value={formData.grace_period_minutes} onChange={(e) => setFormData({ ...formData, grace_period_minutes: Number(e.target.value) })}
                    className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              {createMutation.isError && (
                <p className="text-destructive text-body-sm font-semibold">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || createMutation.isPending}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 transition-base disabled:opacity-50 font-bold shadow-lg shadow-primary/25 mt-2">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />{editId ? "Update" : "Create"} Site</>}
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
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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
          <h2 className="text-heading-md text-foreground">Team Members</h2>
          <p className="text-caption">{(allEmployees || []).length} users across all sites</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "", site_id: employee?.site_id || "", pin: "1234" }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, mobile, or email..."
          className="w-full h-12 pl-4 pr-4 rounded-xl border border-input bg-card text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base"
        />
      </div>

      {/* Employee List */}
      <div className="space-y-3">
        {filtered.map((emp: any) => (
          <div key={emp.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base", emp.active ? "bg-primary" : "bg-muted-foreground")}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-label text-foreground font-bold">{emp.name}</p>
                  <div className="flex items-center gap-2 text-caption flex-wrap mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{ROLE_CONFIG[emp.role as EmployeeRole]?.label || emp.role}</span>
                    {emp.site_name && <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">{emp.site_name}</span>}
                    {emp.shift && <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">{SHIFT_CONFIG[emp.shift as ShiftType]?.label}</span>}
                    {emp.pin ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-semibold">
                        🔒 PIN: {emp.pin}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                        ⚠️ No PIN
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-caption mt-1 text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {emp.mobile}</span>
                    {emp.email && <span className="flex items-center gap-1 font-sans"><Mail className="w-3 h-3" /> {emp.email}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 justify-end border-t border-border/50 pt-2.5">
              <button
                onClick={() => toggleMutation.mutate({ id: emp.id, active: !emp.active })}
                className={cn("px-3 py-1.5 rounded-lg text-caption font-semibold transition-base", emp.active ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300")}
              >
                {emp.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => handleEdit(emp)} className="px-3 py-1.5 rounded-lg text-caption font-semibold bg-muted text-foreground hover:bg-border transition-base">
                Edit
              </button>
              {emp.id !== employee?.id && (
                <button onClick={() => handleDelete(emp)} className="px-3 py-1.5 rounded-lg text-caption font-semibold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 transition-base">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !isEmpLoading && (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-heading-md text-foreground mb-2">No Users Found</h3>
          <p className="text-body-sm text-muted-foreground">Add your first team member</p>
        </div>
      )}

      {/* User Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-heading-md text-foreground font-bold">{editId ? "Edit" : "Add"} User</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-label mb-1.5 block">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  placeholder="e.g. Ramesh Patil"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Mobile Number *</label>
                <input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required
                  placeholder="10-digit mobile number"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Email (Optional for Operators)</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@parking.com"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">Role *</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                    className="w-full h-12 px-3 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(ROLE_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-label mb-1.5 block">Assigned Site *</label>
                  <select value={formData.site_id} onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    className="w-full h-12 px-3 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {(sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-label mb-1.5 block">Shift Assignment</label>
                <select value={formData.shift} onChange={(e) => setFormData({ ...formData, shift: e.target.value as ShiftType | "" })}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No shift assigned</option>
                  {Object.entries(SHIFT_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label} ({val.start}-{val.end})</option>)}
                </select>
              </div>
              {/* Security PIN Configuration */}
              <div className="p-3.5 bg-muted/60 rounded-2xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label text-foreground font-bold flex items-center gap-1.5">
                    <span>🔒 Quick Security PIN (4–6 Digits)</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-xs text-primary font-semibold hover:underline"
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
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-caption text-muted-foreground">
                  Operators and gate attendants use this PIN for fast 1-second login on Android POS / mobile devices.
                </p>
              </div>

              {createMutation.isError && (
                <p className="text-destructive text-body-sm font-semibold">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || !formData.mobile || !formData.site_id || createMutation.isPending}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 transition-base disabled:opacity-50 font-bold shadow-lg shadow-primary/25 mt-2">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />{editId ? "Update" : "Add"} User</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


