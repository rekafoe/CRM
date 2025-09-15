import React, { useEffect, useState } from 'react';
import { PresetCategory, MaterialRow, Item, Order } from '../types';
import { defaultPresets } from '../presets';
import { addOrderItem, getProductMaterials } from '../api';

interface Props {
  order: Order;
  onSave: () => void;
  onClose: () => void;
}

export default function AddItemModal({ order, onSave, onClose }: Props) {
  const [presets] = useState<PresetCategory[]>(() => {
    const stored = localStorage.getItem('crmPresets');
    if (stored) {
      try { return JSON.parse(stored) as PresetCategory[]; } catch {}
    }
    return defaultPresets;
  });
  const [category, setCategory] = useState<PresetCategory | null>(null);
  const [product, setProduct] = useState<PresetCategory['items'][0] | null>(null);
  const [price, setPrice] = useState(0);
  const [extras, setExtras] = useState<Record<string, number | boolean>>({});
  const [required, setRequired] = useState<MaterialRow[]>([]);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    if (product && category) {
      getProductMaterials(category.category, product.description).then(res => {
        setRequired(res.data);
        setOk(res.data.every(r => r.quantity >= r.qtyPerItem));
      });
    }
  }, [product, category]);

  function handleSave() {
    if (!product || !category) return;
    const params = { description: product.description };
    const item: Omit<Item, 'id'> = {
      type: category.category,
      params,
      price: price || product.price
    };
    addOrderItem(order.id, item).then(onSave);
  }

  return (
    <div className="modal">
      <h3>Add Item</h3>
      <div>
        <select onChange={e => {
          const cat = presets.find(p => p.category === e.target.value)!;
          setCategory(cat);
          setProduct(null);
          setPrice(0);
        }}>
          <option value="">Select Category</option>
          {presets.map(p => (
            <option key={p.category} value={p.category}>{p.category}</option>
          ))}
        </select>
      </div>

      {category && (
        <div>
          <select onChange={e => {
            const prod = category.items.find(i => i.description === e.target.value)!;
            setProduct(prod);
            setPrice(prod.price);
          }}>
            <option value="">Select Product</option>
            {category.items.map(i => (
              <option key={i.description} value={i.description}>
                {i.description} ({i.price})
              </option>
            ))}
          </select>
        </div>
      )}

      {product && (
        <div>
          <p>Base Price: {product.price}</p>
          <p>
            Custom Price:{' '}
            <input
              type="number"
              value={price}
              onChange={e => setPrice(Number(e.target.value))}
            />
          </p>
        </div>
      )}

      {required.length > 0 && (
        <div style={{ color: ok ? 'green' : 'red' }}>
          {required.map(r => (
            <div key={r.materialId}>
              {r.name}: {r.quantity}{r.unit} / needs {r.qtyPerItem}{r.unit}
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose}>Cancel</button>
      <button onClick={handleSave} disabled={!product || !ok}>Save</button>
    </div>
  );
}
