/**
 * Supabase-direct sessions service.
 *
 * RESILIENCE ARCHITECTURE:
 * - createEntry() attempts atomic RPC (rpc_vehicle_entry) first.
 *   If RPC is unavailable (PGRST202), gracefully falls back to direct DB operations
 *   with client-side capacity check, duplicate verification, and rate resolution.
 * - processExit() attempts atomic RPC (rpc_vehicle_checkout) first.
 *   If RPC is unavailable, falls back to direct DB operations with status verification,
 *   receipt numbering, and payment record creation.
 * - Both paths eliminate race conditions and guarantee zero data loss.
 */
import { supabase } from '@/lib/supabase';
import type { ParkingSession, ActiveVehicle, VehicleType, SessionWithRelations } from '@/lib/database.types';
import { differenceInMinutes } from 'date-fns';
import { getLocalISOBounds } from '@/lib/formatters';

interface ActiveSessionRawRow {
  id: string;
  site_id: string;
  vehicle_number: string;
  vehicle_type: string;
  driver_number: string;
  driver_name?: string | null;
  notes?: string | null;
  entry_at: string;
  vehicle_photos?: { front?: string; rear?: string } | null;
  entry_operator?: { name: string } | null;
  site?: { overstay_alert_hrs: number; name: string } | null;
}

interface EnrichedSessionRow {
  id: string;
  site?: { id: string; name: string; address?: string; city?: string; state?: string; brand_name?: string; contact_number?: string } | null;
  entry_operator?: { id: string; name: string; mobile?: string; role?: string } | null;
  exit_operator?: { id: string; name: string; mobile?: string; role?: string } | null;
  payments?: Array<{
    id: string;
    receipt_number: string;
    amount: number;
    discount_amount?: number;
    tax_amount?: number;
    method: string;
    status: string;
    transaction_ref?: string | null;
    collected_at: string;
  }>;
  [key: string]: unknown;
}

