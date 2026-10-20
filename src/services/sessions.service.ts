/**
 * Sessions Service — Thin adapter using Supabase-direct operations.
 */
import { supabaseSessionsService } from '@/services/supabase-sessions.service';
import type { ParkingSession, ActiveVehicle, VehicleType, SessionWithRelations } from '@/lib/database.types';

function getCompanyId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('company_id') || '00000000-0000-0000-0000-000000000000'
    : '00000000-0000-0000-0000-000000000000';
}

export const sessionsService = {
  async getActiveSessions(siteId?: string): Promise<ActiveVehicle[]> {
    return supabaseSessionsService.getActiveSessions(getCompanyId(), siteId);
  },

  async createEntry(data: {
    site_id: string;
    vehicle_number: string;
    vehicle_type: VehicleType;
    driver_number: string;
    driver_name?: string | null;
    notes?: string;
    vehicle_photos?: any;
    entry_operator_id: string;
  }): Promise<ParkingSession> {
    return supabaseSessionsService.createEntry({
      company_id: getCompanyId(),
      ...data,
    });
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
    return supabaseSessionsService.processExit(
      getCompanyId(),
      sessionId,
      exitOperatorId,
      paymentMethod,
      grossAmount,
      durationMinutes,
      discountAmount,
      transactionRef
    );
  },

  async getSession(sessionId: string): Promise<SessionWithRelations | null> {
    return supabaseSessionsService.getSession(getCompanyId(), sessionId);
  },

  async deleteSession(sessionId: string): Promise<void> {
    return supabaseSessionsService.deleteSession(getCompanyId(), sessionId);
  },

  async searchSessions(queryText: string, siteId?: string): Promise<any[]> {
    return supabaseSessionsService.searchSessions(getCompanyId(), queryText, siteId);
  },

  async getReports(startDate: string, endDate: string, siteId?: string, operatorId?: string): Promise<any[]> {
    return supabaseSessionsService.getReports(getCompanyId(), startDate, endDate, siteId, operatorId);
  },
};
