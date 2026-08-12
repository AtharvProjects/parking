"use client";

import React from "react";
import { useSite } from "@/providers/site-provider";
import { useAuth } from "@/providers/auth-provider";
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
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
        
        {/* Header */}
        <div className="p-5 pb-3 border-b border-border/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Select Parking Site</h2>
              <p className="text-xs text-muted-foreground">Switch active site context instantly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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
                  ? "bg-primary/10 border-primary text-primary shadow-sm"
                  : "bg-muted/40 border-border hover:bg-muted text-foreground"
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                  currentSiteId === "ALL" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                )}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">All Sites Combined</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      Enterprise
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aggregated overview across all company parking sites
                  </p>
                </div>
              </div>
              {currentSiteId === "ALL" && (
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
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
                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                    : "bg-muted/40 border-border hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                    isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {site.name}
                      </span>
                      {isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold border border-border">
                          Assigned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {site.city || "Location"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-muted-foreground" />
                        {site.total_slots} Slots
                      </span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}

          {authorizedSites.length === 0 && !isAdmin && (
            <div className="text-center py-8 text-xs text-muted-foreground font-medium">
              No authorized parking sites found for your account.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
