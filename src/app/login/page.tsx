"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, Eye, EyeOff, ChevronsRight, Check, ShoppingBag, Pizza } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("admin@gmail.com");
  const [password, setPassword] = useState("password123");
  const [confirmPassword, setConfirmPassword] = useState("password123");
  const [error, setError] = useState("Invalid login credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const constraintsRef = useRef(null);

  // Clear error on init to mimic fresh state if needed, but left initial error for preview
  React.useEffect(() => {
    // Only keeping the error initially for visual match with screenshot
    // Optional: setError(""); 
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    // Submit if dragged far enough to the right
    if (info.offset.x > 150) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white font-sans">
      {/* Header */}
      <div className="bg-primary pt-14 pb-24 relative overflow-hidden shrink-0">
        {/* Background watermark icons */}
        <div className="absolute top-10 -left-12 opacity-[0.05] rotate-[-15deg]">
          <ShoppingBag strokeWidth={1} className="w-64 h-64 text-white" />
        </div>
        <div className="absolute top-16 -right-16 opacity-[0.05] rotate-[25deg]">
          <Pizza strokeWidth={1} className="w-72 h-72 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center mt-6">
          <h2 className="text-white text-[15px] tracking-[0.2em] font-bold uppercase mb-5">
            The East Palace
          </h2>
          <h1 className="text-white text-[42px] font-bold mb-3 tracking-tight">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-white/90 text-[15px] px-10 text-center leading-relaxed">
            {isLogin 
              ? "Sign in to continue ordering your favorite meals." 
              : "Join us today and start enjoying fast food delivery."}
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-[36px] -mt-10 px-6 pt-7 pb-8 flex flex-col relative z-20 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
        {/* Tab Switcher */}
        <div className="flex bg-[#f5f5f5] rounded-full p-1.5 mb-6">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(""); }}
            className={`flex-1 py-3.5 rounded-full text-[16px] font-semibold transition-all ${
              isLogin ? "bg-white text-primary shadow-sm" : "text-gray-500"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(""); }}
            className={`flex-1 py-3.5 rounded-full text-[16px] font-semibold transition-all ${
              !isLogin ? "bg-white text-primary shadow-sm" : "text-gray-500"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          {/* Email */}
          <div className="mb-5">
            <label className="text-gray-800 text-[15px] mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[22px] h-[22px] text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[54px] pl-[52px] pr-4 rounded-2xl border border-gray-200 bg-white text-gray-900 text-[16px] focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-1">
            <label className="text-gray-800 text-[15px] mb-2 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[22px] h-[22px] text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full h-[54px] pl-[52px] pr-12 rounded-2xl border bg-white text-gray-900 text-[16px] focus:outline-none transition-colors ${
                  error ? "border-red-400" : "border-gray-200 focus:border-primary"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              >
                {showPassword ? (
                  <EyeOff className="w-[22px] h-[22px] text-gray-500" />
                ) : (
                  <Eye className="w-[22px] h-[22px] text-gray-500" />
                )}
              </button>
            </div>
          </div>
          
          {/* Error Message */}
          <div className="min-h-[26px] mb-3">
            {error && (
              <p className="text-red-500 text-[13.5px] mt-1.5">{error}</p>
            )}
          </div>

          {/* Confirm Password (Sign Up only) */}
          {!isLogin && (
            <div className="mb-6">
              <label className="text-gray-800 text-[15px] mb-2 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[22px] h-[22px] text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-[54px] pl-[52px] pr-12 rounded-2xl border border-gray-200 bg-white text-gray-900 text-[16px] focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-[22px] h-[22px] text-gray-500" />
                  ) : (
                    <Eye className="w-[22px] h-[22px] text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Remember me & Forgot Password */}
          {isLogin && (
            <div className="flex items-center justify-between mb-8 mt-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center transition-colors ${rememberMe ? 'bg-primary' : 'bg-gray-100 border border-gray-300'}`}>
                   {rememberMe && <Check className="w-[14px] h-[14px] text-white" strokeWidth={3.5} />}
                </div>
                <span className="text-[15px] text-gray-900 font-medium">Remember me</span>
              </label>
              <button type="button" className="text-primary text-[15px] font-semibold">
                Forgot Password?
              </button>
            </div>
          )}

          {/* Swipe Button */}
          <div ref={constraintsRef} className={`w-full h-[60px] bg-primary rounded-full flex items-center relative overflow-hidden px-2 ${!isLogin ? 'mt-2' : ''}`}>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-8">
              <span className="text-white font-semibold text-[17px]">
                {isLogin ? "Swipe to Login" : "Swipe to Sign up"}
              </span>
            </div>
            <motion.div
              drag="x"
              dragConstraints={constraintsRef}
              dragSnapToOrigin={true}
              dragElastic={0.05}
              onDragEnd={handleDragEnd}
              className="w-[46px] h-[46px] bg-white rounded-full flex items-center justify-center shadow-sm cursor-grab active:cursor-grabbing z-10"
            >
              {isLoading ? (
                 <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                 <ChevronsRight className="w-6 h-6 text-primary" />
              )}
            </motion.div>
          </div>

          <div className="flex items-center gap-4 my-8">
            <div className="h-[1px] bg-gray-200 flex-1"></div>
            <span className="text-gray-500 text-[15px] font-medium">Or continue with</span>
            <div className="h-[1px] bg-gray-200 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button type="button" className="flex items-center justify-center gap-3 h-[54px] rounded-2xl bg-[#f8f9fa] border border-gray-100 font-semibold text-gray-800 text-[15px]">
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button type="button" className="flex items-center justify-center gap-3 h-[54px] rounded-2xl bg-[#f8f9fa] border border-gray-100 font-semibold text-gray-800 text-[15px]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="20" height="20" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              Apple
            </button>
          </div>

          <p className="text-center text-[15px] text-gray-500 mt-auto pb-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-primary font-bold"
            >
              {isLogin ? "Create an account" : "Log In"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}


