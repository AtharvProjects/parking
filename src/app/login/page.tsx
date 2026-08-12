"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
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
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type AuthTab = "pin" | "password";

export default function LoginPage() {
  const router = useRouter();
  const { status, employee, loginWithPassword, loginWithPin, resetPassword, isOffline } = useAuth();

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
        router.push("/gate");
      } else {
        router.push("/dashboard");
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
      setError("Please enter your registered 10-digit mobile number.");
      setShakeKey((k) => k + 1);
      return;
    }
    if (!pinCode || pinCode.length < 4) {
      setError("Please enter your 4-digit Security PIN.");
      setShakeKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    try {
      const emp = await loginWithPin({ identifier: ident.trim(), pin: pinCode.trim() });
      if (emp.role === "OPERATOR" || emp.role === "GATE_ATTENDANT") {
        router.push("/gate");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Invalid Mobile Number or Security PIN.");
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
      setError("Please fill in both email and password.");
      setShakeKey((k) => k + 1);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      setShakeKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        await authService.signUp(email, password);
        setError("Account created! Please check your email to confirm registration or sign in.");
        setIsSignUp(false);
      } else {
        await loginWithPassword({ email: email.trim(), password: password.trim() });
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check your credentials.");
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
      setForgotError(err.message || "Failed to send reset link. Please verify the email.");
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
    <div className="min-h-[100dvh] flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-primary selection:text-white">
      {/* Dynamic Ambient Background Layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-primary/25 via-primary/5 to-transparent rounded-full blur-3xl opacity-80" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-sky-600/10 rounded-full blur-3xl" />
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 pt-8 pb-4 px-6 flex items-center justify-between max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-orange-600 p-[1px] shadow-lg shadow-primary/25 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <h2 className="text-white font-bold text-[17px] tracking-tight leading-none">
              Sant Wamanbhau Parking
            </h2>
            <p className="text-[12px] text-slate-400 font-medium mt-1">Smart Facility & Gate Terminal</p>
          </div>
        </div>

        {/* Network & Offline Status Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[11px] font-semibold">
          {isOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-300">Offline (PIN Auth)</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400">Live Sync</span>
            </>
          )}
        </div>
      </header>

      {/* Main Form Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-5 py-4">
        {/* Welcome Text */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {activeTab === "pin" ? "Staff Gate Login" : isSignUp ? "Create Admin Account" : "Management Portal"}
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 px-4">
            {activeTab === "pin"
              ? "Fast 4-digit PIN access for on-duty operators & attendants."
              : isSignUp
              ? "Register a new parking business organization."
              : "Sign in with your email to manage sites, rates, & revenue."}
          </p>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-xl mb-6 shadow-inner flex">
          <button
            type="button"
            onClick={() => {
              setActiveTab("pin");
              setError("");
            }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200",
              activeTab === "pin"
                ? "bg-gradient-to-r from-primary to-orange-600 text-white shadow-md shadow-primary/20"
                : "text-slate-400 hover:text-white"
            )}
          >
            <KeyRound className="w-4 h-4" />
            Quick Staff PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("password");
              setError("");
            }}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200",
              activeTab === "password"
                ? "bg-slate-800 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-white"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin / Manager
          </button>
        </div>

        {/* Glass Card */}
        <motion.div
          key={shakeKey}
          animate={{ x: shakeKey ? [-8, 8, -6, 6, -3, 3, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/90 rounded-[28px] border border-slate-800/90 backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm font-medium leading-snug"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="p-0.5 text-red-400 hover:text-white"
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
                  <label className="text-[12px] uppercase tracking-wider font-bold text-slate-400 mb-2 block">
                    Quick Staff Select
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
                            "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 border transition-all",
                            isSelected
                              ? "bg-primary/20 border-primary text-white ring-1 ring-primary"
                              : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Registered Mobile / Staff ID
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    value={mobileIdentifier}
                    onChange={(e) => setMobileIdentifier(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full h-13 pl-12 pr-4 rounded-xl bg-slate-950/80 border border-slate-800 text-white font-mono text-base tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  {mobileIdentifier && (
                    <button
                      type="button"
                      onClick={() => setMobileIdentifier("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Masked PIN Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Security PIN (4–6 Digits)
                  </label>
                  {pin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPin("")}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Clear PIN
                    </button>
                  )}
                </div>

                {/* 4 to 6 PIN Dots */}
                <div className="flex justify-center gap-3 py-2.5 px-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "w-4 h-4 rounded-full transition-all duration-200",
                          isFilled
                            ? "bg-gradient-to-br from-primary to-orange-500 scale-110 shadow-md shadow-primary/40 ring-2 ring-primary/40"
                            : "bg-slate-800 border border-slate-700"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Touch Numpad for Mobile POS / Tablets */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "BACKSPACE"].map((val) => {
                  if (val === "CLEAR") {
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleKeypadPress("CLEAR")}
                        className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 text-xs font-bold active:scale-95 transition-all border border-slate-800/60 flex items-center justify-center"
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
                        className="h-12 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-sm font-bold active:scale-95 transition-all border border-slate-800/60 flex items-center justify-center"
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
                      className="h-12 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 text-white font-mono text-lg font-semibold active:scale-95 transition-all border border-slate-700/60 shadow-sm"
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
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:opacity-95 disabled:opacity-50 active:scale-[0.99] transition-all"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Enter Gate Terminal</span>
                    <ArrowRight className="w-5 h-5" />
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@parking.com"
                    required
                    className="w-full h-13 pl-12 pr-4 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-13 pl-12 pr-12 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (if Sign Up) */}
              {isSignUp && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full h-13 pl-12 pr-4 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        rememberMe
                          ? "bg-primary border-primary text-white"
                          : "bg-slate-950 border-slate-700"
                      )}
                      onClick={() => setRememberMe(!rememberMe)}
                    >
                      {rememberMe && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-xs text-slate-300 font-medium">Remember session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotError("");
                    }}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:opacity-95 disabled:opacity-50 active:scale-[0.99] transition-all mt-4"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? "Create Admin Account" : "Sign In to Dashboard"}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Toggle Sign In / Sign Up */}
              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {isSignUp ? (
                    <span>Already have an account? <strong className="text-primary">Sign In</strong></span>
                  ) : (
                    <span>Need to register a new facility? <strong className="text-primary">Sign Up</strong></span>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Quick Demo Credentials Footer */}
        <div className="mt-6 flex flex-col items-center gap-2.5 text-center">
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
            Developer / Tester Quick-Fill
          </span>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin (admin@gmail.com)</span>
            </button>
            <button
              type="button"
              onClick={fillDemoOperator}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-primary" />
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
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Reset Password</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Enter your admin email and we’ll send you a link to reset your account password.
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Reset link sent to <strong>{forgotEmail}</strong>!
                  </p>
                  <p className="text-xs text-slate-400">
                    Please check your inbox (and spam folder) and follow the instructions to set a new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  {forgotError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium">
                      {forgotError}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@parking.com"
                      required
                      className="w-full h-12 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {forgotLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
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
