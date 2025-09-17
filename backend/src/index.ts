// backend/src/index.ts

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { initDB } from './db'
import { Order, Item, Material, ProductMaterial, DailyReport } from './types'
import 'dotenv/config';
// Optional: Sentry setup
const SENTRY_DSN = process.env.SENTRY_DSN
if (SENTRY_DSN) {
  try {
    // Lazy import to avoid dependency if not configured
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node')
    Sentry.init({ dsn: SENTRY_DSN })
    console.log(JSON.stringify({ level: 'info', msg: 'Sentry initialized' }))
  } catch {}
}
import { createHash } from 'crypto'
import path from 'path'
import fs from 'fs'
// Use require to avoid TS type resolution issues for multer
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer') as any
async function main() {
  const db = await initDB()
  const app = express()

  const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*'
  app.use(cors({ origin: ALLOWED_ORIGIN }))
  app.use(express.json())
  // Files storage
  const uploadsDir = path.resolve(__dirname, '../uploads')
  try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch {}
  const storage = multer.diskStorage({
    destination: (_req: Request, _file: any, cb: (err: any, dest: string) => void) => cb(null, uploadsDir),
    filename: (_req: Request, file: any, cb: (err: any, filename: string) => void) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      const ext = path.extname(file.originalname || '')
      cb(null, unique + ext)
    }
  })
  const upload = multer({ storage })
  app.use('/uploads', express.static(uploadsDir))
  app.use('/api/uploads', express.static(uploadsDir))
  // Password auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body as { email: string; password: string }
    if (!email || !password) return res.status(400).json({ message: 'Email и пароль обязательны' })
    const hp = createHash('sha256').update(password).digest('hex')
    const u = await db.get<{ id: number; api_token: string; name: string; role: string }>(
      'SELECT id, api_token, name, role FROM users WHERE email = ? AND password_hash = ?',
      email,
      hp
    )
    if (!u) return res.status(401).json({ message: 'Неверные данные' })

    // Ensure daily report exists for today for this user
    const today = new Date().toISOString().slice(0,10)
    const exists = await db.get('SELECT id FROM daily_reports WHERE report_date = ? AND user_id = ?', today, u.id)
    if (!exists) {
      try {
        await db.run('INSERT INTO daily_reports (report_date, user_id) VALUES (?, ?)', today, u.id)
      } catch {}
    }

    res.json({ token: u.api_token, name: u.name, role: u.role, user_id: u.id, session_date: today })
  })
  // Simple token auth middleware (API token from users.api_token)
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const openPaths = [
      // public widget needs these
      /^\/api\/presets/,
      /^\/api\/orders\/[0-9]+\/items$/,
      /^\/api\/orders\/[0-9]+\/prepay$/,
      /^\/api\/webhooks\/bepaid$/
    ]
    if (openPaths.some(r => r.test(req.path))) return next()
    const auth = req.headers['authorization'] || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined
    if (!token) { res.status(401).json({ message: 'Unauthorized' }); return }
    const u = await db.get<{ id: number; role: string }>('SELECT id, role FROM users WHERE api_token = ?', token)
    if (!u) { res.status(401).json({ message: 'Unauthorized' }); return }
    ;(req as any).user = u
    next()
  })
  // Routes are defined inline against sqlite database
  // Обёртка для async-роутов
  const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next)

  // GET /api/orders — список заказов с их позициями
  app.get(
    '/api/orders',
    asyncHandler(async (req, res) => {
      try {
        const authUser = (req as any).user as { id: number; role: string } | undefined
        if (!authUser?.id) { res.status(401).json({ message: 'Unauthorized' }); return }
        const orders = (await db.all<Order>(
          'SELECT id, number, status, createdAt, customerName, customerPhone, customerEmail, prepaymentAmount, prepaymentStatus, paymentUrl, paymentId, userId FROM orders WHERE userId = ? OR userId IS NULL ORDER BY id DESC',
          authUser.id
        )) as unknown as Order[]
        
        console.log(`Found ${orders.length} orders in database`);
        
        for (const o of orders) {
          console.log(`Processing order ${o.number} (ID: ${o.id})`);
        const itemsRaw = (await db.all<{
          id: number
          orderId: number
          type: string
          params: string
          price: number
        }>(
          'SELECT id, orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks FROM items WHERE orderId = ?',
          o.id
        )) as unknown as Array<{
          id: number
          orderId: number
          type: string
          params: string
          price: number
          quantity: number
          printerId: number | null
          sides: number
          sheets: number
          waste: number
          clicks: number
        }>
        o.items = itemsRaw.map(ir => {
          let params;
          try {
            params = JSON.parse(ir.params);
          } catch (error) {
            console.error(`Error parsing params for item ${ir.id}:`, error);
            params = { description: 'Ошибка данных' };
          }
          return {
            id: ir.id,
            orderId: ir.orderId,
            type: ir.type,
            params,
            price: ir.price,
            quantity: ir.quantity ?? 1,
            printerId: ir.printerId ?? undefined,
            sides: ir.sides,
            sheets: ir.sheets,
            waste: ir.waste,
            clicks: ir.clicks
          };
        })
        }
        console.log(`Successfully processed ${orders.length} orders`);
        res.json(orders)
      } catch (error) {
        console.error('Error in /api/orders:', error);
        res.status(500).json({ error: 'Failed to load orders', details: error instanceof Error ? error.message : String(error) });
      }
    })
  )

  // POST /api/orders — создать новый заказ
  app.post(
    '/api/orders',
    asyncHandler(async (req, res) => {
      const createdAt = new Date().toISOString()
      const authUser = (req as any).user as { id: number } | undefined
      const { customerName, customerPhone, customerEmail, prepaymentAmount } = (req.body || {}) as Partial<Order>
      const insertRes = await db.run(
        'INSERT INTO orders (status, createdAt, customerName, customerPhone, customerEmail, prepaymentAmount, userId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        1,
        createdAt,
        customerName || null,
        customerPhone || null,
        customerEmail || null,
        Number(prepaymentAmount || 0),
        authUser?.id ?? null
      )
      const id = insertRes.lastID!
      const number = `ORD-${String(id).padStart(4, '0')}`
      await db.run('UPDATE orders SET number = ? WHERE id = ?', number, id)

      const raw = await db.get<Order>(
        'SELECT * FROM orders WHERE id = ?',
        id
      )
      const order: Order = { ...(raw as Order), items: [] }
      res.status(201).json(order)
    })
  )

  // PUT /api/orders/:id/status — обновить статус заказа
  app.put(
    '/api/orders/:id/status',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const { status } = req.body as { status: number }
      await db.run('UPDATE orders SET status = ? WHERE id = ?', status, id)

      const raw = await db.get<Order>(
        'SELECT * FROM orders WHERE id = ?',
        id
      )
      const updated: Order = { ...(raw as Order), items: [] }
      res.json(updated)
    })
  )

  // POST /api/orders/:id/prepay — создать ссылку на предоплату (через BePaid-стаб)
  app.post(
    '/api/orders/:id/prepay',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const order = await db.get<Order>('SELECT * FROM orders WHERE id = ?', id)
      if (!order) { res.status(404).json({ message: 'Заказ не найден' }); return }
      const amount = Number((req.body as any)?.amount ?? order.prepaymentAmount ?? 0)
      if (!amount || amount <= 0) { res.status(400).json({ message: 'Сумма предоплаты не задана' }); return }
      // BePaid integration stub: normally create payment via API and get redirect url
      const paymentId = `BEP-${Date.now()}-${id}`
      const paymentUrl = `https://checkout.bepaid.by/redirect/${paymentId}`
      await db.run('UPDATE orders SET prepaymentAmount = ?, prepaymentStatus = ?, paymentUrl = ?, paymentId = ? WHERE id = ?', amount, 'pending', paymentUrl, paymentId, id)
      const updated = await db.get<Order>('SELECT * FROM orders WHERE id = ?', id)
      res.json(updated)
    })
  )

  // POST /api/webhooks/bepaid — обработчик вебхуков статуса оплаты
  app.post(
    '/api/webhooks/bepaid',
    asyncHandler(async (req, res) => {
      const { payment_id, status, order_id } = req.body as { payment_id: string; status: string; order_id: number }
      if (!payment_id) { res.status(400).json({}); return }
      await db.run('UPDATE orders SET prepaymentStatus = ? WHERE paymentId = ?', status, payment_id)
      res.status(204).end()
    })
  )

  // POST /api/orders/:id/items — добавить позицию и списать материалы (атомарно)
  app.post(
    '/api/orders/:id/items',
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.id)
      const { type, params, price, quantity = 1, printerId, sides = 1, sheets = 0, waste = 0, components } = req.body as {
        type: string
        params: { description: string }
        price: number
        quantity?: number
        printerId?: number
        sides?: number
        sheets?: number
        waste?: number
        components?: Array<{ materialId: number; qtyPerItem: number }>
      }
      const authUser = (req as any).user as { id: number } | undefined

      // Узнаём материалы и остатки (либо из переданных components, либо по пресету)
      let needed = [] as Array<{ materialId: number; qtyPerItem: number; quantity: number; min_quantity: number | null }>
      if (Array.isArray(components) && components.length > 0) {
        const ids = components.map(c => Number(c.materialId)).filter(Boolean)
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(',')
          const rows = await db.all<any>(`SELECT id as materialId, quantity, min_quantity FROM materials WHERE id IN (${placeholders})`, ...ids)
          const byId: Record<number, { quantity: number; min_quantity: number | null }> = {}
          for (const r of rows) byId[Number(r.materialId)] = { quantity: Number(r.quantity), min_quantity: r.min_quantity == null ? null : Number(r.min_quantity) }
          needed = components.map(c => ({ materialId: Number(c.materialId), qtyPerItem: Number(c.qtyPerItem), quantity: byId[Number(c.materialId)]?.quantity ?? 0, min_quantity: byId[Number(c.materialId)]?.min_quantity ?? null }))
        }
      } else {
        needed = (await db.all<{
          materialId: number
          qtyPerItem: number
          quantity: number
          min_quantity: number | null
        }>(
          `SELECT pm.materialId, pm.qtyPerItem, m.quantity, m.min_quantity as min_quantity
             FROM product_materials pm
             JOIN materials m ON m.id = pm.materialId
             WHERE pm.presetCategory = ? AND pm.presetDescription = ?`,
          type,
          params.description
        )) as unknown as Array<{ materialId: number; qtyPerItem: number; quantity: number; min_quantity: number | null }>
      }

      // Транзакция: проверка остатков, списание и вставка позиции
      await db.run('BEGIN')
      try {
        for (const n of needed) {
          const needQty = n.qtyPerItem * Math.max(1, Number(quantity) || 1)
          const minQ = n.min_quantity == null ? -Infinity : Number(n.min_quantity)
          if (n.quantity - needQty < minQ) {
            const err: any = new Error(`Недостаточно материала с учётом минимального остатка ID=${n.materialId}`)
            err.status = 400
            throw err
          }
          await db.run(
            'UPDATE materials SET quantity = quantity - ? WHERE id = ?',
            needQty,
            n.materialId
          )
          await db.run(
            'INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)',
            n.materialId,
            -needQty,
            'order add item',
            orderId,
            authUser?.id ?? null
          )
        }

        const clicks = Math.max(0, Number(sheets) || 0) * (Math.max(1, Number(sides) || 1) * 2) // SRA3 one-side=2 clicks, two-sides=4
        const insertItem = await db.run(
          'INSERT INTO items (orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          orderId,
          type,
          JSON.stringify({ ...params, components: Array.isArray(components) ? components : undefined }),
          price,
          Math.max(1, Number(quantity) || 1),
          printerId || null,
          Math.max(1, Number(sides) || 1),
          Math.max(0, Number(sheets) || 0),
          Math.max(0, Number(waste) || 0),
          clicks
        )
        const itemId = insertItem.lastID!
        const rawItem = await db.get<{
          id: number
          orderId: number
          type: string
          params: string
          price: number
          quantity: number
          printerId: number | null
          sides: number
          sheets: number
          waste: number
          clicks: number
        }>(
          'SELECT id, orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks FROM items WHERE id = ?',
          itemId
        )

        await db.run('COMMIT')

        const item: Item = {
          id: rawItem!.id,
          orderId: rawItem!.orderId,
          type: rawItem!.type,
          params: JSON.parse(rawItem!.params),
          price: rawItem!.price,
          quantity: rawItem!.quantity ?? 1,
          printerId: rawItem!.printerId ?? undefined,
          sides: rawItem!.sides,
          sheets: rawItem!.sheets,
          waste: rawItem!.waste,
          clicks: rawItem!.clicks
        }
        res.status(201).json(item)
        return
      } catch (e) {
        await db.run('ROLLBACK')
        throw e
      }
    })
  )

  // ===== Daily Reports =====
  app.get(
    '/api/daily-reports',
    asyncHandler(async (req, res) => {
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const { user_id, from, to, current_user_id } = req.query as any
      const params: any[] = []
      const where: string[] = []
      
      // Если указан конкретный пользователь, показываем только его отчёты (только для админа)
      if (user_id) {
        if (!authUser || authUser.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
        where.push('dr.user_id = ?')
        params.push(Number(user_id))
      } else if (current_user_id) {
        // Если не указан user_id, но есть current_user_id, показываем отчёты текущего пользователя
        where.push('dr.user_id = ?')
        params.push(Number(current_user_id))
      } else if (authUser) {
        // По умолчанию — только свои
        where.push('dr.user_id = ?')
        params.push(authUser.id)
      }
      
      if (from) { where.push('dr.report_date >= ?'); params.push(String(from)) }
      if (to) { where.push('dr.report_date <= ?'); params.push(String(to)) }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
      const rows = (await db.all<DailyReport & { user_name: string | null }>(
        `SELECT dr.id, dr.report_date, dr.orders_count, dr.total_revenue, dr.created_at, dr.updated_at, dr.user_id, dr.cash_actual,
                u.name as user_name
           FROM daily_reports dr
           LEFT JOIN users u ON u.id = dr.user_id
           ${whereSql}
           ORDER BY dr.report_date DESC`,
        ...params
      )) as unknown as Array<DailyReport & { user_name: string | null }>
      res.json(rows)
    })
  )

  app.get(
    '/api/daily/:date',
    asyncHandler(async (req, res) => {
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const qUserIdRaw = (req.query as any)?.user_id
      const targetUserId = qUserIdRaw != null && qUserIdRaw !== '' ? Number(qUserIdRaw) : authUser?.id
      if (!targetUserId) { res.status(400).json({ message: 'Не указан пользователь' }); return }

      // Access control: only admin can read others' reports
      if (qUserIdRaw != null && targetUserId !== authUser?.id && authUser?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden' }); return
      }

      const row = await db.get<DailyReport & { user_name: string | null }>(
        `SELECT dr.id, dr.report_date, dr.orders_count, dr.total_revenue, dr.created_at, dr.updated_at, dr.user_id, dr.snapshot_json, dr.cash_actual,
                u.name as user_name
           FROM daily_reports dr
           LEFT JOIN users u ON u.id = dr.user_id
          WHERE dr.report_date = ? AND dr.user_id = ?`,
        req.params.date,
        targetUserId
      )
      if (!row) {
        res.status(404).json({ message: 'Отчёт не найден' })
        return
      }
      res.json(row)
    })
  )

  app.patch(
    '/api/daily/:date',
    asyncHandler(async (req, res) => {
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const { orders_count, total_revenue, user_id, cash_actual } = req.body as {
        orders_count?: number
        total_revenue?: number
        user_id?: number
        cash_actual?: number
      }
      if (orders_count == null && total_revenue == null && user_id == null) {
        res.status(400).json({ message: 'Нет данных для обновления' })
        return
      }

      // Determine target row by (date, user)
      const qUserIdRaw = (req.query as any)?.user_id
      const targetUserId = qUserIdRaw != null && qUserIdRaw !== '' ? Number(qUserIdRaw) : authUser?.id
      if (!targetUserId) { res.status(400).json({ message: 'Не указан пользователь' }); return }
      if (qUserIdRaw != null && targetUserId !== authUser?.id && authUser?.role !== 'admin') {
        res.status(403).json({ message: 'Forbidden' }); return
      }

      const existing = await db.get<DailyReport>(
        'SELECT id, user_id FROM daily_reports WHERE report_date = ? AND user_id = ?',
        req.params.date,
        targetUserId
      )
      if (!existing) {
        res.status(404).json({ message: 'Отчёт не найден' })
        return
      }

      // Allow changing owner only for admin
      const nextUserId = user_id != null && authUser?.role === 'admin' ? user_id : targetUserId

      try {
        await db.run(
          `UPDATE daily_reports
             SET 
               ${orders_count != null ? 'orders_count = ?,' : ''}
               ${total_revenue != null ? 'total_revenue = ?,' : ''}
               ${cash_actual != null ? 'cash_actual = ?,' : ''}
               ${nextUserId !== targetUserId ? 'user_id = ?,' : ''}
               updated_at = datetime('now')
           WHERE report_date = ? AND user_id = ?`,
          ...([orders_count != null ? orders_count : []] as any),
          ...([total_revenue != null ? total_revenue : []] as any),
          ...([cash_actual != null ? Number(cash_actual) : []] as any),
          ...([nextUserId !== targetUserId ? nextUserId : []] as any),
          req.params.date,
          targetUserId
        )
      } catch (e: any) {
        if (String(e?.message || '').includes('UNIQUE')) { res.status(409).json({ message: 'Отчёт для этого пользователя и даты уже существует' }); return }
        throw e
      }

      const updated = await db.get<DailyReport & { user_name: string | null }>(
        `SELECT dr.id, dr.report_date, dr.orders_count, dr.total_revenue, dr.created_at, dr.updated_at, dr.user_id, dr.snapshot_json, dr.cash_actual,
                u.name as user_name
           FROM daily_reports dr
           LEFT JOIN users u ON u.id = dr.user_id
          WHERE dr.report_date = ? AND dr.user_id = ?`,
        req.params.date,
        nextUserId
      )
      res.json(updated)
    })
  )

  // POST /api/daily — создать отчёт на дату с пользователем
  app.post(
    '/api/daily',
    asyncHandler(async (req, res) => {
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const { report_date, user_id, orders_count = 0, total_revenue = 0, cash_actual } = req.body as {
        report_date: string; user_id?: number; orders_count?: number; total_revenue?: number; cash_actual?: number
      }
      if (!report_date) { res.status(400).json({ message: 'Нужна дата YYYY-MM-DD' }); return }
      const today = new Date().toISOString().slice(0,10)
      if (report_date !== today) { res.status(400).json({ message: 'Создание отчёта возможно только за сегодняшнюю дату' }); return }
      const targetUserId = user_id != null ? Number(user_id) : authUser?.id
      if (!targetUserId) { res.status(400).json({ message: 'Не указан пользователь' }); return }
      if (!authUser || targetUserId !== authUser.id) { res.status(403).json({ message: 'Создание отчёта возможно только для текущего пользователя' }); return }
      try {
        await db.run(
          'INSERT INTO daily_reports (report_date, orders_count, total_revenue, user_id, cash_actual) VALUES (?, ?, ?, ?, ?)',
          report_date,
          orders_count,
          total_revenue,
          targetUserId,
          cash_actual != null ? Number(cash_actual) : null
        )
      } catch (e: any) {
        if (String(e?.message || '').includes('UNIQUE')) { res.status(409).json({ message: 'Отчёт уже существует' }); return }
        throw e
      }
      const row = await db.get<DailyReport & { user_name: string | null }>(
        `SELECT dr.id, dr.report_date, dr.orders_count, dr.total_revenue, dr.created_at, dr.updated_at, dr.user_id, dr.snapshot_json,
                u.name as user_name
           FROM daily_reports dr
           LEFT JOIN users u ON u.id = dr.user_id
          WHERE dr.report_date = ? AND dr.user_id = ?`,
        report_date,
        targetUserId
      )
      res.status(201).json(row)
    })
  )

  // GET /api/users — список пользователей
  app.get(
    '/api/users',
    asyncHandler(async (_req, res) => {
      const users = await db.all<{ id: number; name: string }>('SELECT id, name FROM users ORDER BY name')
      res.json(users)
    })
  )

  // GET /api/me — информация о текущем пользователе
  app.get(
    '/api/me',
    asyncHandler(async (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) {
        res.status(401).json({ message: 'Токен не предоставлен' })
        return
      }
      
      const user = await db.get<{ id: number; name: string; role: string }>(
        'SELECT id, name, role FROM users WHERE api_token = ?',
        token
      )
      
      if (!user) {
        res.status(401).json({ message: 'Неверный токен' })
        return
      }
      
      res.json(user)
    })
  )

  // DELETE /api/daily-reports/:id — удалить отчёт
  app.delete(
    '/api/daily-reports/:id',
    asyncHandler(async (req, res) => {
      const reportId = Number(req.params.id)
      if (!reportId) {
        res.status(400).json({ message: 'Неверный ID отчёта' })
        return
      }

      // Проверяем, существует ли отчёт
      const report = await db.get('SELECT id FROM daily_reports WHERE id = ?', reportId)
      if (!report) {
        res.status(404).json({ message: 'Отчёт не найден' })
        return
      }

      await db.run('DELETE FROM daily_reports WHERE id = ?', reportId)
      res.json({ message: 'Отчёт успешно удалён' })
    })
  )

  // GET /api/daily-reports/full/:date — получить полный отчёт с заказами
  app.get(
    '/api/daily-reports/full/:date',
    asyncHandler(async (req, res) => {
      const reportDate = req.params.date
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const userId = req.query.user_id ? Number(req.query.user_id) : authUser?.id
      if (!userId) { res.status(400).json({ message: 'Не указан пользователь' }); return }
      if ((req.query.user_id as any) && userId !== authUser?.id && authUser?.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }

      // Получаем отчёт
      const report = await db.get<DailyReport & { user_name: string | null }>(
        `SELECT dr.id, dr.report_date, dr.orders_count, dr.total_revenue, dr.created_at, dr.updated_at, dr.user_id, dr.snapshot_json,
                u.name as user_name
           FROM daily_reports dr
           LEFT JOIN users u ON u.id = dr.user_id
           WHERE dr.report_date = ? AND dr.user_id = ?`,
        [reportDate, userId]
      )

      if (!report) {
        res.status(404).json({ message: 'Отчёт не найден' })
        return
      }

      // Получаем заказы за эту дату (на текущий момент не фильтруем по пользователю, так как связь не хранится в orders)
      const orders = await db.all<any>(
        `SELECT id, number, status, createdAt, customerName, customerPhone, customerEmail, 
                prepaymentAmount, prepaymentStatus, paymentUrl, paymentId, userId
           FROM orders 
           WHERE DATE(createdAt) = ? AND userId = ?
           ORDER BY createdAt DESC`,
        [reportDate, userId]
      ) as Order[]

      // Получаем позиции для каждого заказа
      for (const order of orders) {
        const items = await db.all<any>(
          `SELECT id, orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks
           FROM items WHERE orderId = ?`,
          order.id
        ) as Item[]
        order.items = items.map((item: any) => ({
          ...item,
          params: typeof item.params === 'string' ? JSON.parse(item.params) : item.params
        }))
      }

      // Создаём метаданные отчёта
      const ordersByStatus: Record<number, number> = {}
      const revenueByStatus: Record<number, number> = {}
      
      orders.forEach((order: any) => {
        ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1
        const orderRevenue = order.items.reduce((sum: any, item: any) => sum + (item.price * (item.quantity || 1)), 0)
        revenueByStatus[order.status] = (revenueByStatus[order.status] || 0) + orderRevenue
      })

      const fullReport: any = {
        ...report,
        orders,
        report_metadata: {
          total_orders: orders.length,
          total_revenue: orders.reduce((sum: any, order: any) => 
            sum + order.items.reduce((itemSum: any, item: any) => itemSum + (item.price * (item.quantity || 1)), 0), 0
          ),
          orders_by_status: ordersByStatus,
          revenue_by_status: revenueByStatus,
          created_by: report.user_id || 0,
          last_modified: new Date().toISOString()
        }
      }

      res.json(fullReport)
    })
  )

  // POST /api/daily-reports/full — сохранить полный отчёт
  app.post(
    '/api/daily-reports/full',
    asyncHandler(async (req, res) => {
      const authUser = (req as any).user as { id: number; role: string } | undefined
      const reportData = req.body as any
      const { report_date, user_id, orders, report_metadata } = reportData

      if (!report_date) { res.status(400).json({ message: 'Дата отчёта обязательна' }); return }
      const targetUserId = user_id || authUser?.id
      if (!targetUserId) { res.status(400).json({ message: 'Не указан пользователь' }); return }
      if (user_id && targetUserId !== authUser?.id && authUser?.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }

      // Создаём или обновляем отчёт
      const existingReport = await db.get('SELECT id FROM daily_reports WHERE report_date = ? AND user_id = ?', 
        report_date, targetUserId)

      if (!existingReport) { res.status(404).json({ message: 'Отчёт не найден. Создание возможно только через вход в систему в день отчёта.' }); return }
      // Обновляем существующий отчёт
      await db.run(
        'UPDATE daily_reports SET orders_count = ?, total_revenue = ?, snapshot_json = ?, updated_at = ? WHERE id = ?',
        report_metadata?.total_orders || 0,
        report_metadata?.total_revenue || 0,
        JSON.stringify({ orders }),
        new Date().toISOString(),
        existingReport.id
      )

      res.status(201).json({ message: 'Полный отчёт сохранён' })
    })
  )

  // POST /api/orders/:id/duplicate — дублировать заказ
  app.post(
    '/api/orders/:id/duplicate',
    asyncHandler(async (req, res) => {
      const originalOrderId = Number(req.params.id)
      const originalOrder = await db.get<Order>('SELECT * FROM orders WHERE id = ?', originalOrderId)
      
      if (!originalOrder) {
        res.status(404).json({ message: 'Заказ не найден' })
        return
      }

      // Создаём новый заказ
      const newOrderNumber = `${originalOrder.number}-COPY-${Date.now()}`
      const createdAt = new Date().toISOString()
      
      const newOrderResult = await db.run(
        'INSERT INTO orders (number, status, createdAt, customerName, customerPhone, customerEmail, prepaymentAmount, prepaymentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newOrderNumber,
        1, // Новый статус
        createdAt,
        originalOrder.customerName,
        originalOrder.customerPhone,
        originalOrder.customerEmail,
        null, // Сбрасываем предоплату
        null
      )

      const newOrderId = newOrderResult.lastID

      // Копируем позиции
      const originalItems = await db.all<any>('SELECT * FROM items WHERE orderId = ?', originalOrderId)
      for (const item of originalItems) {
        await db.run(
          'INSERT INTO items (orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          newOrderId,
          item.type,
          typeof item.params === 'string' ? item.params : JSON.stringify(item.params),
          item.price,
          item.quantity,
          item.printerId,
          item.sides,
          item.sheets,
          item.waste,
          item.clicks
        )
      }

      // Получаем созданный заказ с позициями
      const newOrder = await db.get<any>('SELECT * FROM orders WHERE id = ?', newOrderId)
      const newItems = await db.all<any>('SELECT * FROM items WHERE orderId = ?', newOrderId)
      
      if (newOrder) {
        newOrder.items = newItems.map((item: any) => ({
          ...item,
          params: typeof item.params === 'string' ? JSON.parse(item.params) : item.params
        }))
      }

      res.status(201).json(newOrder)
    })
  )

  // DELETE /api/orders/:orderId/items/:itemId — удалить позицию
  app.delete(
    '/api/orders/:orderId/items/:itemId',
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.orderId)
      const itemId = Number(req.params.itemId)
      const authUser = (req as any).user as { id: number } | undefined

      // Находим позицию и её состав материалов
      const it = await db.get<{
        id: number
        type: string
        params: string
        quantity: number
      }>(
        'SELECT id, type, params, quantity FROM items WHERE orderId = ? AND id = ?',
        orderId,
        itemId
      )

      if (!it) {
        // Нечего возвращать, просто 204
        await db.run('DELETE FROM items WHERE orderId = ? AND id = ?', orderId, itemId)
        res.status(204).end()
        return
      }

      const paramsObj = JSON.parse(it.params || '{}') as { description?: string }
      const composition = (await db.all<{
        materialId: number
        qtyPerItem: number
      }>(
        'SELECT materialId, qtyPerItem FROM product_materials WHERE presetCategory = ? AND presetDescription = ?',
        it.type,
        paramsObj.description || ''
      )) as unknown as Array<{ materialId: number; qtyPerItem: number }>

      await db.run('BEGIN')
      try {
        for (const c of composition) {
          const returnQty = (c.qtyPerItem || 0) * Math.max(1, Number(it.quantity) || 1)
          if (returnQty > 0) {
            await db.run(
              'UPDATE materials SET quantity = quantity + ? WHERE id = ?',
              returnQty,
              c.materialId
            )
            await db.run(
              'INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)',
              c.materialId,
              returnQty,
              'order delete item',
              orderId,
              authUser?.id ?? null
            )
          }
        }

        await db.run('DELETE FROM items WHERE orderId = ? AND id = ?', orderId, itemId)
        await db.run('COMMIT')
        res.status(204).end()
      } catch (e) {
        await db.run('ROLLBACK')
        throw e
      }
    })
  )

  // DELETE /api/orders/:id — удалить заказ
  app.delete(
    '/api/orders/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const authUser = (req as any).user as { id: number } | undefined
      // Собираем все позиции заказа и их состав
      const items = (await db.all<{
        id: number
        type: string
        params: string
        quantity: number
      }>(
        'SELECT id, type, params, quantity FROM items WHERE orderId = ?',
        id
      )) as unknown as Array<{ id: number; type: string; params: string; quantity: number }>

      // Агрегируем возвраты по materialId
      const returns: Record<number, number> = {}
      for (const it of items) {
        const paramsObj = JSON.parse(it.params || '{}') as { description?: string }
        const composition = (await db.all<{
          materialId: number
          qtyPerItem: number
        }>(
          'SELECT materialId, qtyPerItem FROM product_materials WHERE presetCategory = ? AND presetDescription = ?',
          it.type,
          paramsObj.description || ''
        )) as unknown as Array<{ materialId: number; qtyPerItem: number }>
        for (const c of composition) {
          const add = (c.qtyPerItem || 0) * Math.max(1, Number(it.quantity) || 1)
          returns[c.materialId] = (returns[c.materialId] || 0) + add
        }
      }

      await db.run('BEGIN')
      try {
        for (const mid of Object.keys(returns)) {
          const materialId = Number(mid)
          const addQty = returns[materialId]
          if (addQty > 0) {
            await db.run(
              'UPDATE materials SET quantity = quantity + ? WHERE id = ?',
              addQty,
              materialId
            )
            await db.run(
              'INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)',
              materialId,
              addQty,
              'order delete',
              id,
              authUser?.id ?? null
            )
          }
        }

        // Удаляем заказ (позиции удалятся каскадно)
        await db.run('DELETE FROM orders WHERE id = ?', id)
        await db.run('COMMIT')
        res.status(204).end()
      } catch (e) {
        await db.run('ROLLBACK')
        throw e
      }
    })
  )

  // GET /api/materials — список материалов
  app.get(
    '/api/materials',
    asyncHandler(async (_req, res) => {
      const materials = await db.all<Material>(
        'SELECT id, name, unit, quantity, min_quantity as min_quantity FROM materials ORDER BY name'
      ) as any
      res.json(materials)
    })
  )

  // ===== Files per order =====
  // GET list
  app.get(
    '/api/orders/:id/files',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id)
      const rows = await db.all<any>(
        'SELECT id, orderId, filename, originalName, mime, size, uploadedAt, approved, approvedAt, approvedBy FROM order_files WHERE orderId = ? ORDER BY id DESC',
        id
      )
      res.json(rows)
    })
  )
  // POST upload
  app.post(
    '/api/orders/:id/files',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.id)
      const f = (req as any).file as { filename: string; originalname?: string; mimetype?: string; size?: number } | undefined
      if (!f) { res.status(400).json({ message: 'Файл не получен' }); return }
      await db.run(
        'INSERT INTO order_files (orderId, filename, originalName, mime, size) VALUES (?, ?, ?, ?, ?)',
        orderId,
        f.filename,
        f.originalname || null,
        f.mimetype || null,
        f.size || null
      )
      const row = await db.get<any>(
        'SELECT id, orderId, filename, originalName, mime, size, uploadedAt, approved, approvedAt, approvedBy FROM order_files WHERE orderId = ? ORDER BY id DESC LIMIT 1',
        orderId
      )
      res.status(201).json(row)
    })
  )
  // DELETE file
  app.delete(
    '/api/orders/:orderId/files/:fileId',
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.orderId)
      const fileId = Number(req.params.fileId)
      const row = await db.get<any>('SELECT filename FROM order_files WHERE id = ? AND orderId = ?', fileId, orderId)
      if (row && row.filename) {
        const p = path.join(uploadsDir, String(row.filename))
        try { fs.unlinkSync(p) } catch {}
      }
      await db.run('DELETE FROM order_files WHERE id = ? AND orderId = ?', fileId, orderId)
      res.status(204).end()
    })
  )
  // APPROVE file
  app.post(
    '/api/orders/:orderId/files/:fileId/approve',
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.orderId)
      const fileId = Number(req.params.fileId)
      const user = (req as any).user as { id: number } | undefined
      await db.run(
        "UPDATE order_files SET approved = 1, approvedAt = datetime('now'), approvedBy = ? WHERE id = ? AND orderId = ?",
        user?.id ?? null,
        fileId,
        orderId
      )
      const row = await db.get<any>(
        'SELECT id, orderId, filename, originalName, mime, size, uploadedAt, approved, approvedAt, approvedBy FROM order_files WHERE id = ? AND orderId = ?',
        fileId,
        orderId
      )
      res.json(row)
    })
  )

  // GET /api/order-statuses — список статусов для фронта
  app.get(
    '/api/order-statuses',
    asyncHandler(async (_req, res) => {
      const rows = await db.all<{ id: number; name: string; color: string | null; sort_order: number }>(
        'SELECT id, name, color, sort_order FROM order_statuses ORDER BY sort_order'
      )
      res.json(rows)
    })
  )

  // Printers
  app.get(
    '/api/printers',
    asyncHandler(async (_req, res) => {
      const rows = await db.all<{ id: number; code: string; name: string }>('SELECT id, code, name FROM printers ORDER BY name')
      res.json(rows)
    })
  )

  // Printer counters by date (with previous for delta)
  app.get(
    '/api/printers/counters',
    asyncHandler(async (req, res) => {
      const date = String((req.query as any)?.date || '').slice(0, 10)
      if (!date) { res.status(400).json({ message: 'date=YYYY-MM-DD required' }); return }
      const rows = await db.all<any>(
        `SELECT p.id, p.code, p.name,
                pc.value as value,
                (
                  SELECT pc2.value FROM printer_counters pc2
                   WHERE pc2.printer_id = p.id AND pc2.counter_date < ?
                   ORDER BY pc2.counter_date DESC LIMIT 1
                ) as prev_value
           FROM printers p
      LEFT JOIN printer_counters pc ON pc.printer_id = p.id AND pc.counter_date = ?
          ORDER BY p.name`,
        date,
        date
      )
      res.json(rows)
    })
  )

  // Daily summary
  app.get(
    '/api/reports/daily/:date/summary',
    asyncHandler(async (req, res) => {
      const d = String(req.params.date || '').slice(0, 10)
      if (!d) { res.status(400).json({ message: 'date required' }); return }
      const ordersCount = await db.get<{ c: number }>(
        `SELECT COUNT(1) as c FROM orders WHERE substr(createdAt,1,10) = ?`, d
      )
      const sums = await db.get<any>(
        `SELECT 
            COALESCE(SUM(i.price * i.quantity), 0) as total_revenue,
            COALESCE(SUM(i.quantity), 0) as items_qty,
            COALESCE(SUM(i.clicks), 0) as total_clicks,
            COALESCE(SUM(i.sheets), 0) as total_sheets,
            COALESCE(SUM(i.waste), 0) as total_waste
         FROM items i
         JOIN orders o ON o.id = i.orderId
        WHERE substr(o.createdAt,1,10) = ?`, d
      )
      const prepay = await db.get<any>(
        `SELECT 
            COALESCE(SUM(CASE WHEN prepaymentStatus IN ('paid','successful') THEN prepaymentAmount ELSE 0 END),0) as paid_amount,
            COALESCE(SUM(CASE WHEN prepaymentStatus NOT IN ('paid','successful') THEN prepaymentAmount ELSE 0 END),0) as pending_amount,
            COALESCE(SUM(prepaymentAmount),0) as total_amount,
            COALESCE(SUM(CASE WHEN prepaymentStatus IN ('paid','successful') THEN 1 ELSE 0 END),0) as paid_count
           FROM orders WHERE substr(createdAt,1,10) = ?`, d
      )
      const materials = await db.all<any>(
        `SELECT m.id as materialId, m.name as material_name,
                SUM(CASE WHEN mm.delta < 0 THEN -mm.delta ELSE 0 END) AS spent
           FROM material_moves mm
           JOIN materials m ON m.id = mm.materialId
          WHERE substr(mm.created_at,1,10) = ?
          GROUP BY m.id, m.name
          ORDER BY spent DESC
          LIMIT 5`, d
      )
      res.json({
        date: d,
        orders_count: Number((ordersCount as any)?.c || 0),
        total_revenue: Number(sums?.total_revenue || 0),
        items_qty: Number(sums?.items_qty || 0),
        total_clicks: Number(sums?.total_clicks || 0),
        total_sheets: Number(sums?.total_sheets || 0),
        total_waste: Number(sums?.total_waste || 0),
        prepayment: prepay,
        materials_spent_top: materials
      })
    })
  )

  // Materials low stock and reports
  app.get(
    '/api/materials/low-stock',
    asyncHandler(async (_req, res) => {
      const rows = await db.all<any>(`SELECT id, name, unit, quantity, min_quantity as min_quantity FROM materials WHERE min_quantity IS NOT NULL AND quantity <= min_quantity ORDER BY name`)
      res.json(rows)
    })
  )
  app.get(
    '/api/materials/report/top',
    asyncHandler(async (req, res) => {
      const { from, to, limit = 10 } = req.query as any
      const where: string[] = []
      const params: any[] = []
      if (from) { where.push('mm.created_at >= ?'); params.push(String(from)) }
      if (to) { where.push('mm.created_at <= ?'); params.push(String(to)) }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
      const rows = await db.all<any>(
        `SELECT m.id, m.name, SUM(CASE WHEN mm.delta < 0 THEN -mm.delta ELSE 0 END) AS spent
           FROM material_moves mm
           JOIN materials m ON m.id = mm.materialId
          ${whereSql}
          GROUP BY m.id, m.name
          ORDER BY spent DESC
          LIMIT ?`,
        ...params,
        Number(limit)
      )
      res.json(rows)
    })
  )
  app.get(
    '/api/materials/report/forecast',
    asyncHandler(async (_req, res) => {
      const rows = await db.all<any>(
        `SELECT m.id, m.name, m.unit, m.quantity, m.min_quantity,
                ROUND(m.quantity * 0.5, 2) AS suggested_order
           FROM materials m
          WHERE m.min_quantity IS NOT NULL AND m.quantity <= m.min_quantity
          ORDER BY (m.min_quantity - m.quantity) DESC`
      )
      res.json(rows)
    })
  )

  // Printer counters submit
  app.post(
    '/api/printers/:id/counters',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      const id = Number(req.params.id)
      const { counter_date, value } = req.body as { counter_date: string; value: number }
      try {
        await db.run('INSERT OR REPLACE INTO printer_counters (printer_id, counter_date, value) VALUES (?, ?, ?)', id, counter_date, Number(value))
      } catch (e) { throw e }
      const row = await db.get<any>('SELECT id, printer_id, counter_date, value, created_at FROM printer_counters WHERE printer_id = ? AND counter_date = ?', id, counter_date)
      res.status(201).json(row)
    })
  )

  // ===== Calculators (MVP) =====
  const FLYERS_SCHEMA = {
    slug: 'flyers-color',
    name: 'Листовки цветные',
    options: {
      format: ['A6', 'A5', 'A4'],
      sides: [1, 2],
      qtySteps: [50, 100, 200, 300, 500, 1000, 2000, 5000],
      paperDensity: [130, 170],
      lamination: ['none', 'matte', 'glossy'],
      priceType: ['rush', 'online', 'promo']
    }
  }
  // Qty-based discount is embedded into pricing tiers now to match karandash.by.
  // Keep function returning 1 to avoid double-discounting.
  const FLYERS_QTY_DISCOUNTS: Array<{ minQty: number; k: number }> = []
  function getQtyDiscountK(_qty: number): number { return 1 }
  const FLYERS_BASE_PRICE: Record<string, number> = { // BYN per item, 1 side
    A6: 0.05,
    A5: 0.08,
    A4: 0.12
  }
  // Sheet-based pricing (BYN per SRA3 sheet, single-side)
  const FLYERS_SHEET_PRICE: Record<number, number> = { 130: 0.4, 150: 0.5 }
  const LAM_SHEET_PRICE: Record<string, number> = { matte: 0.2, glossy: 0.2 }
  const FLYERS_UP_ON_SRA3: Record<string, number> = {
    A6: 8,
    A5: 4,
    A4: 2
  }
  function getMaterialIdByDensity(d: number): Promise<number | undefined> {
    const name = d >= 150 ? 'Бумага мелованная 150 г/м², SRA3' : 'Бумага мелованная 130 г/м², SRA3'
    return db.get<{ id: number }>('SELECT id FROM materials WHERE name = ?', name).then(r => (r as any)?.id)
  }
  function getLaminationMatId(type: string): Promise<number | undefined> {
    const name = type === 'glossy' ? 'Плёнка ламинации глянцевая 35 мкм, SRA3' : 'Плёнка ламинации матовая 35 мкм, SRA3'
    return db.get<{ id: number }>('SELECT id FROM materials WHERE name = ?', name).then(r => (r as any)?.id)
  }
  app.get('/api/calculators/flyers-color', (_req, res) => {
    res.json(FLYERS_SCHEMA)
  })
  // Anchor totals from karandash.by for A6, qty=100, sides=2, lamination=none (to calibrate multipliers)
  const FLYERS_ANCHOR_TOTAL: Record<'rush'|'online'|'promo', number> = {
    rush: Number(process.env.FLYERS_ANCHOR_RUSH || 104.85),
    online: Number(process.env.FLYERS_ANCHOR_ONLINE || 89.86),
    promo: Number(process.env.FLYERS_ANCHOR_PROMO || 41.23)
  }
  async function resolveSheetSinglePrice(format: string, priceType: 'rush'|'online'|'promo', qty: number, paperDensity: number): Promise<number> {
    const row = await db.get<{ sheet_price_single: number }>(
      `SELECT sheet_price_single FROM pricing_flyers_tiers
        WHERE format = ? AND price_type = ? AND paper_density = ? AND min_qty <= ?
        ORDER BY min_qty DESC LIMIT 1`, format, priceType, paperDensity, qty
    )
    return Number((row as any)?.sheet_price_single || 0)
  }

  app.post('/api/calculators/flyers-color/price', async (req, res) => {
    const { format, qty, sides, paperDensity, lamination, priceType } = (req.body || {}) as {
      format: 'A6'|'A5'|'A4'; qty: number; sides: 1|2; paperDensity: 130|150; lamination: 'none'|'matte'|'glossy'; priceType?: 'rush'|'online'|'promo'
    }
    if (!format || !qty || !sides) { res.status(400).json({ message: 'format, qty, sides обязательны' }); return }
    const up = FLYERS_UP_ON_SRA3[format] || 8
    const sra3PerItem = 1 / up
    const wasteRatio = 0.02
    const totalSheets = Math.ceil(qty * sra3PerItem * (1 + wasteRatio))

    // Sheet-based price
    const baseSheet = FLYERS_SHEET_PRICE[Number(paperDensity) || 130] ?? 0.4
    const sidesK = sides === 2 ? 1.6 : 1
    // Flyers: ламинацию для листовок не учитываем в стоимости
    const lamPS = 0
    const type = (priceType || 'rush') as 'rush'|'online'|'promo'
    // Pricing from tiers table
    const singleFromTier = await resolveSheetSinglePrice(format, type, Number(qty) || 0, Number(paperDensity) || 130)
    const sheetPrice = Math.round(((singleFromTier * sidesK) + lamPS) * 100) / 100
    const discountK = getQtyDiscountK(Number(qty) || 0)
    const totalPrice = Math.round((totalSheets * sheetPrice * discountK) * 100) / 100
    const pricePerItem = Math.round(((totalPrice / Math.max(1, qty))) * 100) / 100

    const paperId = await getMaterialIdByDensity(Number(paperDensity) || 130)
    // Flyers: не добавляем компонент ламинации
    const lamId = undefined
    const components: Array<{ materialId: number; qtyPerItem: number }> = []
    if (paperId) components.push({ materialId: paperId, qtyPerItem: sra3PerItem * (1 + wasteRatio) })
    if (lamId) components.push({ materialId: lamId, qtyPerItem: sra3PerItem * (1 + wasteRatio) })

    res.json({ pricePerItem, totalPrice, totalSheets, components, derived: { up, sra3PerItem, wasteRatio, discountK } })
  })

  // POST /api/materials — создать или обновить материал
  app.post(
    '/api/materials',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      const mat = req.body as Material & { sheet_price_single?: number | null }
      try {
        if (mat.id) {
          await db.run(
            'UPDATE materials SET name = ?, unit = ?, quantity = ?, min_quantity = ?, sheet_price_single = ? WHERE id = ?',
            mat.name,
            mat.unit,
            mat.quantity,
            mat.min_quantity ?? null,
            mat.sheet_price_single ?? null,
            mat.id
          )
        } else {
          await db.run(
            'INSERT INTO materials (name, unit, quantity, min_quantity, sheet_price_single) VALUES (?, ?, ?, ?, ?)',
            mat.name,
            mat.unit,
            mat.quantity,
            mat.min_quantity ?? null,
            mat.sheet_price_single ?? null
          )
        }
      } catch (e: any) {
        if (e && typeof e.message === 'string' && e.message.includes('UNIQUE constraint failed: materials.name')) {
          const err: any = new Error('Материал с таким именем уже существует')
          err.status = 409
          throw err
        }
        throw e
      }
      const allMats = await db.all<Material & { sheet_price_single: number | null }>(
        'SELECT id, name, unit, quantity, min_quantity as min_quantity, sheet_price_single FROM materials ORDER BY name'
      ) as any
      res.json(allMats)
    })
  )

  // Admin utility: normalize item prices to price-per-item for a specific order
  app.post(
    '/api/orders/:id/normalize-prices',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      const orderId = Number(req.params.id)
      const items = await db.all<any>('SELECT id, price, quantity FROM items WHERE orderId = ?', orderId)
      let updated = 0
      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity) || 1)
        const price = Number(it.price) || 0
        // Heuristic: if qty>1 and price likely contains total (per-item > 10 BYN or qty>=50 and per-item > 3 BYN)
        const perItem = price / qty
        const shouldFix = qty > 1 && (perItem === 0 ? false : (perItem > 10 || (qty >= 50 && perItem > 3)))
        if (shouldFix) {
          await db.run('UPDATE items SET price = ? WHERE id = ? AND orderId = ?', perItem, it.id, orderId)
          updated++
        }
      }
      res.json({ orderId, updated })
    })
  )

  // GET /api/materials/moves — история движений с фильтрами
  app.get(
    '/api/materials/moves',
    asyncHandler(async (req, res) => {
      const { materialId, user_id, orderId, from, to } = req.query as any
      const where: string[] = []
      const params: any[] = []
      if (materialId) { where.push('mm.materialId = ?'); params.push(Number(materialId)) }
      if (user_id) { where.push('mm.user_id = ?'); params.push(Number(user_id)) }
      if (orderId) { where.push('mm.orderId = ?'); params.push(Number(orderId)) }
      if (from) { where.push('mm.created_at >= ?'); params.push(String(from)) }
      if (to) { where.push('mm.created_at <= ?'); params.push(String(to)) }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
      const rows = await db.all<any>(
        `SELECT mm.id, mm.materialId, m.name as material_name, mm.delta, mm.reason, mm.orderId, mm.user_id, mm.created_at
           FROM material_moves mm
           JOIN materials m ON m.id = mm.materialId
          ${whereSql}
          ORDER BY mm.created_at DESC, mm.id DESC`,
        ...params
      )
      res.json(rows)
    })
  )

  // DELETE /api/materials/:id — удалить материал
  app.delete(
    '/api/materials/:id',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      await db.run('DELETE FROM materials WHERE id = ?', Number(req.params.id))
      res.status(204).end()
    })
  )

  // POST /api/materials/spend — админское движение материалов (+/-)
  app.post(
    '/api/materials/spend',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      const { materialId, delta, reason, orderId } = req.body as { materialId: number; delta: number; reason?: string; orderId?: number }
      await db.run('BEGIN')
      try {
        await db.run('UPDATE materials SET quantity = quantity + ? WHERE id = ?', Number(delta), Number(materialId))
        await db.run('INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)', materialId, Number(delta), reason || null, orderId || null, user.id)
        await db.run('COMMIT')
      } catch (e) {
        await db.run('ROLLBACK')
        throw e
      }
      const mat = await db.get<Material>('SELECT * FROM materials WHERE id = ?', Number(materialId))
      res.json(mat)
    })
  )

  // GET /api/product-materials/:category/:description
  app.get(
    '/api/product-materials/:category/:description',
    asyncHandler(async (req, res) => {
      const rows = await db.all<ProductMaterial & {
        name: string
        unit: string
        quantity: number
        min_quantity: number | null
      }>(
        `SELECT pm.materialId, pm.qtyPerItem, m.name, m.unit, m.quantity, m.min_quantity as min_quantity
           FROM product_materials pm
           JOIN materials m ON m.id = pm.materialId
           WHERE pm.presetCategory = ? AND pm.presetDescription = ?`,
        req.params.category,
        req.params.description
      )
      res.json(rows)
    })
  )

  // GET /api/presets — список категорий с их товарами и допами
  app.get(
    '/api/presets',
    asyncHandler(async (_req, res) => {
      const categories = (await db.all<{ id: number; category: string; color: string }>(
        'SELECT id, category, color FROM preset_categories ORDER BY category'
      )) as unknown as Array<{ id: number; category: string; color: string }>
      const items = (await db.all<{ id: number; category_id: number; description: string; price: number }>(
        'SELECT id, category_id, description, price FROM preset_items'
      )) as unknown as Array<{ id: number; category_id: number; description: string; price: number }>
      const extras = (await db.all<{ id: number; category_id: number; name: string; price: number; type: string; unit: string | null }>(
        'SELECT id, category_id, name, price, type, unit FROM preset_extras'
      )) as unknown as Array<{ id: number; category_id: number; name: string; price: number; type: string; unit: string | null }>
      const result = categories.map((c) => ({
        category: c.category,
        color: c.color,
        items: items
          .filter((i) => i.category_id === c.id)
          .map((i) => ({ description: i.description, price: i.price })),
        extras: extras
          .filter((e) => e.category_id === c.id)
          .map((e) => ({ name: e.name, price: e.price, type: e.type as any, unit: e.unit || undefined }))
      }))
      res.json(result)
    })
  )

  // POST /api/product-materials — задать состав материалов для пресета
  app.post(
    '/api/product-materials',
    asyncHandler(async (req, res) => {
      const user = (req as any).user as { id: number; role: string } | undefined
      if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Forbidden' }); return }
      const {
        presetCategory,
        presetDescription,
        materials
      } = req.body as {
        presetCategory: string
        presetDescription: string
        materials: { materialId: number; qtyPerItem: number }[]
      }

      await db.run(
        'DELETE FROM product_materials WHERE presetCategory = ? AND presetDescription = ?',
        presetCategory,
        presetDescription
      )
      for (const m of materials) {
        await db.run(
          'INSERT INTO product_materials (presetCategory, presetDescription, materialId, qtyPerItem) VALUES (?, ?, ?, ?)',
          presetCategory,
          presetDescription,
          m.materialId,
          m.qtyPerItem
        )
      }
      res.status(204).end()
    })
  )

  // PATCH /api/orders/:orderId/items/:itemId — обновление позиции (и перерасчёт материалов при смене количества)
  app.patch(
    '/api/orders/:orderId/items/:itemId',
    asyncHandler(async (req, res) => {
      const orderId = Number(req.params.orderId)
      const itemId = Number(req.params.itemId)
      const body = req.body as Partial<{
        price: number
        quantity: number
        printerId: number | null
        sides: number
        sheets: number
        waste: number
      }>

      const existing = await db.get<{
        id: number
        orderId: number
        type: string
        params: string
        price: number
        quantity: number
        printerId: number | null
        sides: number
        sheets: number
        waste: number
      }>('SELECT id, orderId, type, params, price, quantity, printerId, sides, sheets, waste FROM items WHERE id = ? AND orderId = ?', itemId, orderId)
      if (!existing) { res.status(404).json({ message: 'Позиция не найдена' }); return }

      const newQuantity = body.quantity != null ? Math.max(1, Number(body.quantity) || 1) : existing.quantity
      const deltaQty = newQuantity - (existing.quantity ?? 1)

      await db.run('BEGIN')
      try {
        if (deltaQty !== 0) {
          const paramsObj = JSON.parse(existing.params || '{}') as { description?: string }
          const composition = (await db.all<{
            materialId: number
            qtyPerItem: number
            quantity: number
          }>(
            `SELECT pm.materialId, pm.qtyPerItem, m.quantity
               FROM product_materials pm
               JOIN materials m ON m.id = pm.materialId
              WHERE pm.presetCategory = ? AND pm.presetDescription = ?`,
            existing.type,
            paramsObj.description || ''
          )) as unknown as Array<{ materialId: number; qtyPerItem: number; quantity: number }>
          if (deltaQty > 0) {
            // Проверяем остатки
            for (const c of composition) {
              const need = (c.qtyPerItem || 0) * deltaQty
              if (c.quantity < need) {
                const err: any = new Error(`Недостаточно материала ID=${c.materialId}`)
                err.status = 400
                throw err
              }
            }
            for (const c of composition) {
              const need = (c.qtyPerItem || 0) * deltaQty
              if (need > 0) await db.run('UPDATE materials SET quantity = quantity - ? WHERE id = ?', need, c.materialId)
              if (need > 0) await db.run('INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)', c.materialId, -need, 'order update qty +', orderId, (req as any).user?.id ?? null)
            }
          } else {
            for (const c of composition) {
              const back = (c.qtyPerItem || 0) * Math.abs(deltaQty)
              if (back > 0) await db.run('UPDATE materials SET quantity = quantity + ? WHERE id = ?', back, c.materialId)
              if (back > 0) await db.run('INSERT INTO material_moves (materialId, delta, reason, orderId, user_id) VALUES (?, ?, ?, ?, ?)', c.materialId, back, 'order update qty -', orderId, (req as any).user?.id ?? null)
            }
          }
        }

        const nextSides = body.sides != null ? Math.max(1, Number(body.sides) || 1) : existing.sides
        const nextSheets = body.sheets != null ? Math.max(0, Number(body.sheets) || 0) : existing.sheets
        const clicks = nextSheets * (nextSides * 2)

        await db.run(
          `UPDATE items SET 
              ${body.price != null ? 'price = ?,' : ''}
              ${body.quantity != null ? 'quantity = ?,' : ''}
              ${body.printerId !== undefined ? 'printerId = ?,' : ''}
              ${body.sides != null ? 'sides = ?,' : ''}
              ${body.sheets != null ? 'sheets = ?,' : ''}
              ${body.waste != null ? 'waste = ?,' : ''}
              clicks = ?
           WHERE id = ? AND orderId = ?`,
          ...([body.price != null ? Number(body.price) : []] as any),
          ...([body.quantity != null ? newQuantity : []] as any),
          ...([body.printerId !== undefined ? (body.printerId as any) : []] as any),
          ...([body.sides != null ? nextSides : []] as any),
          ...([body.sheets != null ? nextSheets : []] as any),
          ...([body.waste != null ? Math.max(0, Number(body.waste) || 0) : []] as any),
          clicks,
          itemId,
          orderId
        )

        await db.run('COMMIT')
      } catch (e) {
        await db.run('ROLLBACK')
        throw e
      }

      const updated = await db.get<any>('SELECT id, orderId, type, params, price, quantity, printerId, sides, sheets, waste, clicks FROM items WHERE id = ? AND orderId = ?', itemId, orderId)
      res.json({
        id: updated.id,
        orderId: updated.orderId,
        type: updated.type,
        params: JSON.parse(updated.params || '{}'),
        price: updated.price,
        quantity: updated.quantity,
        printerId: updated.printerId ?? undefined,
        sides: updated.sides,
        sheets: updated.sheets,
        waste: updated.waste,
        clicks: updated.clicks
      })
    })
  )

  // Error-handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const showStack = (process.env.NODE_ENV !== 'production') && (process.env.SHOW_ERROR_STACK !== 'false')
    const payload: any = { error: err.message }
    if (showStack) payload.stack = err.stack
    // JSON structured log
    try { console.error(JSON.stringify({ level: 'error', msg: err.message, stack: showStack ? err.stack : undefined })) } catch {}
    res.status(err.status || 500).json(payload)
  })

  const PORT = Number(process.env.PORT || 3001)
  app.listen(PORT, '0.0.0.0', () => {
    try { console.log(JSON.stringify({ level: 'info', msg: 'API started', port: PORT })) } catch { console.log(`🚀 API running at http://localhost:${PORT}`) }
  })
}

main().catch(err => {
  console.error('⛔ Fatal startup error:', err)
  process.exit(1)
})
