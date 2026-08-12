import { getDB } from '@/database/connection';
import { SyncEngine } from './engine';

export class SyncQueue {
  /**
   * Queue a payload to be synced with the server and triggers an immediate push.
   * 
   * @param tableName The Supabase table name
   * @param operation INSERT, UPDATE, or DELETE
   * @param payload The data object
   */
  static async enqueue(tableName: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const db = await getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Ensure all payloads have updated_at to handle conflict resolution server-side
    // and prevent local updates from being overwritten by stale server data
    if (operation === 'UPDATE' && !payload.updated_at) {
      payload.updated_at = now;
    }

    const query = `
      INSERT INTO sync_queue (id, table_name, operation, payload, created_at, status, retry_count)
      VALUES (?, ?, ?, ?, ?, 'PENDING', 0)
    `;
    
    await db.executeSet([{ 
      statement: query, 
      values: [id, tableName, operation, JSON.stringify(payload), now] 
    }]);

    // Trigger immediate push after queueing
    SyncEngine.triggerPush();
  }

  /**
   * Cleanup completed sync jobs older than 24 hours
   */
  static async cleanup() {
    try {
      const db = await getDB();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      await db.executeSet([{
        statement: `DELETE FROM sync_queue WHERE status = 'COMPLETED' AND created_at < ?`,
        values: [oneDayAgo]
      }]);
    } catch (err) {
      console.error('Failed to cleanup sync queue', err);
    }
  }
}
