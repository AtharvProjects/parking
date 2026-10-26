"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { useLanguage } from "@/providers/language-provider";
import { useTheme } from "@/providers/theme-provider";
import { LANGUAGES } from "@/lib/i18n";
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Check,
  WifiOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  X,
  Globe,
  Sun,
  Moon,
  Delete,
  Users,
  Crown,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuthTab = "pin" | "password";

const KEYPAD_BUTTONS = [
  { val: "1", sub: "" },
  { val: "2", sub: "A B C" },
  { val: "3", sub: "D E F" },
  { val: "4", sub: "G H I" },
  { val: "5", sub: "J K L" },
  { val: "6", sub: "M N O" },
  { val: "7", sub: "P Q R S" },
  { val: "8", sub: "T U V" },
  { val: "9", sub: "W X Y Z" },
  { val: "CLEAR", label: "C", sub: "" },
  { val: "0", sub: "+" },
  { val: "BACKSPACE", sub: "" },
];

export default function LoginPage() {
  const router = useRouter();
  const { status, employee, loginWithPassword, loginWithPin, resetPassword, isOffline } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggle } = useTheme();
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Live Terminal Clock
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Tab State: 'pin' (Fast Staff PIN) or 'password' (Admin/Manager)
  const [activeTab, setActiveTab] = useState<AuthTab>("pin");

  // PIN Form State
  const [mobileIdentifier, setMobileIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [quickStaff, setQuickStaff] = useState<Array<{ id: string; name: string; mobile: string; role: string; shift?: string; email?: string }>>([
    { id: "admin-quick", name: "Admin", mobile: "0000000000", role: "ADMIN", shift: "Facility Head", email: "admin@santwamanbhau.com" },
    { id: "demo-nana", name: "Nana", mobile: "8329284039", role: "OPERATOR", shift: "Gate Attendant" },
    { id: "demo-ramesh", name: "Ramesh kaka", mobile: "9970778069", role: "OPERATOR", shift: "Day Shift" },
    { id: "demo-krish", name: "Krish", mobile: "9970445686", role: "OPERATOR", shift: "Evening Shift" },
  ]);

  // Password Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  // Generic UI State
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // On login screen mount, clear any lingering operator session to guarantee clean choice
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("is_admin_logged_in");
      localStorage.removeItem("current_employee_id");
      localStorage.removeItem("current_employee_role");
    }
  }, []);

  // Load quick select staff for PIN login with robust active defaults
  useEffect(() => {
    async function loadStaff() {
      try {
        const staff = await authService.getQuickSelectEmployees();
        if (staff && staff.length > 0) {
          const hasAdmin = staff.some((s) => s.role === "ADMIN" || s.name.toLowerCase() === "admin");
          const combined = hasAdmin
            ? staff
            : [
                { id: "admin-quick", name: "Admin", mobile: "0000000000", role: "ADMIN", shift: "Facility Head", email: "admin@santwamanbhau.com" },
                ...staff,
              ];
          setQuickStaff(combined as any);
        }
      } catch (e) {
        console.warn("Could not load quick staff list:", e);
      }
    }
    loadStaff();
  }, []);

  const adminMember = quickStaff.find(
    (s) => s.role === "ADMIN" || s.name.toLowerCase() === "admin"
  ) || { id: "admin-quick", name: "Admin", mobile: "0000000000", role: "ADMIN", shift: "Facility Head", email: "admin@santwamanbhau.com" };

  const attendants = quickStaff.filter(
    (s) => s.role !== "ADMIN" && s.name.toLowerCase() !== "admin"
  );

  const selectedStaff = quickStaff.find(
    (s) => s.mobile === mobileIdentifier || s.name.toLowerCase() === mobileIdentifier.toLowerCase()
  );

  // 1-Tap Quick Admin Login helper
  const handleQuickAdminLogin = async () => {
    playKeyFeedback();
    setIsLoading(true);
    setError("");
    try {
      await loginWithPin({ identifier: "0000000000", pin: "1234" });
      router.push("/dashboard/");
    } catch (pinErr: any) {
      try {
        await loginWithPassword({ email: "admin@santwamanbhau.com", password: "Password@123" });
        router.push("/dashboard/");
      } catch (passErr: any) {
        setError(passErr.message || pinErr.message || "Failed to log in as admin");
        setShakeKey((k) => k + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill helper
  const handleSelectStaff = (member: { mobile: string; name: string }) => {
    setMobileIdentifier(member.mobile);
    setPin("");
    setError("");
    playKeyFeedback();
  };

  // Physical touch/audio feedback for POS keypad
  const playKeyFeedback = () => {
    try {
      if (typeof window !== "undefined") {
        if (window.navigator?.vibrate) {
          window.navigator.vibrate(12);
        }
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.035);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.035);
        }
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Handle Keypad Press for PIN
  const handleKeypadPress = (val: string) => {
    playKeyFeedback();
    setError("");
    if (val === "BACKSPACE") {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === "CLEAR") {
      setPin("");
    } else if (pin.length < 6) {
      const newPin = pin + val;
      setPin(newPin);
      if (mobileIdentifier.trim() && (newPin.length === 4 || newPin.length === 6)) {
        setTimeout(() => {
          submitPinAuth(mobileIdentifier, newPin);
        }, 150);
      }
    }
  };

  // Submit PIN Auth
  const submitPinAuth = async (ident = mobileIdentifier, pinCode = pin) => {
    setError("");
    if (!ident.trim()) {
      setError(t("login.errorMobile"));
      setShakeKey((k) => k + 1);
      return;
    }
    if (!pinCode || pinCode.length < 4) {
      setError(t("login.errorPin"));
      setShakeKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    try {
      const emp = await loginWithPin({ identifier: ident.trim(), pin: pinCode.trim() });
      if (emp.role === "OPERATOR" || emp.role === "GATE_ATTENDANT") {
        router.push("/gate/");
      } else {
        router.push("/dashboard/");
      }
    } catch (err: any) {
      setError(err.message || t("login.errorInvalidCredentials"));
      setShakeKey((k) => k + 1);
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Password Auth
  const submitPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(t("login.errorEmailPassword"));
      setShakeKey((k) => k + 1);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError(t("login.errorPasswordMismatch"));
      setShakeKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await authService.signUp(email, password);
        setError(t("login.accountCreated"));
        setIsSignUp(false);
      } else {
        await loginWithPassword({ email: email.trim(), password: password.trim() });
        router.push("/dashboard/");
      }
    } catch (err: any) {
      setError(err.message || t("login.errorAuthFailed"));
      setShakeKey((k) => k + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Forgot Password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your registered email address.");
      return;
    }

    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message || t("login.errorResetFailed"));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--page)] text-[var(--ink)] font-sans selection:bg-[#f25c27] selection:text-white">
      {/* Dynamic Ambient Background Layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-b from-[#f25c27]/12 via-[#f25c27]/4 to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 py-3.5 px-4 sm:px-6 md:px-8 flex items-center justify-between w-full max-w-6xl mx-auto shrink-0 select-none">
        {/* Brand Terminal Logo & Facility */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f25c27] to-[#e64a19] flex items-center justify-center text-white font-black text-xl shadow-md shadow-orange-500/25">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[var(--ink)] font-black text-base sm:text-lg tracking-tight leading-none">
                Vertix <span className="text-[#f25c27]">Parking</span>
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                Gate Terminal
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink3)] font-semibold mt-1">
              Sant Wamanbhau Parking · Smart Facility
            </p>
          </div>
        </div>

        {/* Right Status Controls: Live Clock, Sync Badge, Language, Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Live Clock (Hidden on very narrow screens) */}
          {currentTime && (
            <div className="hidden sm:flex flex-col items-end px-3 py-1 rounded-xl bg-[var(--card)] border border-[var(--line)] leading-none text-right shadow-xs">
              <span className="font-mono text-xs font-bold text-[var(--ink)]">{currentTime}</span>
              <span className="text-[9px] font-semibold text-[var(--ink3)] mt-0.5">{currentDate}</span>
            </div>
          )}

          {/* Sync / Offline Status Badge */}
          <div className="pill flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[var(--card)] border border-[var(--line)] text-xs font-bold shadow-xs">
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span className="text-amber-600 dark:text-amber-400 hidden xs:inline">{t("login.offlinePinAuth")}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400 hidden xs:inline">{t("common.livesync")}</span>
              </>
            )}
          </div>

          {/* Quick Language Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu((p) => !p)}
              className="pill flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[var(--card)] border border-[var(--line)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--soft)] shadow-xs transition-all active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-[#f25c27]" />
              <span>{LANGUAGES.find((l) => l.code === language)?.nativeLabel || "मराठी"}</span>
            </button>
            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-38 bg-[var(--card)] border border-[var(--line)] rounded-2xl shadow-2xl p-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLanguage(l.code);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors",
                        language === l.code
                          ? "bg-[var(--accent-soft)] text-[#f25c27] font-bold"
                          : "text-[var(--ink2)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span>{l.flag}</span>
                        <span>{l.nativeLabel}</span>
                      </span>
                      {language === l.code && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={(e) => toggle(e)}
            className="pill w-9 h-9 rounded-full flex items-center justify-center text-[var(--ink2)] hover:text-[var(--ink)] bg-[var(--card)] border border-[var(--line)] shadow-xs transition-transform active:scale-95"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </header>

      {/* Main App Layout: iPad Dual-Panel Grid / Mobile Optimized */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-5 flex flex-col justify-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* ─────── LEFT PANEL (MD:COLS-5): OPERATOR STATION & TEAM ─────── */}
          <div className="hidden md:flex md:col-span-5 flex-col justify-between p-6 lg:p-7 rounded-3xl bg-[var(--card)] border border-[var(--line)] shadow-lg relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              {/* Terminal ID & Shift Status */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Terminal Station 01 · Online
                </div>
                <h1 className="text-2xl lg:text-3xl font-black text-[var(--ink)] tracking-tight">
                  {t("login.title") || "Sant Wamanbhau Parking"}
                </h1>
                <p className="text-xs text-[var(--ink3)] font-medium mt-1">
                  {t("login.subtitle") || "Smart Facility & Gate Terminal"}
                </p>
              </div>

              {/* 👑 Dedicated Facility Administrator Quick Access Card */}
              <div className="rounded-2xl p-4 bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-orange-500/5 border-2 border-orange-500/35 dark:border-orange-500/25 shadow-md shadow-orange-500/10 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#f25c27]">
                    <Crown className="w-4 h-4 text-[#f25c27]" />
                    <span>{t("login.facilityAdmin") || "Facility Administrator"}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#f25c27] text-white shadow-xs">
                    Quick Access
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white flex items-center justify-center font-black text-xl shadow-md shadow-orange-500/30 shrink-0">
                    👑
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black text-[var(--ink)] truncate">Admin (Ashitosh)</p>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                    </div>
                    <p className="text-xs text-[var(--ink2)] font-mono font-semibold">Mobile: 0000000000 · PIN: 1234</p>
                    <p className="text-[11px] text-[var(--ink3)] truncate font-medium">admin@santwamanbhau.com</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-orange-500/20">
                  <button
                    type="button"
                    onClick={handleQuickAdminLogin}
                    disabled={isLoading}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#f25c27] to-[#e64a19] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/25 hover:brightness-105 active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>1-Tap Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectStaff(adminMember)}
                    className="py-2.5 px-3 rounded-xl bg-[var(--card)] hover:bg-[var(--soft)] text-[var(--ink)] font-bold text-xs border border-[var(--line)] flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#f25c27]" />
                    <span>Keypad PIN</span>
                  </button>
                </div>
              </div>

              {/* Attendants on Duty Selection Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[var(--ink2)] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#f25c27]" />
                    <span>{t("login.attendantsOnDuty") || "Attendants on Duty"}</span>
                  </label>
                  <span className="text-[10px] text-[var(--ink3)] font-semibold">Tap for PIN login</span>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto hide-scrollbar pr-0.5">
                  {attendants.map((member) => {
                    const isSelected = mobileIdentifier === member.mobile;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectStaff(member)}
                        className={cn(
                          "w-full p-2.5 sm:p-3 rounded-2xl border text-left flex items-center gap-3 transition-all active:scale-[0.98]",
                          isSelected
                            ? "bg-gradient-to-r from-orange-500/15 to-orange-500/5 border-[#f25c27] shadow-md shadow-orange-500/10"
                            : "bg-[var(--soft)] border-[var(--line)] hover:bg-[var(--soft2)] hover:border-slate-300 dark:hover:border-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-transform",
                          isSelected
                            ? "bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white shadow-md shadow-orange-500/30 scale-105"
                            : "bg-[var(--card)] text-[var(--ink)] border border-[var(--line)]"
                        )}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate">{member.name}</p>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--card)] text-[var(--ink3)] border border-[var(--line)]">
                              {member.shift || "Day Shift"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--ink3)] font-mono mt-0.5">{member.mobile}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#f25c27] text-white flex items-center justify-center text-xs font-black shadow-xs shrink-0">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Station Security & Cache Info */}
            <div className="pt-4 border-t border-[var(--line)] mt-4 relative z-10 flex items-center justify-between text-[11px] text-[var(--ink3)] font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Local SQLite Encrypted Cache
              </span>
              <span>v2.4 POS</span>
            </div>
          </div>

          {/* ─────── RIGHT PANEL (MD:COLS-7): PASSCODE KEYPAD & CONSOLE ─────── */}
          <div className="col-span-1 md:col-span-7 flex flex-col justify-center max-w-md mx-auto w-full">
            
            {/* Dual Mode Switcher Tabs */}
            <div className="pill p-1.5 bg-[var(--soft)] mb-4 flex border border-[var(--line)] shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("pin");
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  activeTab === "pin"
                    ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
                    : "text-[var(--ink3)] hover:text-[var(--ink)]"
                )}
              >
                <KeyRound className="w-4 h-4 text-[#f25c27]" />
                <span>{t("login.quickStaffPin")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("password");
                  setError("");
                }}
                className={cn(
                  "flex-1 py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200",
                  activeTab === "password"
                    ? "bg-[var(--btn)] text-[var(--on-ink)] shadow-md"
                    : "text-[var(--ink3)] hover:text-[var(--ink)]"
                )}
              >
                <ShieldCheck className="w-4 h-4 text-[#f25c27]" />
                <span>{t("login.adminManager")}</span>
              </button>
            </div>

            {/* Vertix Passcode Console Card */}
            <motion.div
              key={shakeKey}
              animate={{ x: shakeKey ? [-8, 8, -6, 6, -3, 3, 0] : 0 }}
              transition={{ duration: 0.4 }}
              className="vx-card p-5 sm:p-7 shadow-2xl rounded-3xl border border-[var(--line)] bg-[var(--card)]"
            >
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-destructive text-xs font-semibold leading-snug"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                    <button type="button" onClick={() => setError("")} className="p-0.5 hover:opacity-80">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ────────── PIN MODE CONSOLE ────────── */}
              {activeTab === "pin" && (
                <div className="space-y-4">
                  {/* On Mobile: Quick Horizontal Staff & Admin Chips */}
                  {quickStaff.length > 0 && (
                    <div className="md:hidden">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--ink3)]">
                          {t("login.quickStaffSelect")}
                        </label>
                        <span className="text-[10px] text-[#f25c27] font-bold">Admin & Staff</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {/* Admin 1-Tap Quick Chip */}
                        <button
                          type="button"
                          onClick={() => handleSelectStaff(adminMember)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 border transition-all shadow-xs",
                            mobileIdentifier === adminMember.mobile
                              ? "bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-[#f25c27] text-[#f25c27] ring-2 ring-[#f25c27]/30"
                              : "bg-orange-500/10 border-orange-500/30 text-[#f25c27] hover:bg-orange-500/15"
                          )}
                        >
                          <Crown className="w-3.5 h-3.5 text-[#f25c27]" />
                          <span>👑 Admin</span>
                        </button>

                        {/* Staff Attendant Chips */}
                        {attendants.map((member) => {
                          const isSelected = mobileIdentifier === member.mobile;
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => handleSelectStaff(member)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shrink-0 border transition-all",
                                isSelected
                                  ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[#f25c27] font-bold shadow-xs"
                                  : "bg-[var(--soft)] border-[var(--line)] text-[var(--ink2)]"
                              )}
                            >
                              <div className="w-5 h-5 rounded-full bg-[#f25c27] text-white flex items-center justify-center text-[10px] font-bold">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <span>{member.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Attendant or Mobile Number */}
                  {selectedStaff ? (
                    <div className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between",
                      selectedStaff.role === "ADMIN" || selectedStaff.name.toLowerCase() === "admin"
                        ? "bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border-orange-500/30 shadow-xs"
                        : "bg-[var(--soft)] border-[var(--line)]"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold text-xs shadow-xs",
                          selectedStaff.role === "ADMIN" || selectedStaff.name.toLowerCase() === "admin"
                            ? "bg-gradient-to-br from-amber-500 to-[#f25c27]"
                            : "bg-gradient-to-br from-[#f25c27] to-[#e64a19]"
                        )}>
                          {selectedStaff.role === "ADMIN" || selectedStaff.name.toLowerCase() === "admin" ? "👑" : selectedStaff.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[var(--ink)] leading-tight">{selectedStaff.name}</p>
                            {(selectedStaff.role === "ADMIN" || selectedStaff.name.toLowerCase() === "admin") && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f25c27] text-white">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--ink3)] font-mono">{selectedStaff.mobile}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(selectedStaff.role === "ADMIN" || selectedStaff.name.toLowerCase() === "admin") && (
                          <button
                            type="button"
                            onClick={handleQuickAdminLogin}
                            disabled={isLoading}
                            className="text-[10px] font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-[#f25c27] to-[#e64a19] shadow-xs active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Instant</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMobileIdentifier("");
                            setPin("");
                          }}
                          className="text-[10px] font-bold text-[var(--ink2)] hover:text-[var(--ink)] px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--line)] shadow-xs transition-colors"
                        >
                          {t("common.edit") || "Change"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1 block">
                        {t("login.registeredMobile")}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                        <input
                          type="tel"
                          value={mobileIdentifier}
                          onChange={(e) => setMobileIdentifier(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder={t("login.enterMobile")}
                          className="w-full h-11 pl-10 pr-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] font-mono text-sm tracking-wider focus:outline-none focus:border-[#f25c27] transition-all"
                        />
                        {mobileIdentifier && (
                          <button
                            type="button"
                            onClick={() => setMobileIdentifier("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink3)] hover:text-[var(--ink)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Masked PIN Chamber */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)]">
                        {t("login.securityPin")}
                      </label>
                      {pin.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPin("")}
                          className="text-[10px] text-[#f25c27] font-bold hover:underline"
                        >
                          {t("login.clearPin")}
                        </button>
                      )}
                    </div>

                    {/* PIN Indicator Dots */}
                    <div className="flex justify-center items-center gap-4 py-3 px-4 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
                      {[0, 1, 2, 3].map((idx) => {
                        const isFilled = pin.length > idx;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full transition-all duration-200 flex items-center justify-center",
                              isFilled
                                ? "bg-[#f25c27] scale-110 shadow-md shadow-orange-500/40 ring-4 ring-orange-500/20"
                                : "bg-[var(--card)] border-2 border-[var(--line)]"
                            )}
                          >
                            {isFilled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Native iOS/iPadOS POS Touch Keypad */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                    {KEYPAD_BUTTONS.map((btn) => {
                      if (btn.val === "CLEAR") {
                        return (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => handleKeypadPress("CLEAR")}
                            className="h-13 sm:h-14 rounded-2xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink3)] hover:text-[var(--ink)] text-sm font-black active:scale-95 transition-all border border-[var(--line)] flex items-center justify-center select-none shadow-xs"
                          >
                            C
                          </button>
                        );
                      }
                      if (btn.val === "BACKSPACE") {
                        return (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => handleKeypadPress("BACKSPACE")}
                            className="h-13 sm:h-14 rounded-2xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink2)] hover:text-[var(--ink)] active:scale-95 transition-all border border-[var(--line)] flex items-center justify-center select-none shadow-xs"
                          >
                            <Delete className="w-5 h-5" />
                          </button>
                        );
                      }
                      return (
                        <button
                          key={btn.val}
                          type="button"
                          onClick={() => handleKeypadPress(btn.val)}
                          className="h-13 sm:h-14 rounded-2xl bg-[var(--card)] hover:bg-[var(--soft)] active:bg-[#f25c27] active:text-white border border-[var(--line)] shadow-xs flex flex-col items-center justify-center transition-all active:scale-95 group select-none"
                        >
                          <span className="font-mono text-xl sm:text-2xl font-black text-[var(--ink)] group-active:text-white leading-none">
                            {btn.val}
                          </span>
                          {btn.sub && (
                            <span className="text-[8px] sm:text-[9px] font-bold text-[var(--ink3)] group-active:text-white/80 tracking-widest uppercase mt-0.5 leading-none">
                              {btn.sub}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Primary Unlock CTA */}
                  <button
                    type="button"
                    onClick={() => submitPinAuth()}
                    disabled={isLoading || !mobileIdentifier.trim() || pin.length < 4}
                    className="w-full vx-btn accent !h-13 !rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/25 disabled:opacity-40 flex items-center justify-center gap-2 mt-1"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{t("login.enterGateTerminal")}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Quick Admin Access Bar */}
                  <div className="pt-2 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={handleQuickAdminLogin}
                      disabled={isLoading}
                      className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 hover:from-orange-500/15 hover:to-orange-500/15 border border-orange-500/30 text-[#f25c27] text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                    >
                      <Crown className="w-4 h-4 text-[#f25c27]" />
                      <span>{t("login.oneTapLogin") || "1-Tap Quick Login"} ({t("login.adminQuickAccess") || "Admin"})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ────────── PASSWORD MODE CONSOLE ────────── */}
              {activeTab === "password" && (
                <form onSubmit={submitPasswordAuth} className="space-y-4">
                  {/* Facility Admin 1-Tap Quick Login Card */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-500/12 via-amber-500/8 to-transparent border border-orange-500/25 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f25c27] to-[#e64a19] text-white flex items-center justify-center shadow-xs">
                        <Crown className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--ink)] leading-tight">{t("login.adminQuickAccess") || "Admin Quick Access"}</p>
                        <p className="text-[11px] text-[var(--ink3)] font-mono">admin@santwamanbhau.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail("admin@santwamanbhau.com");
                          setPassword("Password@123");
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[var(--card)] text-[var(--ink2)] hover:text-[var(--ink)] border border-[var(--line)] shadow-xs transition-colors"
                      >
                        Auto-Fill
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickAdminLogin}
                        disabled={isLoading}
                        className="px-3 py-1 text-xs font-bold rounded-xl bg-[#f25c27] text-white flex items-center gap-1 shadow-sm hover:brightness-105 active:scale-95 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Login</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1 block">
                      {t("login.adminEmail")}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@parking.com"
                        required
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm focus:outline-none focus:border-[#f25c27] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)]">
                        {t("common.password")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[10px] text-[#f25c27] font-bold hover:underline"
                      >
                        {t("login.forgotPassword")}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full h-11 pl-10 pr-10 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm focus:outline-none focus:border-[#f25c27] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink3)] hover:text-[var(--ink)]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink3)] mb-1 block">
                        {t("login.confirmPassword")}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm focus:outline-none focus:border-[#f25c27] transition-all"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[var(--ink2)]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-[var(--line)] text-[#f25c27] focus:ring-0"
                      />
                      <span>{t("login.rememberSession")}</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full vx-btn accent !h-13 !rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{isSignUp ? t("login.signUp") : t("login.signInToDashboard")}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-xs text-[var(--ink3)] hover:text-[#f25c27] font-semibold transition-colors"
                    >
                      {isSignUp ? t("login.alreadyHaveAccount") : t("login.needToRegister")}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      {/* ────────── FORGOT PASSWORD MODAL ────────── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForgotModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md vx-card p-6 shadow-2xl z-10 border border-[var(--line)]"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[var(--soft)] flex items-center justify-center text-[var(--ink3)] hover:text-[var(--ink)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[#f25c27] flex items-center justify-center mb-3">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[var(--ink)]">{t("login.resetPassword")}</h3>
                <p className="text-xs text-[var(--ink3)] mt-1">
                  {t("login.resetPasswordDesc")}
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("login.resetLinkSent")} <strong>{forgotEmail}</strong>!
                  </p>
                  <p className="text-[11px] text-[var(--ink3)]">
                    {t("login.checkInbox")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotSent(false);
                      setForgotEmail("");
                    }}
                    className="w-full vx-btn accent !py-2.5 !rounded-xl text-xs font-bold"
                  >
                    {t("login.backToSignIn")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                      {forgotError}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-1.5 block">
                      {t("login.emailAddress")}
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@parking.com"
                      required
                      className="w-full h-11 px-3.5 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm focus:outline-none focus:border-[#f25c27] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full vx-btn accent !py-3 !rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>{t("login.sendResetLink")}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
