import { supabase } from '@/lib/supabase';
import type { DashboardStats, VehicleType } from '@/lib/database.types';
import { startOfDay, endOfDay, subDays, differenceInMinutes, format } from 'date-fns';

export const dashboardService = {
  async getStats(siteId?: string): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();

    // Get site config
    let siteQuery = supabase.from('sites').select('*');
    if (siteId && siteId !== 'ALL') siteQuery = siteQuery.eq('id', siteId);
    const { data: sites } = await siteQuery.limit(1).single();
    const totalSlots = sites?.total_slots || 100;
    const dailyTarget = sites?.daily_revenue_target || 1500000;

    // Build base filter
    const buildFilter = (q: any) => {
      let filtered = q.is('deleted_at', null);
      if (siteId && siteId !== 'ALL') filtered = filtered.eq('site_id', siteId);
      return filtered;
    };

    // Today's completed sessions
    const { data: todaySessions } = await buildFilter(
      supabase.from('parking_sessions').select('gross_amount, vehicle_type, entry_at, duration_minutes')
    )
      .eq('status', 'COMPLETED')
      .gte('exit_at', todayStart)
      .lte('exit_at', todayEnd);

    // Yesterday's completed sessions
    const { data: yesterdaySessions } = await buildFilter(
      supabase.from('parking_sessions').select('gross_amount')
    )
      .eq('status', 'COMPLETED')
      .gte('exit_at', yesterdayStart)
      .lte('exit_at', yesterdayEnd);

    // Active vehicles count
    const { count: activeCount } = await buildFilter(
      supabase.from('parking_sessions').select('*', { count: 'exact', head: true })
    ).eq('status', 'ACTIVE');

    // Overstaying count (active > 24hrs)
    const overstayThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: overstayCount } = await buildFilter(
      supabase.from('parking_sessions').select('*', { count: 'exact', head: true })
    ).eq('status', 'ACTIVE').lt('entry_at', overstayThreshold);

    // Today's all entries (for count and peak hours)
    const { data: todayEntries } = await buildFilter(
      supabase.from('parking_sessions').select('entry_at, vehicle_type')
    )
      .gte('entry_at', todayStart)
      .lte('entry_at', todayEnd);

    // Revenue by day (last 7 days)
    const revenueByDay: { date: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day).toISOString();
      const dayEnd = endOfDay(day).toISOString();

      const { data: daySessions } = await buildFilter(
        supabase.from('parking_sessions').select('gross_amount')
      )
        .eq('status', 'COMPLETED')
        .gte('exit_at', dayStart)
        .lte('exit_at', dayEnd);

      const dayRevenue = (daySessions || []).reduce((sum, s) => sum + (s.gross_amount || 0), 0);
      revenueByDay.push({
        date: format(day, 'yyyy-MM-dd'),
        revenue: dayRevenue,
        count: (daySessions || []).length,
      });
    }

    // Compute aggregates
    const todayRevenue = (todaySessions || []).reduce((sum, s) => sum + (s.gross_amount || 0), 0);
    const yesterdayRevenue = (yesterdaySessions || []).reduce((sum, s) => sum + (s.gross_amount || 0), 0);

    const durations = (todaySessions || []).filter(s => s.duration_minutes).map(s => s.duration_minutes!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    // Vehicle type breakdown
    const typeMap = new Map<VehicleType, { count: number; revenue: number }>();
    for (const s of todaySessions || []) {
      const entry = typeMap.get(s.vehicle_type as VehicleType) || { count: 0, revenue: 0 };
      entry.count++;
      entry.revenue += s.gross_amount || 0;
      typeMap.set(s.vehicle_type as VehicleType, entry);
    }
    const vehicleTypeBreakdown = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      ...data,
    }));

    // Peak hours
    const hourMap = new Map<number, number>();
    for (const s of todayEntries || []) {
      const hour = new Date(s.entry_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }
    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    return {
      today_revenue: todayRevenue,
      yesterday_revenue: yesterdayRevenue,
      today_vehicle_count: (todayEntries || []).length,
      yesterday_vehicle_count: (yesterdaySessions || []).length,
      active_vehicles: activeCount || 0,
      avg_duration_minutes: avgDuration,
      daily_revenue_target: dailyTarget,
      total_slots: totalSlots,
      overstaying_count: overstayCount || 0,
      vehicle_type_breakdown: vehicleTypeBreakdown,
      revenue_by_day: revenueByDay,
      peak_hours: peakHours,
    };
  },
};
