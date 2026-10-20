/**
 * Supabase-direct dashboard service.
 * Computes live metrics directly using Supabase table queries with IST date calculations.
 */
import { supabase } from '@/lib/supabase';
import type { DashboardStats, VehicleType } from '@/lib/database.types';
import { getLocalISOBounds, getTodayDateString } from '@/lib/formatters';

export const supabaseDashboardService = {
  async getStats(companyId: string, siteId?: string): Promise<DashboardStats> {
    if (!companyId) {
      return emptyStats();
    }

    const isAllSites = !siteId || siteId === 'ALL' || siteId === '';

    // Calculate local IST day bounds
    const now = new Date();
    const todayStr = getTodayDateString(now);
    const todayStartISO = getLocalISOBounds(todayStr, false);
    const todayEndISO = getLocalISOBounds(todayStr, true);

    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getTodayDateString(yesterdayDate);
    const yesterdayStartISO = getLocalISOBounds(yesterdayStr, false);
    const yesterdayEndISO = getLocalISOBounds(yesterdayStr, true);

    try {
      // 1. Fetch site config (total slots, targets, overstay hrs)
      let totalSlots = 0;
      let dailyRevenueTarget = 10000;
      let overstayAlertHrs = 24;

      let siteQuery = supabase
        .from('sites')
        .select('id, total_slots, daily_revenue_target, overstay_alert_hrs')
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (!isAllSites) {
        siteQuery = siteQuery.eq('id', siteId);
      }

      const { data: sitesData } = await siteQuery;
      if (sitesData && sitesData.length > 0) {
        if (isAllSites) {
          totalSlots = sitesData.reduce((acc, s) => acc + (s.total_slots || 0), 0);
          dailyRevenueTarget = sitesData.reduce((acc, s) => acc + (s.daily_revenue_target || 0), 0);
          overstayAlertHrs = 24;
        } else {
          totalSlots = sitesData[0].total_slots || 0;
          dailyRevenueTarget = sitesData[0].daily_revenue_target || 10000;
          overstayAlertHrs = sitesData[0].overstay_alert_hrs || 24;
        }
      }

      // 2. Active Vehicles count
      let activeQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);

      if (!isAllSites) {
        activeQuery = activeQuery.eq('site_id', siteId);
      }
      const { count: activeCount } = await activeQuery;
      const activeVehicles = activeCount || 0;

      // 3. Today's entries
      let todayEntriesQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', todayStartISO)
        .lte('entry_at', todayEndISO);

      if (!isAllSites) {
        todayEntriesQuery = todayEntriesQuery.eq('site_id', siteId);
      }
      const { count: todayEntriesCount } = await todayEntriesQuery;
      const todayVehicleCount = todayEntriesCount || 0;

      // 4. Yesterday's entries
      let yestEntriesQuery = supabase
        .from('parking_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', yesterdayStartISO)
        .lte('entry_at', yesterdayEndISO);

      if (!isAllSites) {
        yestEntriesQuery = yestEntriesQuery.eq('site_id', siteId);
      }
      const { count: yestEntriesCount } = await yestEntriesQuery;
      const yesterdayVehicleCount = yestEntriesCount || 0;

      // 5. Today's Revenue (via payments joined to parking_sessions)
      let todayRevQuery = supabase
        .from('payments')
        .select('amount, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', todayStartISO)
        .lte('collected_at', todayEndISO);

      if (!isAllSites) {
        todayRevQuery = todayRevQuery.eq('session.site_id', siteId);
      }
      const { data: todayPayments } = await todayRevQuery;
      const todayRevenue = (todayPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      // 6. Yesterday's Revenue
      let yestRevQuery = supabase
        .from('payments')
        .select('amount, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', yesterdayStartISO)
        .lte('collected_at', yesterdayEndISO);

      if (!isAllSites) {
        yestRevQuery = yestRevQuery.eq('session.site_id', siteId);
      }
      const { data: yestPayments } = await yestRevQuery;
      const yesterdayRevenue = (yestPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      // 7. Completed sessions today (for avg duration, breakdown, peak hours)
      let todaySessionsQuery = supabase
        .from('parking_sessions')
        .select('entry_at, exit_at, duration_minutes, vehicle_type, status')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .gte('entry_at', todayStartISO)
        .lte('entry_at', todayEndISO);

      if (!isAllSites) {
        todaySessionsQuery = todaySessionsQuery.eq('site_id', siteId);
      }
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
          const entryDate = new Date(s.entry_at);
          const hr = entryDate.getHours();
          peakHoursMap[hr] = (peakHoursMap[hr] || 0) + 1;
        }
      }

      const avgDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;
      const vehicleTypeBreakdown = Object.entries(typeMap).map(([type, count]) => ({
        type: type as VehicleType,
        count,
        revenue: 0,
      }));

      const peakHours = Object.entries(peakHoursMap)
        .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
        .sort((a, b) => b.count - a.count);

      // 8. Overstaying count (active vehicles with duration >= overstayAlertHrs)
      let overstayQuery = supabase
        .from('parking_sessions')
        .select('entry_at')
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .is('deleted_at', null);

      if (!isAllSites) {
        overstayQuery = overstayQuery.eq('site_id', siteId);
      }
      const { data: activeList } = await overstayQuery;
      const overstayThresholdMs = overstayAlertHrs * 60 * 60 * 1000;
      const overstayingCount = (activeList || []).filter((s) => {
        return (now.getTime() - new Date(s.entry_at).getTime()) >= overstayThresholdMs;
      }).length;

      return {
        total_slots: totalSlots,
        active_vehicles: activeVehicles,
        today_revenue: todayRevenue,
        yesterday_revenue: yesterdayRevenue,
        today_vehicle_count: todayVehicleCount,
        yesterday_vehicle_count: yesterdayVehicleCount,
        avg_duration_minutes: avgDuration,
        daily_revenue_target: dailyRevenueTarget,
        overstaying_count: overstayingCount,
        vehicle_type_breakdown: vehicleTypeBreakdown,
        revenue_by_day: [],
        peak_hours: peakHours,
      };
    } catch (err) {
      console.error('Error computing dashboard stats:', err);
      return emptyStats();
    }
  },

  async getRevenueChart(companyId: string, siteId?: string, days: number = 7) {
    if (!companyId) return [];

    const isAllSites = !siteId || siteId === 'ALL' || siteId === '';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      let query = supabase
        .from('payments')
        .select('amount, collected_at, session:parking_sessions!inner(company_id, site_id)')
        .eq('session.company_id', companyId)
        .eq('status', 'PAID')
        .gte('collected_at', startDate.toISOString());

      if (!isAllSites) {
        query = query.eq('session.site_id', siteId);
      }

      const { data } = await query;
      const byDate: Record<string, number> = {};

      for (const p of (data || [])) {
        if (!p.collected_at) continue;
        const dateKey = p.collected_at.slice(0, 10);
        byDate[dateKey] = (byDate[dateKey] || 0) + (p.amount || 0);
      }

      return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue }));
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
