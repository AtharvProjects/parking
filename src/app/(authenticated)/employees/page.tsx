"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSite } from "@/providers/site-provider";
import { employeesService } from "@/services/employees.service";
import { ROLE_CONFIG, SHIFT_CONFIG } from "@/lib/constants";
import type { Employee, EmployeeRole, ShiftType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Plus, Search, X, Loader2, Check, UserPlus, Phone, Mail, ArrowLeft, Building2 } from "lucide-react";

export default function EmployeesPage() {
  const router = useRouter();
  const { employee } = useAuth();
  const { currentSite, currentSiteId } = useSite();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", mobile: "", email: "", role: "OPERATOR" as EmployeeRole, shift: "" as ShiftType | "", pin: "1234" });
  const [editId, setEditId] = useState<string | null>(null);

  const effectiveSiteId = (currentSiteId && currentSiteId !== "ALL") ? currentSiteId : employee?.site_id;

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", effectiveSiteId],
    queryFn: () => employeesService.getAll(effectiveSiteId),
    enabled: !!employee,
  });


  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const input = { ...data, shift: data.shift || undefined, pin: data.pin || undefined, salary_advance: 0 };
      if (editId) {
        await employeesService.update(editId, input);
      } else {
        await employeesService.create(employee!.site_id, input);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setEditId(null);
      setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "", pin: "1234" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => employeesService.toggleActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const filtered = (employees || []).filter(
    (e) => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.mobile.includes(searchQuery)
  );

  const handleEdit = (emp: Employee) => {
    setFormData({ name: emp.name, mobile: emp.mobile, email: emp.email || "", role: emp.role, shift: emp.shift || "", pin: emp.pin || "" });
    setEditId(emp.id);
    setShowForm(true);
  };

  const generateRandomPin = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData((prev) => ({ ...prev, pin: randomPin }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-36 font-sans">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="w-9 h-9 rounded-full bg-muted/80 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-heading-lg text-foreground">Employees & Operators</h1>
            <p className="text-caption">{(employees || []).length} team members • {currentSite?.name || "All Sites"}</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "", pin: "1234" }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base shadow-sm font-bold"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>


      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search employees..."
          className="w-full h-12 pl-12 pr-4 rounded-xl border border-input bg-card text-body focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-base"
        />
      </div>

      {isLoading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-heading-md text-foreground mb-2">No Employees</h3>
          <p className="text-body-sm text-muted-foreground">Add your first team member</p>
        </div>
      )}

      {/* Employee List */}
      <div className="space-y-3">
        {filtered.map((emp) => (
          <div key={emp.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base", emp.active ? "bg-primary" : "bg-muted-foreground")}>
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-label text-foreground font-bold">{emp.name}</p>
                <div className="flex items-center gap-2 text-caption flex-wrap mt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{ROLE_CONFIG[emp.role]?.label || emp.role}</span>
                  {emp.shift && <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">{SHIFT_CONFIG[emp.shift]?.label}</span>}
                  {emp.pin ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-semibold">
                      🔒 PIN: {emp.pin}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                      ⚠️ No PIN
                    </span>
                  )}
                  <span className="font-mono text-muted-foreground text-xs">📞 {emp.mobile}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleMutation.mutate({ id: emp.id, active: !emp.active })}
                className={cn("px-3 py-1.5 rounded-lg text-caption font-semibold transition-base", emp.active ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300")}
              >
                {emp.active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => handleEdit(emp)} className="px-3 py-1.5 rounded-lg text-caption font-semibold bg-muted text-foreground hover:bg-border transition-base">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card border border-border rounded-t-[32px] sm:rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-heading-md text-foreground font-bold">{editId ? "Edit" : "Add"} Employee</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Scrollable Body */}
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-6 overflow-y-auto space-y-4 pb-28">
              <div>
                <label className="text-label mb-1.5 block">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  placeholder="e.g. Ramesh Patil"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Mobile Number *</label>
                <input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required
                  placeholder="10-digit mobile number"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-1.5 block">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Optional for field staff"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-label mb-1.5 block">Role *</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                    className="w-full h-12 px-3 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(ROLE_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-label mb-1.5 block">Shift</label>
                  <select value={formData.shift} onChange={(e) => setFormData({ ...formData, shift: e.target.value as ShiftType | "" })}
                    className="w-full h-12 px-3 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">No shift</option>
                    {Object.entries(SHIFT_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Security PIN Configuration */}
              <div className="p-3.5 bg-muted/60 rounded-2xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label text-foreground font-bold flex items-center gap-1.5">
                    <span>🔒 Quick Security PIN (4–6 Digits)</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                  placeholder="e.g. 1234"
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {createMutation.isError && (
                <p className="text-destructive text-body-sm font-semibold">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || !formData.mobile || createMutation.isPending}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 transition-base disabled:opacity-50 font-bold shadow-lg shadow-primary/25 mt-2">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />{editId ? "Update" : "Add"} Employee</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
