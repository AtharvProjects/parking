"use client";

import React from "react";
import { useSite } from "@/providers/site-provider";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import { Building2, Check, X, MapPin, Car, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteSwitcherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { currentSiteId, authorizedSites, switchSite, isAdmin } = useSite();
  const { employee } = useAuth();
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleSelect = (siteId: string) => {
    switchSite(siteId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md vx-card border border-[var(--line)] rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
        
        {/* Header */}
        <div className="p-5 pb-3 border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">{t("modals.selectParkingSite")}</h2>
              <p className="text-xs text-[var(--ink3)]">{t("modals.switchSiteContext")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Site List */}
        <div className="p-4 space-y-2.5 overflow-y-auto pb-8">
          
          {/* Admin "All Sites" Option */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSelect("ALL")}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                currentSiteId === "ALL"
                  ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] shadow-sm"
                  : "bg-[var(--soft)] border-[var(--line)] hover:bg-[var(--soft2)] text-[var(--ink)]"
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0",
                  currentSiteId === "ALL" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--ink3)]"
                )}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{t("modals.allSitesCombined")}</span>
                    <span className="pill px-2.5 py-0.5 bg-[var(--accent)] text-white text-[10px] font-bold">
                      Enterprise
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink3)] mt-0.5">
                    Aggregated overview across all company parking sites
                  </p>
                </div>
              </div>
              {currentSiteId === "ALL" && (
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
              )}
            </button>
          )}

          {/* Individual Authorized Sites */}
          {authorizedSites.map((site) => {
            const isSelected = currentSiteId === site.id;
            const isDefault = employee?.site_id === site.id;

            return (
              <button
                key={site.id}
                type="button"
                onClick={() => handleSelect(site.id)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                  isSelected
                    ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] shadow-sm"
                    : "bg-[var(--soft)] border-[var(--line)] hover:bg-[var(--soft2)] text-[var(--ink)]"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0",
                    isSelected ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--ink3)]"
                  )}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                        {site.name}
                      </span>
                      {isDefault && (
                        <span className="pill px-2 py-0.5 bg-[var(--card)] text-[var(--ink3)] text-[10px] font-bold border border-[var(--line)]">
                          Assigned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--ink3)] mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[var(--ink3)]" />
                        {site.city || "Location"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-[var(--ink3)]" />
                        {site.total_slots} {t("dashboard.slots")}
                      </span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}

          {authorizedSites.length === 0 && !isAdmin && (
            <div className="text-center py-8 text-xs text-[var(--ink3)] font-medium">
              No authorized parking sites found for your account.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
