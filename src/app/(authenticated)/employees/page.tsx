"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { employeesService } from "@/services/employees.service";
import { ROLE_CONFIG, SHIFT_CONFIG } from "@/lib/constants";
import type { Employee, EmployeeRole, ShiftType } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { Plus, Search, X, Loader2, Check, UserPlus, Phone, Mail } from "lucide-react";

export default function EmployeesPage() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", mobile: "", email: "", role: "OPERATOR" as EmployeeRole, shift: "" as ShiftType | "" });
  const [editId, setEditId] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", employee?.site_id],
    queryFn: () => employeesService.getAll(employee?.site_id),
    enabled: !!employee,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const input = { ...data, shift: data.shift || undefined, salary_advance: 0 };
      if (editId) return employeesService.update(editId, input);
      return employeesService.create(employee!.site_id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setEditId(null);
      setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "" });
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
    setFormData({ name: emp.name, mobile: emp.mobile, email: emp.email || "", role: emp.role, shift: emp.shift || "" });
    setEditId(emp.id);
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-heading-lg text-foreground">Employees</h1>
          <p className="text-caption">{(employees || []).length} team members</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setFormData({ name: "", mobile: "", email: "", role: "OPERATOR", shift: "" }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-label hover:opacity-90 transition-base"
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
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-heading-md text-foreground mb-2">No Employees</h3>
          <p className="text-body-sm text-muted-foreground">Add your first team member</p>
        </div>
      )}

      {/* Employee List */}
      <div className="space-y-3">
        {filtered.map((emp) => (
          <div key={emp.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white text-label", emp.active ? "bg-primary" : "bg-muted-foreground")}>
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-label text-foreground">{emp.name}</p>
                <div className="flex items-center gap-2 text-caption">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{ROLE_CONFIG[emp.role]?.label || emp.role}</span>
                  {emp.shift && <span>{SHIFT_CONFIG[emp.shift]?.label}</span>}
                  <span>📞 {emp.mobile}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleMutation.mutate({ id: emp.id, active: !emp.active })}
                className={cn("px-3 py-1.5 rounded-lg text-caption font-semibold transition-base", emp.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 safe-bottom max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-heading-md text-foreground mb-5">{editId ? "Edit" : "Add"} Employee</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div>
                <label className="text-label mb-2 block">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-2 block">Mobile *</label>
                <input type="tel" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} required
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-2 block">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-label mb-2 block">Role *</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {Object.entries(ROLE_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-label mb-2 block">Shift</label>
                <select value={formData.shift} onChange={(e) => setFormData({ ...formData, shift: e.target.value as ShiftType | "" })}
                  className="w-full h-12 px-4 rounded-xl border border-input bg-background text-body focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No shift assigned</option>
                  {Object.entries(SHIFT_CONFIG).map(([key, val]) => <option key={key} value={key}>{val.label} ({val.start}-{val.end})</option>)}
                </select>
              </div>
              {createMutation.isError && (
                <p className="text-destructive text-body-sm">{(createMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={!formData.name || !formData.mobile || createMutation.isPending}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground text-label flex items-center justify-center gap-2 hover:opacity-90 transition-base disabled:opacity-50">
                {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />{editId ? "Update" : "Add"} Employee</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
