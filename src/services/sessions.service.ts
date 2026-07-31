import { supabase } from '@/lib/supabase';
import type { ParkingSession, SessionWithRelations, ActiveVehicle, VehicleType } from '@/lib/database.types';
import { differenceInMinutes } from 'date-fns';

export const sessionsService = {
  async getActiveSessions(siteId?: string): Promise<ActiveVehicle[]> {
    let query = supabase
      .from('parking_sessions')
      .select('*, entry_operator:employees!parking_sessions_entry_operator_id_fkey(name)')
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .order('entry_at', { ascending: false });

    if (siteId && siteId !== 'ALL') {
      query = query.eq('site_id', siteId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const now = new Date();
    return (data || []).map((s: any) => {
      const entryDate = new Date(s.entry_at);
      const elapsed = Math.max(0, differenceInMinutes(now, entryDate));
      return {
        id: s.id,
        vehicle_number: s.vehicle_number,
        vehicle_type: s.vehicle_type as VehicleType,
        driver_number: s.driver_number,
        notes: s.notes,
        entry_at: s.entry_at,
        entry_operator_name: s.entry_operator?.name || 'Unknown',
        elapsed_minutes: elapsed,
        is_overstaying: elapsed >= 24 * 60,
        vehicle_photos: s.vehicle_photos,
      };
    });
  },

  async createEntry(data: {
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    notes?: string;
    vehicle_photos?: { front?: string; rear?: string };
    entry_operator_id: string;
  }): Promise<ParkingSession> {
    // Check for duplicate active vehicle
    const { data: existing } = await supabase
      .from('parking_sessions')
      .select('id')
      .eq('vehicle_number', data.vehicle_number.toUpperCase().replace(/[\s-]+/g, ''))
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      throw new Error(`Vehicle ${data.vehicle_number} is already parked`);
    }

    // Find active rate card
    const { data: rateCard } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('site_id', data.site_id)
      .eq('vehicle_type', data.vehicle_type)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: session, error } = await supabase
      .from('parking_sessions')
      .insert({
        ...data,
        vehicle_number: data.vehicle_number.toUpperCase().replace(/[\s-]+/g, ''),
        rate_card_id: rateCard?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  },

  async processExit(
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

    // Update session
    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .update({
        exit_at: now,
        exit_operator_id: exitOperatorId,
        duration_minutes: durationMinutes,
        gross_amount: grossAmount,
        status: 'COMPLETED',
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Generate receipt number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().slice(0, 10));
    const seq = String((count || 0) + 1).padStart(4, '0');
    const receiptNumber = `TEP-${dateStr}-${seq}`;

    // Create payment
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        session_id: sessionId,
        status: 'PAID',
        method: paymentMethod,
        amount: finalAmount,
        discount_amount: discountAmount,
        collected_by_id: exitOperatorId,
        collected_at: now,
        receipt_number: receiptNumber,
        transaction_ref: transactionRef,
      });

    if (paymentError) throw paymentError;

    return session as SessionWithRelations;
  },

  async getSession(id: string): Promise<SessionWithRelations | null> {
    const { data, error } = await supabase
      .from('parking_sessions')
      .select(`
        *,
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(name, mobile),
        exit_operator:employees!parking_sessions_exit_operator_id_fkey(name, mobile),
        rate_card:rate_cards(*),
        payment:payments(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as SessionWithRelations | null;
  },

  async deleteSession(id: string) {
    const { error } = await supabase
      .from('parking_sessions')
      .update({ deleted_at: new Date().toISOString(), status: 'CANCELLED' })
      .eq('id', id);
    if (error) throw error;
  },

  async searchSessions(query: string, limit = 20) {
    const { data, error } = await supabase
      .from('parking_sessions')
      .select(`
        *,
        entry_operator:employees!parking_sessions_entry_operator_id_fkey(name),
        payment:payments(amount, status, receipt_number, method)
      `)
      .is('deleted_at', null)
      .or(`vehicle_number.ilike.%${query}%,driver_number.ilike.%${query}%`)
      .order('entry_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
