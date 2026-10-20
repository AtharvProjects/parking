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
import { useBackHandler } from "@/providers/back-button-provider";
import { useLanguage } from "@/providers/language-provider";

interface OperatorSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OperatorSwitchModal({ isOpen, onClose }: OperatorSwitchModalProps) {
  useBackHandler(isOpen, onClose, 20);
  const { employee, switchOperator, signOut } = useAuth();
  const { t } = useLanguage();
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
      setError(t.modals.errEnterMobile);
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      setError(t.modals.errEnterPin);
      return;
    }

    setIsLoading(true);
    try {
      const switchedEmp = await switchOperator({ identifier: mobile.trim(), pin: pin.trim() });
      setSuccessMessage(`${t.modals.switchSuccess} (${switchedEmp.name})`);
      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || t.login.errorInvalidCredentials);
      setIsLoading(false);
      setPin("");
    }
  };

  const handleLockBooth = async () => {
    await signOut();
    onClose();
    router.push("/login/");
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
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="relative w-full max-w-md vx-card border border-[var(--line)] p-6 shadow-2xl z-10 overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Current Active Operator Summary */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold text-base">
              {employee?.name?.charAt(0).toUpperCase() || "O"}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)]">{t.modals.currentlyActiveOperator}</p>
              <h3 className="text-base font-bold text-[var(--ink)] leading-tight">{employee?.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="pill px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold">
              {ROLE_CONFIG[employee?.role as EmployeeRole]?.label || employee?.role}
            </span>
            {employee?.shift && (
              <span className="pill px-2.5 py-0.5 bg-[var(--soft)] text-[var(--ink2)] text-[10px] font-semibold">
                {SHIFT_CONFIG[employee.shift as ShiftType]?.label || employee.shift}
              </span>
            )}
          </div>
        </div>

        <div className="h-[1px] bg-[var(--line)] mb-5" />

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-[var(--green-soft)] border border-[var(--green)]/30 text-[var(--green)] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-[var(--red-soft)] border border-[var(--red)]/30 text-[var(--red)] text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Incoming Operator Switch Form */}
        <form onSubmit={handleSwitch} className="space-y-4">
          <h4 className="text-xs font-bold text-[var(--ink)]">{t.modals.handoverToIncomingStaff}</h4>

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
                    "pill px-3 py-1.5 text-xs font-semibold shrink-0 border transition-all",
                    mobile === s.mobile
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                      : "bg-[var(--soft)] border-[var(--line)] text-[var(--ink2)] hover:bg-[var(--soft2)] hover:text-[var(--ink)]"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Mobile Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t.modals.incomingOperatorMobile}</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder={t.modals.incomingOperatorMobilePlaceholder}
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* PIN Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink3)] block mb-1.5">{t.modals.incomingOperatorPin}</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-[var(--line)] bg-[var(--soft)] text-[var(--ink)] font-mono text-sm tracking-widest focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleLockBooth}
              className="pill h-12 bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              {t.modals.lockBooth}
            </button>
            <button
              type="submit"
              disabled={isLoading || !mobile.trim() || pin.length < 4}
              className="vx-btn accent !h-12 !rounded-full text-xs font-bold disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t.modals.confirmSwitch}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
