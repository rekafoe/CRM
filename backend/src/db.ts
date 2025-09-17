// backend/src/db.ts

import sqlite3 from 'sqlite3'
import { createHash } from 'crypto'
import { open, Database } from 'sqlite'
import path from 'path'

const DB_FILE = process.env.DB_FILE ? path.resolve(process.cwd(), process.env.DB_FILE) : path.resolve(__dirname, '../data.db')

let dbInstance: Database | null = null

export async function initDB(): Promise<Database> {
  if (dbInstance) return dbInstance

  console.log('📂 Opening database at', DB_FILE)
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  })

  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      role TEXT,
      api_token TEXT UNIQUE,
      password_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE,
      status INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      userId INTEGER,
      customerName TEXT,
      customerPhone TEXT,
      customerEmail TEXT,
      prepaymentAmount REAL DEFAULT 0,
      prepaymentStatus TEXT,
      paymentUrl TEXT,
      paymentId TEXT
    );
    CREATE TABLE IF NOT EXISTS order_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      type TEXT NOT NULL,
      params TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS order_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      filename TEXT NOT NULL,
      originalName TEXT,
      mime TEXT,
      size INTEGER,
      uploadedAt TEXT DEFAULT (datetime('now')),
      approved INTEGER NOT NULL DEFAULT 0,
      approvedAt TEXT,
      approvedBy INTEGER,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      min_quantity REAL,
      sheet_price_single REAL
    );
    CREATE TABLE IF NOT EXISTS product_materials (
      presetCategory TEXT NOT NULL,
      presetDescription TEXT NOT NULL,
      materialId INTEGER NOT NULL,
      qtyPerItem REAL NOT NULL,
      FOREIGN KEY(materialId) REFERENCES materials(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      orders_count INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      user_id INTEGER,
      snapshot_json TEXT,
      cash_actual REAL
    );
    CREATE TABLE IF NOT EXISTS preset_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS preset_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      UNIQUE(category_id, description),
      FOREIGN KEY(category_id) REFERENCES preset_categories(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS preset_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      type TEXT NOT NULL,
      unit TEXT,
      FOREIGN KEY(category_id) REFERENCES preset_categories(id) ON DELETE CASCADE
    );
    -- Pricing tiers for flyers (sheet price single-side per SRA3)
    CREATE TABLE IF NOT EXISTS pricing_flyers_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      format TEXT NOT NULL,
      price_type TEXT NOT NULL,
      paper_density INTEGER NOT NULL DEFAULT 130,
      min_qty INTEGER NOT NULL,
      sheet_price_single REAL NOT NULL,
      UNIQUE(format, price_type, paper_density, min_qty)
    );
  `)

  console.log('✅ Database schema is ready')
  // Best-effort ALTERs for existing DBs (ignore errors if column exists)
  // Migrate daily_reports unique constraint from (report_date) to (report_date, user_id)
  try {
    const dr = await db.get<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_reports'`)
    const createSql = String((dr as any)?.sql || '')
    if (createSql.includes('report_date TEXT NOT NULL UNIQUE')) {
      console.log('🛠️ Migrating daily_reports schema to drop UNIQUE(report_date) ...')
      await db.exec(`PRAGMA foreign_keys=off; BEGIN;
        CREATE TABLE daily_reports_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_date TEXT NOT NULL,
          orders_count INTEGER NOT NULL DEFAULT 0,
          total_revenue REAL NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT,
          user_id INTEGER
        );
        INSERT INTO daily_reports_new (id, report_date, orders_count, total_revenue, created_at, updated_at, user_id)
          SELECT id, report_date, orders_count, total_revenue, created_at, updated_at, user_id FROM daily_reports;
        DROP TABLE daily_reports;
        ALTER TABLE daily_reports_new RENAME TO daily_reports;
        COMMIT; PRAGMA foreign_keys=on;`)
      console.log('✅ daily_reports schema migrated')
    }
  } catch {}
  
  // Best-effort ALTERs for existing DBs (ignore errors if column exists)
  const alters = [
    "ALTER TABLE orders ADD COLUMN customerName TEXT",
    "ALTER TABLE orders ADD COLUMN customerPhone TEXT",
    "ALTER TABLE orders ADD COLUMN customerEmail TEXT",
    "ALTER TABLE orders ADD COLUMN prepaymentAmount REAL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN prepaymentStatus TEXT",
    "ALTER TABLE orders ADD COLUMN paymentUrl TEXT",
    "ALTER TABLE orders ADD COLUMN paymentId TEXT",
    "ALTER TABLE daily_reports ADD COLUMN user_id INTEGER",
    "ALTER TABLE users ADD COLUMN role TEXT",
    "ALTER TABLE users ADD COLUMN api_token TEXT",
    "ALTER TABLE users ADD COLUMN password_hash TEXT",
    "ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE materials ADD COLUMN min_quantity REAL",
    "ALTER TABLE orders ADD COLUMN userId INTEGER",
    "ALTER TABLE items ADD COLUMN printerId INTEGER",
    "ALTER TABLE items ADD COLUMN sides INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE items ADD COLUMN sheets INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE items ADD COLUMN waste INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE items ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS material_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, materialId INTEGER NOT NULL, delta REAL NOT NULL, reason TEXT, orderId INTEGER, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(materialId) REFERENCES materials(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS printers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS printer_counters (id INTEGER PRIMARY KEY AUTOINCREMENT, printer_id INTEGER NOT NULL, counter_date TEXT NOT NULL, value INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(printer_id, counter_date), FOREIGN KEY(printer_id) REFERENCES printers(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS order_statuses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, color TEXT, sort_order INTEGER NOT NULL DEFAULT 0)",
    "CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date)",
    "CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_reports(user_id)",
    // Migrate uniqueness from (report_date) to (report_date, user_id)
    "DROP INDEX IF EXISTS idx_unique_daily_report_date",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_report_date_user ON daily_reports(report_date, COALESCE(user_id, -1))",
    // Add snapshot_json column
    "ALTER TABLE daily_reports ADD COLUMN snapshot_json TEXT",
    // Add cash_actual column
    "ALTER TABLE daily_reports ADD COLUMN cash_actual REAL",
    // Add paper_density to pricing_flyers_tiers
    "ALTER TABLE pricing_flyers_tiers ADD COLUMN paper_density INTEGER NOT NULL DEFAULT 130",
    "ALTER TABLE materials ADD COLUMN sheet_price_single REAL"
  ]
  for (const sql of alters) {
    try { await db.exec(sql) } catch {}
  }
  // Seed printers
  const prCount = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM printers`)
  if (!prCount || Number((prCount as any).c) === 0) {
    console.log('🌱 Seeding printers...')
    const printers = [
      { code: 'ch81', name: 'Коніка CH81 (цветная)' },
      { code: 'c554', name: 'Коніка C554 (офисная)' }
    ]
    for (const p of printers) {
      await db.run('INSERT INTO printers (code, name) VALUES (?, ?)', p.code, p.name)
    }
    console.log('✅ Printers seeded')
  }
  // Seed order statuses if empty
  const stRow = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM order_statuses`)
  if (!stRow || Number((stRow as any).c) === 0) {
    console.log('🌱 Seeding order statuses...')
    const statuses = [
      { name: 'Новый', color: '#9e9e9e', sort: 1 },
      { name: 'В производстве', color: '#1976d2', sort: 2 },
      { name: 'Готов к отправке', color: '#ffa000', sort: 3 },
      { name: 'Отправлен', color: '#7b1fa2', sort: 4 },
      { name: 'Завершён', color: '#2e7d32', sort: 5 }
    ]
    for (const s of statuses) {
      await db.run('INSERT INTO order_statuses (name, color, sort_order) VALUES (?, ?, ?)', s.name, s.color, s.sort)
    }
    console.log('✅ Order statuses seeded')
  }
  // Seed users if empty
  const userCount = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM users`)
  if (!userCount || Number((userCount as any).c) === 0) {
    console.log('🌱 Seeding users...')
    const hp = (p: string) => createHash('sha256').update(p).digest('hex')
    const users = [
      { name: 'Админ', email: 'admin@example.com', phone: '+375290000000', role: 'admin', api_token: 'admin-token-123', password_hash: hp('admin123') },
      { name: 'Менеджер 1', email: 'm1@example.com', phone: '+375290000001', role: 'manager', api_token: 'manager-token-111', password_hash: hp('manager123') },
      { name: 'Менеджер 2', email: 'm2@example.com', phone: '+375290000002', role: 'manager', api_token: 'manager-token-222', password_hash: hp('manager123') },
      { name: 'Наблюдатель', email: 'view@example.com', phone: '+375290000003', role: 'viewer', api_token: 'viewer-token-333', password_hash: hp('viewer123') }
    ]
    for (const u of users) {
      await db.run('INSERT OR IGNORE INTO users (name, email, phone, role, api_token, password_hash) VALUES (?, ?, ?, ?, ?, ?)', u.name, u.email, u.phone, u.role, u.api_token, u.password_hash)
    }
    console.log('✅ Users seeded')
  }
  // Ensure specific user exists: Войтюшкевич Максим
  try {
    const existingMax = await db.get<{ id: number }>(`SELECT id FROM users WHERE name = ?`, 'Войтюшкевич Максим')
    if (!existingMax) {
      const hp = (p: string) => createHash('sha256').update(p).digest('hex')
      await db.run(
        'INSERT OR IGNORE INTO users (name, email, phone, role, api_token, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        'Войтюшкевич Максим',
        'maxim@example.com',
        '+375290000010',
        'manager',
        'manager-token-maksim',
        hp('maksim123')
      )
      console.log('🌱 Created user: Войтюшкевич Максим (email: maxim@example.com)')
    }
  } catch {}
  // Seed presets if empty
  const countRow = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM preset_categories`)
  if (!countRow || Number((countRow as any).c) === 0) {
    console.log('🌱 Seeding print shop presets...')
    const presets = [
      {
        category: 'Визитки',
        color: '#1976d2',
        items: [
          { description: 'Визитки 90x50, односторонние', price: 30 },
          { description: 'Визитки 90x50, двусторонние', price: 40 }
        ],
        extras: [
          { name: 'Ламинация матовая', price: 10, type: 'checkbox' },
          { name: 'Ламинация глянцевая', price: 10, type: 'checkbox' }
        ]
      },
      {
        category: 'Листовки',
        color: '#43a047',
        items: [
          { description: 'Листовки A6, 4+0', price: 25 },
          { description: 'Листовки A5, 4+0', price: 35 },
          { description: 'Листовки A4, 4+0', price: 55 }
        ],
        extras: []
      },
      {
        category: 'Буклеты',
        color: '#ef6c00',
        items: [
          { description: 'Буклет A4, 2 фальца (евро)', price: 80 },
          { description: 'Буклет A3, 1 фальц', price: 95 }
        ],
        extras: []
      },
      {
        category: 'Плакаты',
        color: '#6d4c41',
        items: [
          { description: 'Плакат A3', price: 15 },
          { description: 'Плакат A2', price: 25 },
          { description: 'Плакат A1', price: 45 }
        ],
        extras: []
      },
      {
        category: 'Наклейки',
        color: '#8e24aa',
        items: [
          { description: 'Наклейки вырубные, малый формат', price: 20 },
          { description: 'Наклейки листовые A4', price: 12 }
        ],
        extras: []
      },
      {
        category: 'Баннеры',
        color: '#0097a7',
        items: [
          { description: 'Баннер 1×1 м', price: 30 },
          { description: 'Баннер 2×1 м', price: 50 }
        ],
        extras: [
          { name: 'Проклейка люверсов', price: 10, type: 'checkbox' }
        ]
      },
      {
        category: 'Календари',
        color: '#c2185b',
        items: [
          { description: 'Календарь настенный (перекидной)', price: 60 },
          { description: 'Календарь домик', price: 25 }
        ],
        extras: []
      }
    ]
    for (const p of presets) {
      const ins = await db.run(
        'INSERT OR IGNORE INTO preset_categories (category, color) VALUES (?, ?)',
        p.category,
        p.color
      )
      const catRow = await db.get<{ id: number }>('SELECT id FROM preset_categories WHERE category = ?', p.category)
      const catId = (catRow as any).id
      for (const it of p.items) {
        await db.run(
          'INSERT OR IGNORE INTO preset_items (category_id, description, price) VALUES (?, ?, ?)',
          catId,
          it.description,
          it.price
        )
      }
      for (const ex of p.extras || []) {
        await db.run(
          'INSERT INTO preset_extras (category_id, name, price, type, unit) VALUES (?, ?, ?, ?, ?)',
          catId,
          ex.name,
          ex.price,
          ex.type,
          (ex as any).unit || null
        )
      }
    }
    console.log('✅ Presets seeded')
  }

  // Seed basic materials and product_materials for flyers if empty
  const matCount = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM materials`)
  if (!matCount || Number((matCount as any).c) === 0) {
    console.log('🌱 Seeding basic materials...')
    const materialsSeed = [
      { name: 'Бумага мелованная 130 г/м², SRA3', unit: 'лист', quantity: 1500, min_quantity: 200 },
      { name: 'Бумага мелованная 150 г/м², SRA3', unit: 'лист', quantity: 1500, min_quantity: 150 },
      { name: 'Бумага офсетная 80 г/м², SRA3', unit: 'лист', quantity: 3000, min_quantity: 300 },
      { name: 'Плёнка ламинации матовая 35 мкм, SRA3', unit: 'лист', quantity: 1000, min_quantity: 100 },
      { name: 'Плёнка ламинации глянцевая 35 мкм, SRA3', unit: 'лист', quantity: 1000, min_quantity: 100 }
    ]
    for (const m of materialsSeed) {
      await db.run(
        'INSERT INTO materials (name, unit, quantity, min_quantity, sheet_price_single) VALUES (?, ?, ?, ?, ?)',
        m.name, m.unit, m.quantity, m.min_quantity, null
      )
    }
    console.log('✅ Materials seeded')

    // Map flyers presets to paper consumption per item (SRA3 imposition)
    const getMatId = async (name: string) => {
      const row = await db.get<{ id: number }>('SELECT id FROM materials WHERE name = ?', name)
      return (row as any)?.id as number
    }
    const paper130Id = await getMatId('Бумага мелованная 130 г/м², SRA3')
    // If preset items exist, create product_materials with qtyPerItem by format
    const flyers = [
      // Correct SRA3 320x450 imposition: A6=8up, A5=4up, A4=2up
      { desc: 'Листовки A6, 4+0', qtyPerItem: 1 / 8 },
      { desc: 'Листовки A5, 4+0', qtyPerItem: 1 / 4 },
      { desc: 'Листовки A4, 4+0', qtyPerItem: 1 / 2 }
    ]
    for (const f of flyers) {
      const presetExists = await db.get('SELECT 1 FROM preset_items pi JOIN preset_categories pc ON pc.id = pi.category_id WHERE pc.category = ? AND pi.description = ? LIMIT 1', 'Листовки', f.desc)
      if (presetExists && paper130Id) {
        await db.run(
          'INSERT INTO product_materials (presetCategory, presetDescription, materialId, qtyPerItem) VALUES (?, ?, ?, ?)',
          'Листовки', f.desc, paper130Id, f.qtyPerItem
        )
      }
    }
    // Best-effort adjust existing wrong values if any
    try {
      await db.run('UPDATE product_materials SET qtyPerItem = ? WHERE presetCategory = ? AND presetDescription = ? AND materialId = ?', 1/8, 'Листовки', 'Листовки A6, 4+0', paper130Id)
      await db.run('UPDATE product_materials SET qtyPerItem = ? WHERE presetCategory = ? AND presetDescription = ? AND materialId = ?', 1/4, 'Листовки', 'Листовки A5, 4+0', paper130Id)
      await db.run('UPDATE product_materials SET qtyPerItem = ? WHERE presetCategory = ? AND presetDescription = ? AND materialId = ?', 1/2, 'Листовки', 'Листовки A4, 4+0', paper130Id)
    } catch {}
    console.log('✅ Product materials seeded (flyers)')
  }

  // Seed or upsert pricing tiers from anchor tables (A6, 2 sides) provided by user
  // We convert total price per tier to sheet_price_single via: total / (sheets * sidesK)
  // For A6, qty=Q, sheets = ceil(Q / 8 * 1.02). We approximate with sheets≈Q/8 for calibration.
  try {
    console.log('🌱 Seeding flyers pricing tiers (from anchors)...')
    // Anchors for A6 totals (BYN) for qty tiers; indexes correspond to min_qty below
    const tiers = [
      { minQty: 8,   promo: 9.45,  online: 18.86, rush: 24.48 },
      { minQty: 16,  promo: 17.06, online: 31.32, rush: 40.96 },
      { minQty: 40,  promo: 25.59, online: 51.90, rush: 65.20 },
      { minQty: 80,  promo: 38.74, online: 72.40, rush: 86.90 },
      { minQty: 100, promo: 41.23, online: 89.86, rush: 104.85 },
      { minQty: 400, promo: 69.80, online: 212.00, rush: 233.50 },
      { minQty: 800, promo: 130.60, online: 352.00, rush: 377.00 },
      { minQty: 4000, promo: 540.64, online: 695.80, rush: 709.40 },
      { minQty: 8000, promo: 1079.90, online: 1388.00, rush: 1394.50 }
    ]
    const sidesK = 1.6
    for (const t of tiers) {
      const sheetsApprox = Math.max(1, Math.ceil((t.minQty / 8) * 1.02))
      for (const [pt, total] of [['promo', t.promo], ['online', t.online], ['rush', t.rush]] as const) {
        const sheetSingle = Number(total) / (sheetsApprox * sidesK)
        await db.run(
          'INSERT OR REPLACE INTO pricing_flyers_tiers (format, price_type, paper_density, min_qty, sheet_price_single) VALUES (?, ?, ?, ?, ?)',
          'A6', pt, 130, t.minQty, Math.round(sheetSingle * 1000) / 1000
        )
      }
    }
    console.log('✅ Flyers pricing tiers seeded/updated (A6)')
  } catch (e) {
    console.log('⚠️ Failed to seed pricing tiers from anchors', e)
  }

  // Seed A6 150 g/m² anchors for two-sided 
  try {
    console.log('🌱 Seeding flyers pricing tiers (A6 150g, 2 sides)...')
    const tiers150 = [
      { minQty: 8,   promo: 9.50,  online: 19.24, rush: 24.99 },
      { minQty: 16,  promo: 17.16, online: 32.08, rush: 41.98 },
      { minQty: 40,  promo: 25.84, online: 53.80, rush: 67.75 },
      { minQty: 80,  promo: 39.24, online: 72.80, rush: 87.40 },
      { minQty: 400, promo: 71.80, online: 214.00, rush: 236.00 },
      { minQty: 800, promo: 133.60, online: 356.00, rush: 382.00 },
      { minQty: 4000, promo: 555.64, online: 730.80, rush: 744.40 },
      { minQty: 8000, promo: 1109.90, online: 1458.00, rush: 1464.50 },
      { minQty: 10000, promo: 1387.72, online: 1823.40, rush: 1831.60 }
    ]
    const sidesK150 = 1.6
    for (const t of tiers150) {
      const sheetsApprox = Math.max(1, Math.ceil((t.minQty / 8) * 1.02))
      for (const [pt, total] of [['promo', t.promo], ['online', t.online], ['rush', t.rush]] as const) {
        const sheetSingle = Number(total) / (sheetsApprox * sidesK150)
        await db.run(
          'INSERT OR REPLACE INTO pricing_flyers_tiers (format, price_type, paper_density, min_qty, sheet_price_single) VALUES (?, ?, ?, ?, ?)',
          'A6', pt, 150, t.minQty, Math.round(sheetSingle * 1000) / 1000
        )
      }
    }
    console.log('✅ Flyers pricing tiers seeded/updated (A6 150g)')
  } catch (e) {
    console.log('⚠️ Failed to seed pricing tiers 150g', e)
  }
  dbInstance = db
  return db
}
