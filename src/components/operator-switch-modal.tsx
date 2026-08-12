"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { ROLE_CONFIG, SHIFT_CONFIG } from "@/lib/constants";
import type { EmployeeRole, ShiftType } from "@/lib/database.types";
import {
  X,
  UserCheck,
  KeyRound,
  Phone,
  RefreshCw,
  AlertCircle,
  LogOut,
  ShieldAlert,
  CheckCircle2,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface OperatorSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OperatorSwitchModal({ isOpen, onClose }: OperatorSwitchModalProps) {
  const { employee, switchOperator, signOut } = useAuth();
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [quickStaff, setQuickStaff] = useState<Array<{ id: string; name: string; mobile: string; role: string; shift?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      setPin("");
      setSuccessMessage("");
      authService.getQuickSelectEmployees().then((staff) => {
        if (staff) setQuickStaff(staff.filter((s) => s.id !== employee?.id) as any);
      });
    }
  }, [isOpen, employee?.id]);

  const handleSwitch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!mobile.trim()) {
      setError("Please enter the incoming operator's mobile number.");
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      setError("Please enter the 4-digit security PIN.");
      return;
    }

    setIsLoading(true);
    try {
      const switchedEmp = await switchOperator({ identifier: mobile.trim(), pin: pin.trim() });
      setSuccessMessage(`Operator switched to ${switchedEmp.name}!`);
      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Invalid credentials for operator switch.");
      setIsLoading(false);
      setPin("");
    }
  };

  const handleLockBooth = async () => {
    await signOut();
    onClose();
    router.push("/login");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl z-10 overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Current Active Operator Summary */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              {employee?.name?.charAt(0).toUpperCase() || "O"}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Currently Active Operator</p>
              <h3 className="text-lg font-bold text-foreground leading-tight">{employee?.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {ROLE_CONFIG[employee?.role as EmployeeRole]?.label || employee?.role}
            </span>
            {employee?.shift && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                {SHIFT_CONFIG[employee.shift as ShiftType]?.label || employee.shift} Shift
              </span>
            )}
          </div>
        </div>

        <div className="h-[1px] bg-border mb-5" />

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Incoming Operator Switch Form */}
        <form onSubmit={handleSwitch} className="space-y-4">
          <h4 className="text-sm font-bold text-foreground">Handover / Switch to Incoming Staff</h4>

          {/* Quick Staff Select Chips */}
          {quickStaff.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {quickStaff.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setMobile(s.mobile);
                    setPin("");
                    setError("");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 border transition-all",
                    mobile === s.mobile
                      ? "bg-primary text-white border-primary"
                      : "bg-muted border-border text-foreground hover:bg-muted/80"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Mobile Input */}
          <div>
            <label className="text-caption block mb-1.5">Incoming Operator Mobile</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-input bg-background text-body font-mono text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* PIN Input */}
          <div>
            <label className="text-caption block mb-1.5">Incoming Operator Security PIN</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-input bg-background text-body font-mono text-sm tracking-widest focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleLockBooth}
              className="h-12 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Lock Booth
            </button>
            <button
              type="submit"
              disabled={isLoading || !mobile.trim() || pin.length < 4}
              className="h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Confirm Switch"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
