import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

let sqlite: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;

export const DB_NAME = 'parking_db';

export const getSQLite = (): SQLiteConnection => {
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite);
  }
  return sqlite;
};

export const getDB = async (): Promise<SQLiteDBConnection> => {
  if (dbConnection) return dbConnection;

  try {
    const sqliteConn = getSQLite();
    
    // Check connection consistency
    try {
      const isReady = await sqliteConn.checkConnectionsConsistency();
      const isConn = (await sqliteConn.isConnection(DB_NAME, false)).result;

      if (isReady.result && isConn) {
        dbConnection = await sqliteConn.retrieveConnection(DB_NAME, false);
      } else {
        dbConnection = await sqliteConn.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }
    } catch (checkErr) {
      console.warn('Connection check warning, creating fresh connection:', checkErr);
      dbConnection = await sqliteConn.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        1,
        false
      );
    }

    await dbConnection.open();
    // Disable foreign key constraints to allow offline sync to insert tables out-of-order
    await dbConnection.execute('PRAGMA foreign_keys = OFF;');
    return dbConnection;
  } catch (error) {
    console.error('Failed to initialize SQLite connection', error);
    throw error;
  }
};
