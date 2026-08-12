import { getDB } from '@/database/connection';
import type { DashboardStats } from '@/lib/database.types';
import { getLocalISOBounds, getTodayDateString } from '@/lib/formatters';

export class DashboardRepository {
  static async getStats(companyId: string, siteId?: string): Promise<DashboardStats> {
    const db = await getDB();
    const isAllSites = !siteId || siteId === 'ALL';
    
    // Time calculations using local day boundaries
    const now = new Date();
    const todayStr = getTodayDateString(now);
    const todayStartISO = getLocalISOBounds(todayStr, false);
    const todayEndISO = getLocalISOBounds(todayStr, true);

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getTodayDateString(yesterdayDate);
    const yesterdayStartISO = getLocalISOBounds(yesterdayStr, false);
    const yesterdayEndISO = getLocalISOBounds(yesterdayStr, true);
    
    // 1. Site Config (capacity & targets)
    let totalSlots = 0;
    let dailyRevenueTarget = 10000;
    let overstayAlertHrs = 24;

    if (isAllSites) {
      const siteQuery = await db.query(
        `SELECT SUM(total_slots) as total_slots, SUM(daily_revenue_target) as daily_target FROM sites WHERE company_id = ? AND deleted_at IS NULL`,
        [companyId]
      );
      totalSlots = siteQuery.values?.[0]?.total_slots || 0;
      dailyRevenueTarget = siteQuery.values?.[0]?.daily_target || 10000;
    } else {
      const siteQuery = await db.query(
        `SELECT total_slots, daily_revenue_target, overstay_alert_hrs FROM sites WHERE id = ? AND company_id = ?`,
        [siteId, companyId]
      );
      const siteData = siteQuery.values?.[0];
      if (siteData) {
        totalSlots = siteData.total_slots || 0;
        dailyRevenueTarget = siteData.daily_revenue_target || 10000;
        overstayAlertHrs = siteData.overstay_alert_hrs || 24;
      }
    }
    
    // 2. Active Vehicles (Occupancy)
    let activeQueryStr = `SELECT COUNT(*) as c FROM parking_sessions WHERE company_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL`;
    const activeParams: any[] = [companyId];
    if (!isAllSites) {
      activeQueryStr += ` AND site_id = ?`;
      activeParams.push(siteId);
    }
    const activeQuery = await db.query(activeQueryStr, activeParams);
    const occupiedSlots = activeQuery.values?.[0]?.c || 0;
    
    // 3. Today's Revenue
    let todayRevQueryStr = `
      SELECT SUM(p.amount) as total_revenue
      FROM payments p
      JOIN parking_sessions s ON p.session_id = s.id
      WHERE s.company_id = ? AND p.status = 'PAID' AND p.created_at >= ? AND p.created_at <= ?
    `;
    const todayRevParams: any[] = [companyId, todayStartISO, todayEndISO];
    if (!isAllSites) {
      todayRevQueryStr += ` AND s.site_id = ?`;
      todayRevParams.push(siteId);
    }
    const todayRevQuery = await db.query(todayRevQueryStr, todayRevParams);
    const todaysRevenue = todayRevQuery.values?.[0]?.total_revenue || 0;

    // 4. Yesterday's Revenue
    let yestRevQueryStr = `
      SELECT SUM(p.amount) as total_revenue
      FROM payments p
      JOIN parking_sessions s ON p.session_id = s.id
      WHERE s.company_id = ? AND p.status = 'PAID' AND p.created_at >= ? AND p.created_at <= ?
    `;
    const yestRevParams: any[] = [companyId, yesterdayStartISO, yesterdayEndISO];
    if (!isAllSites) {
      yestRevQueryStr += ` AND s.site_id = ?`;
      yestRevParams.push(siteId);
    }
    const yestRevQuery = await db.query(yestRevQueryStr, yestRevParams);
    const yesterdaysRevenue = yestRevQuery.values?.[0]?.total_revenue || 0;

    // 5. Today's Vehicle Entries
    let todayEntriesQueryStr = `SELECT COUNT(*) as c FROM parking_sessions WHERE company_id = ? AND deleted_at IS NULL AND entry_at >= ? AND entry_at <= ?`;
    const todayEntriesParams: any[] = [companyId, todayStartISO, todayEndISO];
    if (!isAllSites) {
      todayEntriesQueryStr += ` AND site_id = ?`;
      todayEntriesParams.push(siteId);
    }
    const todayEntriesQuery = await db.query(todayEntriesQueryStr, todayEntriesParams);
    const todayEntries = todayEntriesQuery.values?.[0]?.c || 0;

    // 6. Yesterday's Vehicle Entries
    let yestEntriesQueryStr = `SELECT COUNT(*) as c FROM parking_sessions WHERE company_id = ? AND deleted_at IS NULL AND entry_at >= ? AND entry_at <= ?`;
    const yestEntriesParams: any[] = [companyId, yesterdayStartISO, yesterdayEndISO];
    if (!isAllSites) {
      yestEntriesQueryStr += ` AND site_id = ?`;
      yestEntriesParams.push(siteId);
    }
    const yestEntriesQuery = await db.query(yestEntriesQueryStr, yestEntriesParams);
    const yesterdayEntries = yestEntriesQuery.values?.[0]?.c || 0;

    // 7. Average Duration (for completed sessions today)
    let durationQueryStr = `SELECT AVG(duration_minutes) as avg_duration FROM parking_sessions WHERE company_id = ? AND status = 'COMPLETED' AND deleted_at IS NULL AND exit_at >= ? AND exit_at <= ?`;
    const durationParams: any[] = [companyId, todayStartISO, todayEndISO];
    if (!isAllSites) {
      durationQueryStr += ` AND site_id = ?`;
      durationParams.push(siteId);
    }
    const durationQuery = await db.query(durationQueryStr, durationParams);
    const avgDuration = Math.round(durationQuery.values?.[0]?.avg_duration || 0);

    // 8. Overstaying Count
    let overstayQueryStr = `
      SELECT COUNT(*) as c FROM parking_sessions 
      WHERE company_id = ? AND status = 'ACTIVE' AND deleted_at IS NULL
      AND (julianday(?) - julianday(entry_at)) * 24 >= ?
    `;
    const overstayParams: any[] = [companyId, now.toISOString(), overstayAlertHrs];
    if (!isAllSites) {
      overstayQueryStr += ` AND site_id = ?`;
      overstayParams.push(siteId);
    }
    const overstayQuery = await db.query(overstayQueryStr, overstayParams);
    const overstayCount = overstayQuery.values?.[0]?.c || 0;

    // 9. Vehicle Type Breakdown (Today)
    let breakdownQueryStr = `
      SELECT vehicle_type, COUNT(*) as count 
      FROM parking_sessions 
      WHERE company_id = ? AND deleted_at IS NULL AND entry_at >= ? AND entry_at <= ?
    `;
    const breakdownParams: any[] = [companyId, todayStartISO, todayEndISO];
    if (!isAllSites) {
      breakdownQueryStr += ` AND site_id = ?`;
      breakdownParams.push(siteId);
    }
    breakdownQueryStr += ` GROUP BY vehicle_type`;
    const breakdownQuery = await db.query(breakdownQueryStr, breakdownParams);
    const breakdown = (breakdownQuery.values || []).map((r: any) => ({
      type: r.vehicle_type,
      count: r.count
    }));

    // 10. Peak Hours (Today)
    let peakQueryStr = `
      SELECT substr(entry_at, 12, 2) as hour, COUNT(*) as count 
      FROM parking_sessions 
      WHERE company_id = ? AND deleted_at IS NULL AND entry_at >= ? AND entry_at <= ?
    `;
    const peakParams: any[] = [companyId, todayStartISO, todayEndISO];
    if (!isAllSites) {
      peakQueryStr += ` AND site_id = ?`;
      peakParams.push(siteId);
    }
    peakQueryStr += ` GROUP BY hour ORDER BY count DESC`;
    const peakQuery = await db.query(peakQueryStr, peakParams);
    const peakHours = (peakQuery.values || []).map((r: any) => ({
      hour: r.hour,
      count: r.count
    }));

    // 11. Revenue Chart (7 days)
    const chartData = await this.getRevenueChart(companyId, siteId, 7);

    return {
      total_slots: totalSlots,
      active_vehicles: occupiedSlots,
      today_revenue: todaysRevenue,
      yesterday_revenue: yesterdaysRevenue,
      today_vehicle_count: todayEntries,
      yesterday_vehicle_count: yesterdayEntries,
      avg_duration_minutes: avgDuration,
      daily_revenue_target: dailyRevenueTarget,
      overstaying_count: overstayCount,
      vehicle_type_breakdown: breakdown,
      revenue_by_day: chartData,
      peak_hours: peakHours
    } as DashboardStats;
  }

  static async getRevenueChart(companyId: string, siteId?: string, days: number = 7) {
    const db = await getDB();
    const isAllSites = !siteId || siteId === 'ALL';
    let query = `
      SELECT substr(p.created_at, 1, 10) as date, SUM(p.amount) as revenue
      FROM payments p
      JOIN parking_sessions s ON p.session_id = s.id
      WHERE s.company_id = ? AND p.status = 'PAID'
    `;
    const params: any[] = [companyId];
    if (!isAllSites) {
      query += ` AND s.site_id = ?`;
      params.push(siteId);
    }
    query += ` GROUP BY substr(p.created_at, 1, 10) ORDER BY date DESC LIMIT ?`;
    params.push(days);

    const result = await db.query(query, params);
    
    return (result.values || []).reverse().map((r: any) => ({
      date: r.date,
      revenue: r.revenue,
    }));
  }
}
