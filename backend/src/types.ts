export interface Item {
  id: number;
  orderId: number;
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

export interface Material {
  id: number;
  name: string;
  unit: string;
  quantity: number;
}

export interface ProductMaterial {
  presetCategory: string;
  presetDescription: string;
  materialId: number;
  qtyPerItem: number;
}
