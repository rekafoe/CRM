import React, { useState } from 'react';
import { addOrderItem, calcFlyersPrice } from '../api';
import type { Order } from '../types';

interface Props {
  order: Order;
  onSave: () => void;
  onClose: () => void;
}

export default function FlyersCalculatorModal({ order, onSave, onClose }: Props) {
  const [format, setFormat] = useState<'A6'|'A5'|'A4'|''>('A6');
  const [sides, setSides] = useState<1|2>(1);
  const [qty, setQty] = useState<number>(100);
  const [paperDensity, setPaperDensity] = useState<130|150>(130);
  const [lamination, setLamination] = useState<'none'|'matte'|'glossy'>('none');
  const [priceType, setPriceType] = useState<'rush'|'online'|'promo'>('rush');
  const [pricePerItem, setPricePerItem] = useState<number|undefined>();
  const [totalPrice, setTotalPrice] = useState<number|undefined>();
  const [totalSheets, setTotalSheets] = useState<number|undefined>();
  const [components, setComponents] = useState<Array<{ materialId:number; qtyPerItem:number }>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function calc(): Promise<any | undefined> {
    if (!format || !qty || !sides) { setErr('Укажите формат, тираж и стороны'); return }
    setLoading(true);
    try {
      const r = await calcFlyersPrice({ format, qty, sides, paperDensity, lamination, priceType } as any);
      setPricePerItem(r.data?.pricePerItem);
      setTotalPrice(r.data?.totalPrice);
      setTotalSheets(r.data?.totalSheets);
      setComponents(r.data?.components || []);
      setErr(null);
      return r.data;
    } catch (e) {
      setErr('Не удалось рассчитать цену');
      return undefined;
    } finally { setLoading(false) }
  }

  async function save() {
    if (!format || !qty) { setErr('Заполните параметры'); return }
    // Auto-calc if not calculated yet
    let pp = pricePerItem;
    let ts = totalSheets;
    let comps = components;
    if (pp == null) {
      const d = await calc();
      if (!d || d.pricePerItem == null) { return }
      pp = d.pricePerItem; ts = d.totalSheets; comps = d.components || [];
    }
    const paperName = paperDensity === 150 ? 'Бумага мелованная 150 г/м², SRA3' : 'Бумага мелованная 130 г/м², SRA3'
    const params = { description: `Листовки ${format}, ${sides}стор.`, paperDensity, paperName, lamination } as any;
    const payload: any = {
      type: 'Листовки',
      params,
      price: pp ?? 0,
      quantity: qty,
      sides,
      sheets: ts ?? 0,
      waste: 0
    }
    if (comps && comps.length > 0) payload.components = comps;
    await addOrderItem(order.id, payload);
    onSave();
  }

  // Автопересчёт при изменении параметров
  React.useEffect(() => {
    const t = setTimeout(() => { if (format && qty > 0) calc(); }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, qty, sides, paperDensity, lamination]);

  return (
    <div className="modal" style={{ maxWidth: 520 }}>
      <h3>Листовки — калькулятор</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label>Формат
          <select value={format} onChange={e => setFormat((e.target.value as any) || '')}>
            <option value="">—</option>
            <option value="A6">A6</option>
            <option value="A5">A5</option>
            <option value="A4">A4</option>
          </select>
        </label>
        <label>Стороны
          <select value={sides} onChange={e => setSides(Number(e.target.value) as 1|2)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label>Тираж
          <input type="number" value={qty || ''} onChange={e => setQty(Number(e.target.value) || 0)} />
        </label>
        <label>Плотность
          <select value={paperDensity} onChange={e => setPaperDensity(Number(e.target.value) as 130|150)}>
            <option value={130}>130</option>
            <option value={150}>150</option>
          </select>
        </label>
        <label>Ламинация
          <select value={lamination} onChange={e => setLamination(e.target.value as any)}>
            <option value="none">Нет</option>
            <option value="matte">Матовая</option>
            <option value="glossy">Глянцевая</option>
          </select>
        </label>
        <label>Тип цены
          <select value={priceType} onChange={e => setPriceType(e.target.value as any)}>
            <option value="rush">Срочно</option>
            <option value="online">Онлайн</option>
            <option value="promo">Акция</option>
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={calc} disabled={loading}>{loading ? '...' : 'Рассчитать'}</button>
        </div>
      </div>
      {(pricePerItem != null) && (
        <div style={{ marginTop: 8 }}>
          <div>Цена за штуку: <strong>{pricePerItem} BYN</strong></div>
          <div>Итого: <strong>{totalPrice} BYN</strong></div>
          <div>Листов SRA3: {totalSheets}</div>
        </div>
      )}
      {err && <div style={{ marginTop: 6, color: '#b91c1c' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onClose}>Отмена</button>
        <button onClick={save} disabled={!format || !qty || loading}>Сохранить</button>
      </div>
    </div>
  )
}


