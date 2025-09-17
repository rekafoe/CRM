export interface Item {
  id: number;
  type: string;
  params: { description: string; paperDensity?: number; paperName?: string; lamination?: 'none'|'matte'|'glossy' };
  price: number;
  quantity?: number;
  printerId?: number;
  sides?: number;
  sheets?: number;
  waste?: number;
  clicks?: number;
}

export interface Order {
  id: number;
  number: string;
  status: number;
  createdAt: string;
  userId?: number;
  // Optional customer and prepayment fields synced with backend
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  prepaymentAmount?: number;
  prepaymentStatus?: string;
  paymentUrl?: string;
  paymentId?: string;
  items: Item[];
}

export interface PresetExtra {
  name: string;
  price: number;
  type: 'checkbox' | 'number';
  unit?: string;
}

export interface PresetItem {
  description: string;
  price: number;
}

export interface PresetCategory {
  category: string;
  color: string;
  items: PresetItem[];
  extras: PresetExtra[];
}

export interface Material {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  min_quantity?: number;
  sheet_price_single?: number | null;
}

export interface MaterialRow {
  materialId: number;
  qtyPerItem: number;
  name: string;
  unit: string;
  quantity: number;
}
// frontend/src/types.ts
export interface DailyReport {
  id: number;
  report_date: string;
  orders_count: number;
  total_revenue: number;
  created_at: string;
  updated_at?: string;
  user_id?: number;
  user_name?: string | null;
  cash_actual?: number;
  // Полная информация о заказах в отчёте
  orders?: Order[];
  // Метаданные отчёта
  report_metadata?: {
    total_orders: number;
    total_revenue: number;
    orders_by_status: Record<number, number>;
    revenue_by_status: Record<number, number>;
    created_by: number;
    last_modified: string;
  };
}

export interface UserRef { id: number; name: string }

export interface OrderFile {
  id: number;
  orderId: number;
  filename: string;
  originalName?: string;
  mime?: string;
  size?: number;
  uploadedAt: string;
  approved: number;
  approvedAt?: string;
  approvedBy?: number;
}

export interface Printer { id: number; code: string; name: string }

// App-level configuration constants
export const APP_CONFIG = {
  storage: {
    token: 'crmToken',
    role: 'crmRole',
    sessionDate: 'crmSessionDate',
    userId: 'crmUserId'
  },
  apiBase: '/api'
} as const
