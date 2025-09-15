// backend/src/db.ts

import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'

const DB_FILE = path.resolve(__dirname, '../data.db')

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
      phone TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE,
      status INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      customerName TEXT,
      customerPhone TEXT,
      customerEmail TEXT,
      prepaymentAmount REAL DEFAULT 0,
      prepaymentStatus TEXT,
      paymentUrl TEXT,
      paymentId TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      type TEXT NOT NULL,
      params TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL
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
      report_date TEXT NOT NULL UNIQUE,
      orders_count INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      user_id INTEGER
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
  `)

  console.log('✅ Database schema is ready')
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
    "CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date)",
    "CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_reports(user_id)"
  ]
  for (const sql of alters) {
    try { await db.exec(sql) } catch {}
  }
  // Seed users if empty
  const userCount = await db.get<{ c: number }>(`SELECT COUNT(1) as c FROM users`)
  if (!userCount || Number((userCount as any).c) === 0) {
    console.log('🌱 Seeding users...')
    const users = [
      { name: 'Менеджер 1', email: 'm1@example.com', phone: '+375290000001' },
      { name: 'Менеджер 2', email: 'm2@example.com', phone: '+375290000002' },
      { name: 'Менеджер 3', email: 'm3@example.com', phone: '+375290000003' }
    ]
    for (const u of users) {
      await db.run('INSERT OR IGNORE INTO users (name, email, phone) VALUES (?, ?, ?)', u.name, u.email, u.phone)
    }
    console.log('✅ Users seeded')
  }
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
  dbInstance = db
  return db
}
