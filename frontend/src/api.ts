import axios from 'axios';
import { Order, Item, PresetCategory, MaterialRow, Material } from './types';

const api = axios.create({ baseURL: '/api' });

export const getOrders = () => api.get<Order[]>('/orders');
export const createOrder = () => api.post<Order>('/orders');
export const updateOrderStatus = (id: number, status: number) =>
  api.put<Order>(`/orders/${id}/status`, { status });

export const addOrderItem = (id: number, item: Omit<Item, 'id'>) =>
  api.post<Item>(`/orders/${id}/items`, item);

export const deleteOrder = (id: number) => api.delete(`/orders/${id}`);
export const deleteOrderItem = (orderId: number, itemId: number) =>
  api.delete(`/orders/${orderId}/items/${itemId}`);

export const getMaterials = () => api.get<Material[]>('/materials');
export const saveMaterial = (mat: Partial<Material>) =>
  api.post<Material[]>('/materials', mat);
export const deleteMaterial = (id: number) => api.delete(`/materials/${id}`);

export const getProductMaterials = (cat: string, desc: string) =>
  api.get<MaterialRow[]>(`/product-materials/${encodeURIComponent(cat)}/${encodeURIComponent(desc)}`);
export const saveProductMaterials = (cfg: {
  presetCategory: string;
  presetDescription: string;
  materials: { materialId: number; qtyPerItem: number }[];
}) => api.post('/product-materials', cfg);
