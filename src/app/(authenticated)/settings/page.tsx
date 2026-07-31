"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { sitesService } from "@/services/sites.service";
import { useTheme } from "@/providers/theme-provider";
import { formatINR } from "@/lib/formatters";
import type { Site } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Save, Loader2, Moon, Sun, Settings as SettingsIcon, Building, CreditCard, Bell, Car } from "lucide-react";

export default function SettingsPage() {
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

  // Initialize form when data loads
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
      // 1. Update Site Settings
      await sitesService.update(employee!.site_id, formData);
      
      // 2. Check and Update Rates if changed
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 pb-32">
      <div>
        <h1 className="text-heading-lg text-foreground">Settings</h1>
        <p className="text-caption">Manage your parking site configuration</p>
      </div>

      {/* App Theme */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-label text-foreground mb-4 flex items-center gap-2"><Moon className="w-4 h-4" /> App Theme</h2>
        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
          <div>
            <p className="text-body-sm font-medium">Dark Mode</p>
            <p className="text-caption">Toggle between light and dark appearance</p>
          </div>
          <button
            onClick={toggle}
            className="w-14 h-8 rounded-full bg-primary/20 relative transition-base flex items-center p-1"
          >
            <div className={cn("w-6 h-6 rounded-full bg-primary flex items-center justify-center transition-base text-white", theme === "dark" ? "translate-x-6" : "translate-x-0")}>
              {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-6">
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
    </div>
  );
}
