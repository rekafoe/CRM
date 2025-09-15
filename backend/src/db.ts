// backend/src/db.ts

import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'

const DB_FILE = path.resolve(__dirname, '../data.db')

export async function initDB(): Promise<Database> {
  console.log('📂 Opening database at', DB_FILE)
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  })

  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE,
      status INTEGER NOT NULL,
      createdAt TEXT NOT NULL
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
  `)

  console.log('✅ Database schema is ready')
  return db
}