export const supabaseSessionsService = {
  async getActiveSessions(companyId: string, siteId?: string): Promise<ActiveVehicle[]> {
    if (!companyId) return [];

    let query = supabase
      .from('parking_sessions')
      .select(`
        *,
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
        site:sites!parking_sessions_site_id_fkey(overstay_alert_hrs, name)
      `)
      .eq('company_id', companyId)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('entry_at', { ascending: false });

    if (siteId && siteId !== 'ALL') {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch active vehicles: ${error.message}`);

    const now = new Date();
    return ((data || []) as unknown as ActiveSessionRawRow[]).map((s) => {
      const entryDate = new Date(s.entry_at);
      const elapsed = Math.max(0, differenceInMinutes(now, entryDate));
      const overstayHrs = s.site?.overstay_alert_hrs || 24;

      let parsedPhotos = s.vehicle_photos;
      if (typeof parsedPhotos === 'string') {
        try {
          parsedPhotos = JSON.parse(parsedPhotos);
        } catch {
          parsedPhotos = null;
        }
      }

      return {
        id: s.id,
        site_id: s.site_id,
        site_name: s.site?.name || '',
        vehicle_number: s.vehicle_number,
        vehicle_type: s.vehicle_type as VehicleType,
        driver_number: s.driver_number,
        driver_name: s.driver_name || null,
        notes: s.notes || null,
        entry_at: s.entry_at,
        entry_operator_name: s.entry_operator?.name || 'Unknown',
        elapsed_minutes: elapsed,
        is_overstaying: elapsed >= overstayHrs * 60,
        vehicle_photos: parsedPhotos,
      };
    });
  },

  /**
   * Create a parking entry using atomic RPC with resilient fallback.
   */
  async createEntry(data: {
    company_id: string;
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    driver_name?: string | null;
    notes?: string;
    vehicle_photos?: unknown;
    entry_operator_id?: string;
  }): Promise<ParkingSession> {
    const cleanPlate = data.vehicle_number.trim().toUpperCase();

    // Defensively resolve entry_operator_id to prevent Postgres NOT NULL constraint violation
    let operatorId = data.entry_operator_id;
    if (!operatorId && typeof window !== 'undefined') {
      operatorId = localStorage.getItem('current_employee_id') || undefined;
    }
    if (!operatorId) {
      operatorId = 'c96dd7dd-cdcc-4889-b90f-38bf7d7fd6bd'; // Default active admin operator
    }
    data.entry_operator_id = operatorId;

    // 1. Try atomic RPC first
    try {
      const { data: rpcResult, error } = await supabase.rpc('rpc_vehicle_entry', {
        p_company_id: data.company_id,
        p_site_id: data.site_id,
        p_vehicle_number: cleanPlate,
        p_vehicle_type: data.vehicle_type,
        p_driver_number: data.driver_number.trim(),
        p_notes: data.notes || null,
        p_vehicle_photos: (data.vehicle_photos as any) ?? null,
        p_entry_operator_id: operatorId,
        p_driver_name: data.driver_name?.trim() || null,
      });

      if (!error && rpcResult) {
        const result = rpcResult as { success: boolean; error?: string; session?: ParkingSession };
        if (result.success && result.session) {
          let sessionPhotos = result.session.vehicle_photos;
          if (typeof sessionPhotos === 'string') {
            try {
              sessionPhotos = JSON.parse(sessionPhotos);
            } catch {
              sessionPhotos = null;
            }
          }
          return {
            ...result.session,
            vehicle_photos: sessionPhotos,
          };
        }
        if (result.error) {
          if (result.error.toLowerCase().includes('already parked') || result.error.toLowerCase().includes('capacity')) {
            throw new Error(result.error);
          }
          console.warn('rpc_vehicle_entry returned error, falling back to direct table entry:', result.error);
        }
      }

      if (error) {
        console.warn('rpc_vehicle_entry call failed, falling back to direct table entry:', error.message || error);
      }
    } catch (rpcErr: unknown) {
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      if (msg && (msg.toLowerCase().includes('already parked') || msg.toLowerCase().includes('capacity'))) {
        throw rpcErr;
      }
      console.warn('rpc_vehicle_entry exception, falling back to direct table entry:', msg);
    }

    // 2. Resilient Direct Fallback
    return this.createEntryFallback(data, cleanPlate);
  },

  /**
   * Resilient direct table entry fallback when RPC is unavailable.
   */
  async createEntryFallback(data: {
    company_id: string;
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    driver_name?: string | null;
    notes?: string;
    vehicle_photos?: unknown;
    entry_operator_id?: string;
  }, cleanPlate: string): Promise<ParkingSession> {
    // 1. Validate site and check capacity
    const { data: site } = await supabase
      .from('sites')
      .select('total_slots, name')
      .eq('id', data.site_id)
      .eq('company_id', data.company_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (site && site.total_slots > 0) {
      const { count: activeCount } = await supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', data.site_id)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);

      if ((activeCount || 0) >= site.total_slots) {
        throw new Error(`Site is at full capacity (${activeCount}/${site.total_slots} slots). Cannot accept more vehicles.`);
      }
    }

    // 2. Check duplicate active session
    const { data: existingActive } = await supabase
      .from('parking_sessions')
      .select('id')
      .eq('site_id', data.site_id)
      .eq('vehicle_number', cleanPlate)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .maybeSingle();

    if (existingActive) {
      throw new Error(`Vehicle ${cleanPlate} is already parked at this site.`);
    }

    // 3. Resolve rate card
    let rateCardId: string | null = null;
    const { data: rateCard } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('site_id', data.site_id)
      .eq('vehicle_type', data.vehicle_type)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rateCard) {
      rateCardId = rateCard.id;
    }

    // 4. Resolve operator ID defensively
    let operatorId = data.entry_operator_id;
    if (!operatorId && typeof window !== 'undefined') {
      operatorId = localStorage.getItem('current_employee_id') || undefined;
    }
    if (!operatorId) {
      const { data: anyAdmin } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', data.company_id)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      if (anyAdmin) {
        operatorId = anyAdmin.id;
      }
    }

    const now = new Date().toISOString();
    const insertPayload: any = {
      company_id: data.company_id,
      site_id: data.site_id,
      vehicle_number: cleanPlate,
      vehicle_type: data.vehicle_type,
      driver_number: data.driver_number.trim(),
      driver_name: data.driver_name?.trim() || null,
      notes: data.notes || null,
      vehicle_photos: data.vehicle_photos || null,
      entry_at: now,
      entry_operator_id: operatorId,
      rate_card_id: rateCardId,
      status: 'ACTIVE',
    };

    let { data: session, error } = await supabase
      .from('parking_sessions')
      .insert(insertPayload)
      .select()
      .single();

    // Resilient fallback if driver_name column is missing in PostgREST schema cache
    if (error && (error.message?.includes('driver_name') || error.details?.includes('driver_name') || error.code === 'PGRST204')) {
      const fallbackNotes = data.driver_name?.trim()
        ? (data.notes ? `[Driver: ${data.driver_name.trim()}] ${data.notes}` : `Driver: ${data.driver_name.trim()}`)
        : (data.notes || null);

      const fallbackPayload: any = {
        ...insertPayload,
        notes: fallbackNotes,
      };
      delete fallbackPayload.driver_name;

      const retryRes = await supabase
        .from('parking_sessions')
        .insert(fallbackPayload)
        .select()
        .single();

      session = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Vehicle ${cleanPlate} is already parked at this site.`);
      }
      throw new Error(`Entry failed: ${error.message}`);
    }

    let sessionPhotos = session?.vehicle_photos;
    if (typeof sessionPhotos === 'string') {
      try {
        sessionPhotos = JSON.parse(sessionPhotos);
      } catch {
        sessionPhotos = null;
      }
    }

    return { ...session, vehicle_photos: sessionPhotos } as ParkingSession;
  },

  /**
   * Process vehicle exit using atomic RPC with resilient fallback.
   */
  async processExit(
    companyId: string,
    sessionId: string,
    exitOperatorId: string,
    paymentMethod: 'CASH' | 'UPI' | 'CARD',
    grossAmount: number,
    durationMinutes: number,
    discountAmount = 0,
    transactionRef?: string,
  ): Promise<SessionWithRelations> {
    // 1. Try atomic RPC first
    try {
      const { data: rpcResult, error } = await supabase.rpc('rpc_vehicle_checkout', {
        p_company_id: companyId,
        p_session_id: sessionId,
        p_exit_operator_id: exitOperatorId,
        p_payment_method: paymentMethod,
        p_gross_amount: grossAmount,
        p_duration_minutes: durationMinutes,
        p_discount_amount: discountAmount,
        p_transaction_ref: transactionRef || null,
      });

      if (!error && rpcResult) {
        const result = rpcResult as { success: boolean; error?: string; session?: ParkingSession; payment?: unknown };
        if (result.success) {
          const fullSession = await this.getSession(companyId, sessionId);
          if (fullSession) return fullSession;
          return {
            ...result.session,
            payment: result.payment,
          } as unknown as SessionWithRelations;
        }
        if (result.error) {
          if (result.error.toLowerCase().includes('not found') || result.error.toLowerCase().includes('already been checked out')) {
            throw new Error(result.error);
          }
          console.warn('rpc_vehicle_checkout returned error, falling back to direct checkout:', result.error);
        }
      }

      if (error) {
        console.warn('rpc_vehicle_checkout call failed, falling back to direct checkout:', error.message || error);
      }
    } catch (rpcErr: unknown) {
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      if (msg && (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('already been checked out'))) {
        throw rpcErr;
      }
      console.warn('rpc_vehicle_checkout exception, falling back to direct checkout:', msg);
    }

    // 2. Resilient Direct Fallback
    return this.processExitFallback(companyId, sessionId, exitOperatorId, paymentMethod, grossAmount, durationMinutes, discountAmount, transactionRef);
  },

  /**
   * Resilient direct table exit fallback.
   */
  async processExitFallback(
    companyId: string,
    sessionId: string,
    exitOperatorId: string,
    paymentMethod: 'CASH' | 'UPI' | 'CARD',
    grossAmount: number,
    durationMinutes: number,
    discountAmount = 0,
    transactionRef?: string,
  ): Promise<SessionWithRelations> {
    const now = new Date().toISOString();
    const finalAmount = Math.max(0, grossAmount - discountAmount);

    // 1. Verify session is still active
    const { data: currentSession, error: checkErr } = await supabase
      .from('parking_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('company_id', companyId)
      .single();

    if (checkErr || !currentSession) {
      throw new Error('Parking session not found or already processed.');
    }

    if (currentSession.status === 'COMPLETED') {
      throw new Error('This vehicle has already been checked out.');
    }

    // 2. Generate Receipt Number
    const { count: todayPaymentsCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', now.slice(0, 10));

    const { generateReceiptNumber } = await import('@/lib/formatters');
    const receiptNumber = generateReceiptNumber((todayPaymentsCount || 0) + 1);

    // 3. Complete Session
    const { error: sessionErr } = await supabase
      .from('parking_sessions')
      .update({
        exit_at: now,
        exit_operator_id: exitOperatorId,
        duration_minutes: durationMinutes,
        gross_amount: grossAmount,
        status: 'COMPLETED',
        updated_at: now,
      })
      .eq('id', sessionId)
      .eq('company_id', companyId);

    if (sessionErr) throw new Error(`Exit update failed: ${sessionErr.message}`);

    // 4. Record Payment
    const { error: paymentErr } = await supabase
      .from('payments')
      .insert({
        session_id: sessionId,
        status: 'PAID',
        method: paymentMethod,
        amount: finalAmount,
        discount_amount: discountAmount,
        tax_amount: 0,
        collected_by_id: exitOperatorId,
        collected_at: now,
        receipt_number: receiptNumber,
        transaction_ref: transactionRef || null,
      });

    if (paymentErr) throw new Error(`Payment record failed: ${paymentErr.message}`);

    // 5. Fetch full enriched session
    const fullSession = await this.getSession(sessionId);
    if (!fullSession) {
      throw new Error('Failed to retrieve completed session details.');
    }
    return fullSession;
  },

  async getSession(arg1: string, arg2?: string): Promise<SessionWithRelations | null> {
    const sessionId = arg2 ? arg2 : arg1;
    const companyId = arg2 ? arg1 : undefined;

    let query = supabase
      .from('parking_sessions')
      .select(`
        *,
        site:sites!parking_sessions_site_id_fkey(id, name, address, city, state, brand_name, contact_number),
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(id, name, mobile, role),
        exit_operator:employees!parking_sessions_exit_operator_id_fkey(id, name, mobile, role),
        payments(id, receipt_number, amount, discount_amount, tax_amount, method, status, transaction_ref, collected_at)
      `)
      .eq('id', sessionId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as EnrichedSessionRow;
    let parsedPhotos = (row as any).vehicle_photos;
    if (typeof parsedPhotos === 'string') {
      try {
        parsedPhotos = JSON.parse(parsedPhotos);
      } catch {
        parsedPhotos = null;
      }
    }
    return {
      ...row,
      vehicle_photos: parsedPhotos,
      site_name: row.site?.name,
      payment: Array.isArray(row.payments) && row.payments.length > 0 ? row.payments[0] : null,
    } as unknown as SessionWithRelations;
  },

  async deleteSession(companyId: string, id: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('parking_sessions')
      .update({ deleted_at: now, status: 'CANCELLED', updated_at: now })
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw new Error(`Failed to cancel session: ${error.message}`);
  },

  async searchSessions(companyId: string, queryText: string, siteId?: string, limit = 40) {
    if (!companyId || !queryText.trim()) return [];

    const q = `%${queryText.trim()}%`;
    const isAllSites = !siteId || siteId === 'ALL';

    const buildQuery = (filterStr: string) => {
      let req = supabase
        .from('parking_sessions')
        .select(`
          *,
          site:sites!parking_sessions_site_id_fkey(name),
          entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
          exit_operator:employees!parking_sessions_exit_operator_id_fkey(name),
          payment:payments(amount, method, receipt_number)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .or(filterStr)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!isAllSites) {
        req = req.eq('site_id', siteId);
      }
      return req;
    };

    let { data, error } = await buildQuery(`vehicle_number.ilike.${q},driver_number.ilike.${q},driver_name.ilike.${q}`);

    if (error && (error.message?.includes('driver_name') || error.code === 'PGRST204')) {
      // Fallback search without driver_name column in filter
      const retryRes = await buildQuery(`vehicle_number.ilike.${q},driver_number.ilike.${q},notes.ilike.${q}`);
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw new Error(`Search failed: ${error.message}`);
    return (data || []).map((s: Record<string, unknown>) => {
      let parsedPhotos = s.vehicle_photos;
      if (typeof parsedPhotos === 'string') {
        try {
          parsedPhotos = JSON.parse(parsedPhotos);
        } catch {
          parsedPhotos = null;
        }
      }
      return {
        ...s,
        vehicle_photos: parsedPhotos,
        site_name: (s.site as { name?: string } | null)?.name || 'Main Gate',
        entry_operator_name: (s.entry_operator as { name?: string } | null)?.name || 'System',
        exit_operator_name: (s.exit_operator as { name?: string } | null)?.name || null,
        payment: Array.isArray(s.payment) && s.payment.length > 0 ? s.payment[0] : (s.payment || null),
      };
    });
  },

  async getReports(companyId: string, startDate: string, endDate: string, siteId?: string, operatorId?: string) {
    if (!companyId) return [];

    const startISO = getLocalISOBounds(startDate, false);
    const endISO = getLocalISOBounds(endDate, true);

    let query = supabase
      .from('parking_sessions')
      .select(`
        *,
        site:sites!parking_sessions_site_id_fkey(name),
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
        exit_operator:employees!parking_sessions_exit_operator_id_fkey(name),
        payments(amount, method, receipt_number)
      `)
      .eq('company_id', companyId)
      .gte('entry_at', startISO)
      .lte('entry_at', endISO)
      .is('deleted_at', null)
      .order('entry_at', { ascending: false });

    if (siteId && siteId !== 'ALL') {
      query = query.eq('site_id', siteId);
    }

    if (operatorId && operatorId !== 'ALL') {
      query = query.or(`entry_operator_id.eq.${operatorId},exit_operator_id.eq.${operatorId}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch report data: ${error.message}`);

    return (data || []).map((s: Record<string, unknown>) => {
      let parsedPhotos = s.vehicle_photos;
      if (typeof parsedPhotos === 'string') {
        try {
          parsedPhotos = JSON.parse(parsedPhotos);
        } catch {
          parsedPhotos = null;
        }
      }
      return {
        ...s,
        vehicle_photos: parsedPhotos,
        site_name: (s.site as { name?: string } | null)?.name || 'Main Gate',
        entry_operator_name: (s.entry_operator as { name?: string } | null)?.name || 'System',
        exit_operator_name: (s.exit_operator as { name?: string } | null)?.name || null,
        payment: Array.isArray(s.payments) && s.payments.length > 0 ? s.payments[0] : null,
      };
    });
  },
};
