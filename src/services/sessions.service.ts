import { SessionRepository } from '@/database/repositories/SessionRepository';
import type { ParkingSession, SessionWithRelations, ActiveVehicle, VehicleType } from '@/lib/database.types';

export const sessionsService = {
  get companyId() {
    return localStorage.getItem('company_id') || '';
  },

  async getActiveSessions(siteId?: string): Promise<ActiveVehicle[]> {
    return SessionRepository.getActiveSessions(this.companyId, siteId);
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
    return SessionRepository.createEntry({
      id: crypto.randomUUID(),
      company_id: this.companyId,
      site_id: data.site_id,
      vehicle_number: data.vehicle_number,
      vehicle_type: data.vehicle_type,
      driver_number: data.driver_number,
      notes: data.notes,
      vehicle_photos: data.vehicle_photos,
      entry_operator_id: data.entry_operator_id,
      rate_card_id: null, // Ideally we resolve rate card ID here from RateRepository
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
    return SessionRepository.processExit(
      this.companyId,
      sessionId,
      exitOperatorId,
      paymentMethod,
      grossAmount,
      durationMinutes,
      discountAmount,
      transactionRef
    );
  },

  async getSession(id: string): Promise<SessionWithRelations | null> {
    return SessionRepository.getSession(this.companyId, id);
  },

  async deleteSession(id: string) {
    return SessionRepository.deleteSession(this.companyId, id);
  },

  async searchSessions(query: string, siteId?: string, limit = 40) {
    return SessionRepository.searchSessions(this.companyId, query, siteId, limit);
  },


  async getReports(startDate: string, endDate: string, siteId?: string, companyId?: string) {
    const targetCompanyId = companyId || this.companyId;
    return SessionRepository.getReports(targetCompanyId, startDate, endDate, siteId);
  },
};
