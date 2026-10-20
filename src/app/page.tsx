"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { status, employee } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && employee) {
      if (employee.role === "OPERATOR" || employee.role === "GATE_ATTENDANT") {
        router.replace("/gate/");
      } else {
        router.replace("/dashboard/");
      }
    } else {
      router.replace("/login/");
    }
  }, [status, employee, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
