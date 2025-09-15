export interface Item {
  id: number;
  type: string;
  params: { description: string };
  price: number;
}

export interface Order {
  id: number;
  number: string;
  status: number;
  createdAt: string;
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
}
