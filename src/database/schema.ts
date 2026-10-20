import { getDB } from './connection';

export const initializeLocalSchema = async () => {
  const db = await getDB();
  
  const schema = `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      brand_name TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      timezone TEXT NOT NULL,
      grace_period_minutes INTEGER NOT NULL,
      rounding_interval_min INTEGER NOT NULL,
      day_rate_switchover_hrs INTEGER NOT NULL,
      overstay_alert_hrs INTEGER NOT NULL,
      daily_revenue_target INTEGER NOT NULL,
      total_slots INTEGER NOT NULL,
      contact_number TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      auth_user_id TEXT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      pin TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      avatar_url TEXT,
      shift TEXT,
      salary_advance INTEGER NOT NULL DEFAULT 0,
      base_salary INTEGER NOT NULL DEFAULT 0,
      salary_type TEXT NOT NULL DEFAULT 'MONTHLY',
      designation TEXT,
      joining_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS rate_cards (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      hourly_rate INTEGER NOT NULL,
      daily_rate INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS parking_sessions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      driver_number TEXT NOT NULL,
      driver_name TEXT,
      notes TEXT,
      vehicle_photos TEXT,
      entry_at TEXT NOT NULL,
      entry_operator_id TEXT NOT NULL,
      exit_at TEXT,
      exit_operator_id TEXT,
      rate_card_id TEXT,
      duration_minutes INTEGER,
      gross_amount INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      method TEXT,
      amount INTEGER NOT NULL,
      discount_amount INTEGER NOT NULL,
      tax_amount INTEGER NOT NULL,
      collected_by_id TEXT,
      collected_at TEXT,
      receipt_number TEXT,
      transaction_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES parking_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS staff_attendance (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      shift TEXT,
      notes TEXT,
      marked_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS staff_transactions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      site_id TEXT,
      employee_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      month TEXT,
      notes TEXT,
      transaction_ref TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS _schema_version (
      version INTEGER PRIMARY KEY
    );
  `;

  try {
    const res = await db.execute(schema);
    console.log('Local SQLite schema initialized', res);
  } catch (err) {
    console.error('Failed to initialize local schema', err);
    throw err;
  }

  // Handle migrations / alter tables safely with versioning
  const currentVersionResult = await db.query('SELECT MAX(version) as v FROM _schema_version');
  let currentVersion = currentVersionResult.values?.[0]?.v || 0;

  console.log(`Current SQLite Schema Version: ${currentVersion}`);

  const migrations: Record<number, string[]> = {
    1: [
      'ALTER TABLE sites ADD COLUMN contact_number TEXT;',
      'ALTER TABLE employees ADD COLUMN avatar_url TEXT;',
      'ALTER TABLE employees ADD COLUMN shift TEXT;',
      'ALTER TABLE employees ADD COLUMN salary_advance INTEGER NOT NULL DEFAULT 0;'
    ],
    2: [
      'CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_rate_cards_company ON rate_cards(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_company ON parking_sessions(company_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_company_status ON parking_sessions(company_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_company_entry ON parking_sessions(company_id, entry_at);',
      'CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_vehicle ON parking_sessions(company_id, vehicle_number) WHERE status = "ACTIVE" AND deleted_at IS NULL;'
    ],
    3: [
      `CREATE TABLE IF NOT EXISTS employee_sites (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(employee_id, site_id)
      );`,
      'CREATE INDEX IF NOT EXISTS idx_employee_sites_emp ON employee_sites(employee_id);',
      'CREATE INDEX IF NOT EXISTS idx_employee_sites_site ON employee_sites(site_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_site_status ON parking_sessions(site_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_vehicle_search ON parking_sessions(vehicle_number);'
    ],
    4: [
      'ALTER TABLE parking_sessions ADD COLUMN driver_name TEXT;',
      'ALTER TABLE employees ADD COLUMN base_salary INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE employees ADD COLUMN salary_type TEXT NOT NULL DEFAULT "MONTHLY";',
      'ALTER TABLE employees ADD COLUMN designation TEXT;',
      'ALTER TABLE employees ADD COLUMN joining_date TEXT;',
      `CREATE TABLE IF NOT EXISTS staff_attendance (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        check_in TEXT,
        check_out TEXT,
        shift TEXT,
        notes TEXT,
        marked_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(employee_id, date)
      );`,
      `CREATE TABLE IF NOT EXISTS staff_transactions (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        site_id TEXT,
        employee_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL DEFAULT "CASH",
        month TEXT,
        notes TEXT,
        transaction_ref TEXT,
        recorded_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      'CREATE INDEX IF NOT EXISTS idx_staff_attendance_emp_date ON staff_attendance(employee_id, date);',
      'CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);',
      'CREATE INDEX IF NOT EXISTS idx_staff_tx_emp ON staff_transactions(employee_id, payment_date);',
      'CREATE INDEX IF NOT EXISTS idx_staff_tx_month ON staff_transactions(month);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_driver_name ON parking_sessions(driver_name);'
    ]
  };

  const targetVersion = Math.max(...Object.keys(migrations).map(Number));

  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const stmts = migrations[v];
    if (stmts) {
      console.log(`Applying migration v${v}...`);
      for (const stmt of stmts) {
        try {
          await db.execute(stmt);
        } catch (err) {
          console.warn(`Migration statement failed (might already exist): ${stmt}`, err);
        }
      }
      await db.executeSet([{ statement: 'INSERT INTO _schema_version (version) VALUES (?)', values: [v] }]);
      console.log(`Migration v${v} complete.`);
    }
  }
};
