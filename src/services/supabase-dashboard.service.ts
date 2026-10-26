/**
 * Supabase-direct dashboard service.
 *
 * CHANGES (Phase D):
 * - getStats() now uses rpc_dashboard_stats RPC for a single DB round trip instead of 8+ queries
 * - getRevenueChart() date grouping now uses IST timezone for correct day attribution
 */
import { supabase } from '@/lib/supabase';
import type { DashboardStats } from '@/lib/database.types';
import { formatInTimeZone } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

export const supabaseDashboardService = {
  async getStats(companyId: string, siteId?: string): Promise<DashboardStats> {
    if (!companyId) {
      return emptyStats();
    }

    const effectiveSiteId = (!siteId || siteId === 'ALL' || siteId === '') ? null : siteId;

    try {
      const { data: rpcResult, error } = await supabase.rpc('rpc_dashboard_stats', {
        p_company_id: companyId,
        p_site_id: effectiveSiteId,
      });

      if (error) {
        // RPC not available (e.g. migration not yet run) — fall back to multi-query
        console.warn('[Dashboard] rpc_dashboard_stats unavailable, using fallback:', error.message);
        return this.getStatsFallback(companyId, siteId);
      }

      const r = rpcResult as any;
      if (!r) return this.getStatsFallback(companyId, siteId);

      // Map RPC result to DashboardStats shape
      return {
        total_slots: r.total_slots ?? 0,
        active_vehicles: r.active_vehicles ?? 0,
        today_revenue: r.today_revenue ?? 0,
        yesterday_revenue: r.yesterday_revenue ?? 0,
        today_vehicle_count: r.today_vehicle_count ?? 0,
        yesterday_vehicle_count: r.yesterday_vehicle_count ?? 0,
        avg_duration_minutes: r.avg_duration_minutes ?? 0,
        daily_revenue_target: r.daily_revenue_target ?? 0,
        overstaying_count: r.overstaying_count ?? 0,
        vehicle_type_breakdown: r.vehicle_type_breakdown ?? [],
        revenue_by_day: r.revenue_by_day ?? [],
        peak_hours: r.peak_hours ?? [],
      } as DashboardStats;
    } catch (err) {
      console.error('Error computing dashboard stats:', err);
      return emptyStats();
    }
  },

  /**
   * Fallback implementation when rpc_dashboard_stats RPC is unavailable.
   * Uses multiple queries — less efficient but functionally correct.
   */
  async getStatsFallback(companyId: string, siteId?: string): Promise<DashboardStats> {
    const { getLocalISOBounds, getTodayDateString } = await import('@/lib/formatters');

    const isAllSites = !siteId || siteId === 'ALL' || siteId === '';

    const now = new Date();
    const todayStr = getTodayDateString(now);
    const todayStartISO = getLocalISOBounds(todayStr, false);
    const todayEndISO = getLocalISOBounds(todayStr, true);

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getTodayDateString(yesterdayDate);
    const yesterdayStartISO = getLocalISOBounds(yesterdayStr, false);
    const yesterdayEndISO = getLocalISOBounds(yesterdayStr, true);

    try {
      let totalSlots = 0;
      let dailyRevenueTarget = 10000;
      let overstayAlertHrs = 24;

      let siteQuery = supabase
        .from('sites')
        .select('id, total_slots, daily_revenue_target, overstay_alert_hrs')
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (!isAllSites) siteQuery = siteQuery.eq('id', siteId);

      const { data: sitesData } = await siteQuery;
      if (sitesData && sitesData.length > 0) {
        if (isAllSites) {
          totalSlots = sitesData.reduce((acc, s) => acc + (s.total_slots || 0), 0);
          dailyRevenueTarget = sitesData.reduce((acc, s) => acc + (s.daily_revenue_target || 0), 0);
        } else {
          totalSlots = sitesData[0].total_slots || 0;
          dailyRevenueTarget = sitesData[0].daily_revenue_target || 10000;
          overstayAlertHrs = sitesData[0].overstay_alert_hrs || 24;
        }
      }

      let activeQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);
      if (!isAllSites) activeQuery = activeQuery.eq('site_id', siteId);
      const { count: activeCount } = await activeQuery;

      let todayEntriesQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', todayStartISO)
        .lte('entry_at', todayEndISO);
      if (!isAllSites) todayEntriesQuery = todayEntriesQuery.eq('site_id', siteId);
      const { count: todayEntriesCount } = await todayEntriesQuery;

      let yestEntriesQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', yesterdayStartISO)
        .lte('entry_at', yesterdayEndISO);
      if (!isAllSites) yestEntriesQuery = yestEntriesQuery.eq('site_id', siteId);
      const { count: yestEntriesCount } = await yestEntriesQuery;

      let todayRevQuery = supabase
        .from('payments')
        .select('amount, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', todayStartISO)
        .lte('collected_at', todayEndISO);
      if (!isAllSites) todayRevQuery = todayRevQuery.eq('session.site_id', siteId);
      const { data: todayPayments } = await todayRevQuery;
      const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      let yestRevQuery = supabase
        .from('payments')
        .select('amount, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', yesterdayStartISO)
        .lte('collected_at', yesterdayEndISO);
      if (!isAllSites) yestRevQuery = yestRevQuery.eq('session.site_id', siteId);
      const { data: yestPayments } = await yestRevQuery;
      const yesterdayRevenue = (yestPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      let todaySessionsQuery = supabase
        .from('parking_sessions')
        .select('entry_at, exit_at, duration_minutes, vehicle_type, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', todayStartISO)
        .lte('entry_at', todayEndISO);
      if (!isAllSites) todaySessionsQuery = todaySessionsQuery.eq('site_id', siteId);
      const { data: todaySessions } = await todaySessionsQuery;

      let totalDuration = 0;
      let completedCount = 0;
      const typeMap: Record<string, number> = { TRAILOR: 0, BODY_VEHICLE: 0, EICHER: 0 };
      const peakHoursMap: Record<number, number> = {};

      for (const s of (todaySessions || [])) {
        if (s.status === 'COMPLETED' && s.duration_minutes) {
          totalDuration += s.duration_minutes;
          completedCount++;
        }
        if (s.vehicle_type) {
          typeMap[s.vehicle_type] = (typeMap[s.vehicle_type] || 0) + 1;
        }
        if (s.entry_at) {
          const hr = new Date(s.entry_at).getHours();
          peakHoursMap[hr] = (peakHoursMap[hr] || 0) + 1;
        }
      }

      const avgDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
      const vehicleTypeBreakdown = Object.entries(typeMap).map(([type, count]) => ({ type, count, revenue: 0 }));
      const peakHours = Object.entries(peakHoursMap)
        .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
        .sort((a, b) => b.count - a.count);

      let overstayQuery = supabase
        .from('parking_sessions')
        .select('entry_at')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);
      if (!isAllSites) overstayQuery = overstayQuery.eq('site_id', siteId);
      const { data: activeList } = await overstayQuery;
      const overstayThresholdMs = overstayAlertHrs * 60 * 60 * 1000;
      const overstayingCount = (activeList || []).filter(s =>
        (now.getTime() - new Date(s.entry_at).getTime()) >= overstayThresholdMs
      ).length;

      return {
        total_slots: totalSlots,
        active_vehicles: activeCount || 0,
        today_revenue: todayRevenue,
        yesterday_revenue: yesterdayRevenue,
        today_vehicle_count: todayEntriesCount || 0,
        yesterday_vehicle_count: yestEntriesCount || 0,
        avg_duration_minutes: avgDuration,
        daily_revenue_target: dailyRevenueTarget,
        overstaying_count: overstayingCount,
        vehicle_type_breakdown: vehicleTypeBreakdown as any,
        revenue_by_day: [],
        peak_hours: peakHours,
      };
    } catch (err) {
      console.error('Fallback dashboard error:', err);
      return emptyStats();
    }
  },

  async getRevenueChart(companyId: string, siteId?: string, days: number = 7): Promise<{ date: string; revenue: number; count: number }[]> {
    if (!companyId) return [];

    const isAllSites = !siteId || siteId === 'ALL' || siteId === '';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    try {
      // 1. Fetch payments for daily revenue
      let paymentsQuery = supabase
        .from('payments')
        .select('amount, collected_at, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', startDate.toISOString());

      if (!isAllSites) {
        paymentsQuery = paymentsQuery.eq('session.site_id', siteId);
      }

      // 2. Fetch parking sessions for daily vehicle counts
      let sessionsQuery = supabase
        .from('parking_sessions')
        .select('id, entry_at')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', startDate.toISOString());

      if (!isAllSites) {
        sessionsQuery = sessionsQuery.eq('site_id', siteId);
      }

      const [{ data: payments }, { data: sessions }] = await Promise.all([
        paymentsQuery,
        sessionsQuery,
      ]);

      const revByDate: Record<string, number> = {};
      const countByDate: Record<string, number> = {};

      for (const p of (payments || [])) {
        if (!p.collected_at) continue;
        const dateKey = formatInTimeZone(new Date(p.collected_at), IST, 'yyyy-MM-dd');
        revByDate[dateKey] = (revByDate[dateKey] || 0) + (p.amount || 0);
      }

      for (const s of (sessions || [])) {
        if (!s.entry_at) continue;
        const dateKey = formatInTimeZone(new Date(s.entry_at), IST, 'yyyy-MM-dd');
        countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;
      }

      // Generate sequence of dates from (today - days + 1) up to today
      const results: { date: string; revenue: number; count: number }[] = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const iso = formatInTimeZone(d, IST, 'yyyy-MM-dd');
        results.push({
          date: iso,
          revenue: revByDate[iso] || 0,
          count: countByDate[iso] || 0,
        });
      }

      return results;
    } catch (err) {
      console.error('Revenue chart error:', err);
      return [];
    }
  },
};

function emptyStats(): DashboardStats {
  return {
    total_slots: 0,
    active_vehicles: 0,
    today_revenue: 0,
    yesterday_revenue: 0,
    today_vehicle_count: 0,
    yesterday_vehicle_count: 0,
    avg_duration_minutes: 0,
    daily_revenue_target: 0,
    overstaying_count: 0,
    vehicle_type_breakdown: [],
    revenue_by_day: [],
    peak_hours: [],
  };
}
