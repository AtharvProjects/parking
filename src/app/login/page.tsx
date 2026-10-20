"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { useLanguage } from "@/providers/language-provider";
import { LANGUAGES } from "@/lib/i18n";
import {
  Car,
  KeyRound,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Check,
  Wifi,
  WifiOff,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  X,
  Building2,
  Clock,
  Sparkles,
  UserCheck,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuthTab = "pin" | "password";

export default function LoginPage() {
  const router = useRouter();
  const { status, employee, loginWithPassword, loginWithPin, resetPassword, isOffline } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Tab State: 'pin' (Fast Staff PIN) or 'password' (Admin/Manager)
  const [activeTab, setActiveTab] = useState<AuthTab>("pin");

  // PIN Form State
  const [mobileIdentifier, setMobileIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [quickStaff, setQuickStaff] = useState<Array<{ id: string; name: string; mobile: string; role: string; shift?: string }>>([]);

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

  // If already authenticated, redirect to dashboard or gate
  useEffect(() => {
    if (status === "authenticated" && employee) {
      if (employee.role === "OPERATOR" || employee.role === "GATE_ATTENDANT") {
        router.push("/gate/");
      } else {
        router.push("/dashboard/");
      }
    }
  }, [status, employee, router]);

  // Load quick select staff for PIN login
  useEffect(() => {
    async function loadStaff() {
      try {
        const staff = await authService.getQuickSelectEmployees();
        if (staff && staff.length > 0) {
          setQuickStaff(staff as any);
        }
      } catch (e) {
        console.warn("Could not load quick staff list:", e);
      }
    }
    loadStaff();
  }, []);

  // Quick fill helper
  const handleSelectStaff = (member: { mobile: string; name: string }) => {
    setMobileIdentifier(member.mobile);
    setPin("");
    setError("");
  };

  // Handle Keypad Press for PIN
  const handleKeypadPress = (val: string) => {
    setError("");
    if (val === "BACKSPACE") {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === "CLEAR") {
      setPin("");
    } else if (pin.length < 6) {
      const newPin = pin + val;
      setPin(newPin);
      // If PIN reaches 4 or 6 digits and mobile is entered, attempt auto-submit or user can tap Login
      if (mobileIdentifier.trim() && (newPin.length === 4 || newPin.length === 6)) {
        // slight delay for visual dot feedback
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

  // Quick Preset Fill
  const fillDemoAdmin = () => {
    setActiveTab("password");
    setEmail("admin@gmail.com");
    setPassword("password123");
    setError("");
  };

  const fillDemoOperator = () => {
    setActiveTab("pin");
    setMobileIdentifier("9420500321");
    setPin("1234");
    setError("");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--page)] text-[var(--ink)] font-sans selection:bg-[var(--accent)] selection:text-white">
      {/* Dynamic Ambient Background Layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-[var(--accent)]/15 via-[var(--accent)]/5 to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      {/* Status Bar Spacer */}
      <div 
        className="w-full shrink-0 relative z-10" 
        style={{ height: "max(env(safe-area-inset-top, 0px), 54px)" }} 
      />

      {/* Top Header Bar */}
      <header className="relative z-10 py-4 px-6 flex items-center justify-between max-w-lg mx-auto w-full rv" style={{ ["--i" as any]: 0 }}>
        <div className="flex items-center gap-3">
          <div className="vx-logo-badge !w-10 !h-10 text-base font-extrabold">
            V
          </div>
          <div>
            <h2 className="text-[var(--ink)] font-extrabold text-[17px] tracking-tight leading-none">
              Vertix <span className="text-[var(--accent)]">Parking</span>
            </h2>
            <p className="text-[11px] text-[var(--ink3)] font-medium mt-1">{t("login.subtitle")}</p>
          </div>
        </div>

        {/* Network & Offline Status Indicator */}
        <div className="pill flex items-center gap-1.5 px-3 py-1 bg-[var(--card)] text-[11px] font-semibold">
          {isOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span className="text-amber-600 dark:text-amber-400">{t("login.offlinePinAuth")}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400">{t("common.livesync")}</span>
            </>
          )}
        </div>

        {/* Language Selector Globe */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="pill flex items-center gap-1.5 px-3 py-1 bg-[var(--card)] text-[11px] font-semibold text-[var(--ink2)] hover:text-[var(--ink)] transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>{LANGUAGES.find(l => l.code === language)?.nativeLabel}</span>
          </button>
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-[var(--card)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden z-50 p-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center gap-3 transition-colors",
                    language === lang.code
                      ? "bg-[var(--accent)] text-white font-bold"
                      : "text-[var(--ink2)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                  )}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.nativeLabel}</span>
                  {language === lang.code && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Form Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-5 py-4">
        {/* Welcome Text */}
        <div className="text-center mb-6 rv" style={{ ["--i" as any]: 1 }}>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            {activeTab === "pin" ? t("login.staffGateLogin") : isSignUp ? t("login.createAdminAccount") : t("login.managementPortal")}
          </h1>
          <p className="text-[var(--ink3)] text-xs sm:text-sm mt-1.5 px-4 font-medium">
            {activeTab === "pin"
              ? t("login.pinDescription")
              : isSignUp
              ? t("login.signUpDescription")
              : t("login.passwordDescription")}
          </p>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div className="pill p-1.5 bg-[var(--soft)] mb-6 flex rv" style={{ ["--i" as any]: 2 }}>
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
            <KeyRound className="w-4 h-4 text-[var(--accent)]" />
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
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span>{t("login.adminManager")}</span>
          </button>
        </div>

        {/* Vertix Card Container */}
        <motion.div
          key={shakeKey}
          animate={{ x: shakeKey ? [-8, 8, -6, 6, -3, 3, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className="vx-card p-6 shadow-xl relative overflow-hidden rv"
          style={{ ["--i" as any]: 3 }}
        >
          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-xs font-semibold leading-snug"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="p-0.5 text-destructive hover:opacity-80"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>


          {/* ────────── TAB 1: QUICK STAFF PIN MODE ────────── */}
          {activeTab === "pin" && (
            <div className="space-y-5">
              {/* Quick Staff Selection Chips (if available) */}
              {quickStaff.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-[var(--ink3)] mb-2 block">
                    {t("login.quickStaffSelect")}
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-1 px-1">
                    {quickStaff.slice(0, 4).map((member) => {
                      const isSelected = mobileIdentifier === member.mobile;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleSelectStaff(member)}
                          className={cn(
                            "px-3 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shrink-0 border transition-all",
                            isSelected
                              ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-bold shadow-sm"
                              : "bg-[var(--soft)] border-[var(--line)] text-[var(--ink2)] hover:bg-[var(--soft2)] hover:text-[var(--ink)]"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{member.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mobile Number Input */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-2 block">
                  {t("login.registeredMobile")}
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                  <input
                    type="tel"
                    value={mobileIdentifier}
                    onChange={(e) => setMobileIdentifier(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder={t("login.enterMobile")}
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] font-mono text-base tracking-wider placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                  {mobileIdentifier && (
                    <button
                      type="button"
                      onClick={() => setMobileIdentifier("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink3)] hover:text-[var(--ink)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Masked PIN Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)]">
                    {t("login.securityPin")}
                  </label>
                  {pin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPin("")}
                      className="text-xs text-[var(--accent)] font-semibold hover:underline"
                    >
                      {t("login.clearPin")}
                    </button>
                  )}
                </div>

                {/* 4 PIN Dots */}
                <div className="flex justify-center gap-3 py-3 px-4 rounded-2xl bg-[var(--soft)] border border-[var(--line)]">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-4 h-4 rounded-full transition-all duration-200",
                          isFilled
                            ? "bg-[var(--accent)] scale-110 shadow-md shadow-[var(--accent)]/40 ring-2 ring-[var(--accent)]/30"
                            : "bg-[var(--card)] border border-[var(--line)]"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Touch Numpad for Mobile POS / Tablets */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACKSPACE"].map((val) => {
                  if (val === "CLEAR") {
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleKeypadPress("CLEAR")}
                        className="h-11 rounded-xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink3)] text-xs font-bold active:scale-95 transition-all border border-[var(--line)] flex items-center justify-center"
                      >
                        C
                      </button>
                    );
                  }
                  if (val === "BACKSPACE") {
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleKeypadPress("BACKSPACE")}
                        className="h-11 rounded-xl bg-[var(--soft)] hover:bg-[var(--soft2)] text-[var(--ink2)] text-sm font-bold active:scale-95 transition-all border border-[var(--line)] flex items-center justify-center"
                      >
                        ⌫
                      </button>
                    );
                  }
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleKeypadPress(val)}
                      className="h-11 rounded-xl bg-[var(--card)] hover:bg-[var(--soft)] text-[var(--ink)] font-mono text-base font-bold active:scale-95 transition-all border border-[var(--line)] shadow-sm"
                    >
                      {val}
                    </button>
                  );
                })}
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={() => submitPinAuth()}
                disabled={isLoading || !mobileIdentifier.trim() || pin.length < 4}
                className="w-full vx-btn accent !py-3.5 !rounded-2xl text-sm font-bold shadow-lg disabled:opacity-50"
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
            </div>
          )}

          {/* ────────── TAB 2: ADMIN & MANAGER PASSWORD MODE ────────── */}
          {activeTab === "password" && (
            <form onSubmit={submitPasswordAuth} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-2 block">
                  {t("login.adminEmail")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@parking.com"
                    required
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-2 block">
                  {t("common.password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-12 pl-11 pr-11 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink3)] hover:text-[var(--ink)] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (if Sign Up) */}
              {isSignUp && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-2 block">
                    {t("login.confirmPassword")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink3)]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm placeholder:text-[var(--ink3)] focus:outline-none focus:border-[var(--accent)] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              {!isSignUp && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-md border flex items-center justify-center transition-colors",
                        rememberMe
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "bg-[var(--soft)] border-[var(--line)]"
                      )}
                      onClick={() => setRememberMe(!rememberMe)}
                    >
                      {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs text-[var(--ink2)] font-medium">{t("login.rememberSession")}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotError("");
                    }}
                    className="text-xs text-[var(--accent)] font-semibold hover:underline"
                  >
                    {t("login.forgotPassword")}
                  </button>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full vx-btn accent !py-3.5 !rounded-2xl text-sm font-bold shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? t("login.createAdminAccount") : t("login.signInToDashboard")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Toggle Sign In / Sign Up */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  className="text-xs text-[var(--ink3)] hover:text-[var(--ink)] transition-colors"
                >
                  {isSignUp ? (
                    <span>{t("login.alreadyHaveAccount")} <strong className="text-[var(--accent)]">{t("login.signIn")}</strong></span>
                  ) : (
                    <span>{t("login.needToRegister")} <strong className="text-[var(--accent)]">{t("login.signUp")}</strong></span>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Quick Demo Credentials Footer */}
        <div className="mt-6 flex flex-col items-center gap-2 text-center rv" style={{ ["--i" as any]: 4 }}>
          <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--ink3)]">
            {t("login.devQuickFill")}
          </span>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="pill px-3 py-1.5 bg-[var(--soft)] border border-[var(--line)] text-[11px] font-semibold text-[var(--ink2)] hover:text-[var(--ink)] transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Admin (admin@gmail.com)</span>
            </button>
            <button
              type="button"
              onClick={fillDemoOperator}
              className="pill px-3 py-1.5 bg-[var(--soft)] border border-[var(--line)] text-[11px] font-semibold text-[var(--ink2)] hover:text-[var(--ink)] transition-all flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Operator PIN (9420500321 / 1234)</span>
            </button>
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
                <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-3">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[var(--ink)]">{t("login.resetPassword")}</h3>
                <p className="text-xs text-[var(--ink3)] mt-1">
                  {t("login.resetPasswordDesc")}
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-2xl bg-[var(--green-soft)] border border-[var(--green)]/30 text-center space-y-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--green)]/20 text-[var(--green)] flex items-center justify-center mx-auto">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-[var(--green)]">
                    {t("login.resetLinkSent")} <strong>{forgotEmail}</strong>!
                  </p>
                  <p className="text-[11px] text-[var(--ink3)]">
                    {t("login.checkInbox")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-2.5 rounded-full bg-[var(--btn)] text-[var(--on-ink)] text-xs font-semibold transition-colors"
                  >
                    {t("login.backToSignIn")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 rounded-xl bg-[var(--red-soft)] border border-[var(--red)]/30 text-xs text-[var(--red)] font-medium">
                      {forgotError}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink3)] mb-2 block">
                      {t("login.emailAddress")}
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@parking.com"
                      required
                      className="w-full h-11 px-4 rounded-xl bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full vx-btn accent !py-3 !rounded-xl text-xs font-bold"
                  >
                    {forgotLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("login.sendResetLink")}
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
