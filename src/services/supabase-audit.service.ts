/**
 * Supabase-direct audit log service.
 * Read-only for clients — writes happen through RPCs.
 */
import { supabase } from '@/lib/supabase';

export interface AuditLogEntry {
  id: string;
  company_id: string;
  site_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  actor_name?: string;
  details: any;
  created_at: string;
}

export const supabaseAuditService = {
  async getLogs(
    companyId: string,
    options?: {
      siteId?: string;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<AuditLogEntry[]> {
    if (!companyId) return [];
    
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        actor:employees!audit_logs_actor_id_fkey(name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (options?.siteId && options.siteId !== 'ALL') {
      query = query.eq('site_id', options.siteId);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);

    return (data || []).map((log: any) => ({
      ...log,
      actor_name: log.actor?.name || 'System',
    }));
  },

  /**
   * Write an audit log entry directly (for client-side actions that don't go through RPCs).
   * Uses a SECURITY DEFINER function if needed, but for now we insert directly.
   */
  async logAction(
    companyId: string,
    action: string,
    entityType: string,
    entityId: string,
    actorId: string | null,
    siteId?: string,
    details?: any
  ): Promise<void> {
    // Audit logs are written by SECURITY DEFINER RPCs (vehicle_entry, vehicle_checkout).
    // This method is for admin actions that don't use RPCs.
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        company_id: companyId,
        site_id: siteId || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId,
        details: details || null,
      });

    if (error) {
      // Don't throw on audit log failures — they shouldn't block operations
      console.error('Failed to write audit log:', error);
    }
  },
};
