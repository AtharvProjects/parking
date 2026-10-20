/**
 * Supabase-direct sessions service.
 * All reads/writes go directly to Supabase PostgREST tables.
 */
import { supabase } from '@/lib/supabase';
import type { ParkingSession, ActiveVehicle, VehicleType, SessionWithRelations } from '@/lib/database.types';
import { differenceInMinutes } from 'date-fns';
import { generateReceiptNumber, getLocalISOBounds } from '@/lib/formatters';

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
    return (data || []).map((s: any) => {
      const entryDate = new Date(s.entry_at);
      const elapsed = Math.max(0, differenceInMinutes(now, entryDate));
      const overstayHrs = s.site?.overstay_alert_hrs || 24;

      return {
        id: s.id,
        site_id: s.site_id,
        site_name: s.site?.name || '',
        vehicle_number: s.vehicle_number,
        vehicle_type: s.vehicle_type as VehicleType,
        driver_number: s.driver_number,
        driver_name: s.driver_name || null,
        notes: s.notes,
        entry_at: s.entry_at,
        entry_operator_name: s.entry_operator?.name || 'Unknown',
        elapsed_minutes: elapsed,
        is_overstaying: elapsed >= overstayHrs * 60,
        vehicle_photos: s.vehicle_photos,
      };
    });
  },

  async createEntry(data: {
    company_id: string;
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    driver_name?: string | null;
    notes?: string;
    vehicle_photos?: any;
    entry_operator_id: string;
  }): Promise<ParkingSession> {
    const cleanPlate = data.vehicle_number.trim().toUpperCase();

    // 1. Check duplicate active vehicle at this site
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

    // 2. Check site capacity
    const { data: site } = await supabase
      .from('sites')
      .select('total_slots, name')
      .eq('id', data.site_id)
      .maybeSingle();

    if (site) {
      const { count: activeCount } = await supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', data.site_id)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);

      if (activeCount !== null && activeCount >= site.total_slots) {
        throw new Error(`Site is at full capacity (${activeCount}/${site.total_slots} slots). Cannot accept more vehicles.`);
      }
    }

    // 3. Resolve rate card ID
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
      entry_operator_id: data.entry_operator_id,
      rate_card_id: rateCardId,
      status: 'ACTIVE',
    };

    let { data: session, error } = await supabase
      .from('parking_sessions')
      .insert(insertPayload)
      .select()
      .single();

    // Resilient fallback if driver_name column is missing in PostgREST schema cache
    if (error && (error.message?.includes('driver_name') || error.details?.includes('driver_name') || (error as any).code === 'PGRST204')) {
      const fallbackNotes = data.driver_name?.trim() 
        ? (data.notes ? `[Driver: ${data.driver_name.trim()}] ${data.notes}` : `Driver: ${data.driver_name.trim()}`)
        : (data.notes || null);
      
      const fallbackPayload = {
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
      if (session) {
        (session as any).driver_name = data.driver_name?.trim() || null;
      }
    }

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Vehicle ${cleanPlate} is already parked at this site.`);
      }
      throw new Error(`Entry failed: ${error.message}`);
    }

    return session as ParkingSession;
  },

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
    const { data: payment, error: paymentErr } = await supabase
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
      })
      .select()
      .single();

    if (paymentErr) throw new Error(`Payment record failed: ${paymentErr.message}`);

    // 5. Fetch full enriched session
    const fullSession = await this.getSession(sessionId);
    return fullSession as SessionWithRelations;
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

    const row = data as any;
    return {
      ...row,
      site_name: row.site?.name,
      payment: Array.isArray(row.payments) && row.payments.length > 0 ? row.payments[0] : null,
    } as any as SessionWithRelations;
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

    const buildQuery = (filterExpr: string) => {
      let qry = supabase
        .from('parking_sessions')
        .select(`
          *,
          site:sites!parking_sessions_site_id_fkey(name),
          entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
          exit_operator:employees!parking_sessions_exit_operator_id_fkey(name),
          payments(amount, discount_amount, status, receipt_number, method)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .or(filterExpr)
        .order('entry_at', { ascending: false })
        .limit(limit);

      if (!isAllSites) {
        qry = qry.eq('site_id', siteId);
      }
      return qry;
    };

    let { data, error } = await buildQuery(`vehicle_number.ilike.${q},driver_number.ilike.${q},driver_name.ilike.${q}`);
    
    if (error && (error.message?.includes('driver_name') || (error as any).code === 'PGRST204')) {
      // Fallback search without driver_name column in filter
      const retryRes = await buildQuery(`vehicle_number.ilike.${q},driver_number.ilike.${q},notes.ilike.${q}`);
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw new Error(`Search failed: ${error.message}`);

    return (data || []).map((row: any) => ({
      ...row,
      site_name: row.site?.name,
      entry_operator: row.entry_operator,
      exit_operator: row.exit_operator,
      payment: row.payments || [],
    }));
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
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(name, mobile, shift),
        exit_operator:employees!parking_sessions_exit_operator_id_fkey(name, mobile, shift),
        payments(amount, discount_amount, status, receipt_number, method, collected_by_id, collected_at)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('entry_at', startISO)
      .lte('entry_at', endISO)
      .order('entry_at', { ascending: false });

    if (siteId && siteId !== 'ALL') {
      query = query.eq('site_id', siteId);
    }

    if (operatorId && operatorId !== 'ALL') {
      query = query.or(`entry_operator_id.eq.${operatorId},exit_operator_id.eq.${operatorId}`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch reports: ${error.message}`);

    return (data || []).map((row: any) => ({
      ...row,
      site_name: row.site?.name,
      entry_operator: row.entry_operator,
      exit_operator: row.exit_operator,
      payment: row.payments || [],
    }));
  },
};
