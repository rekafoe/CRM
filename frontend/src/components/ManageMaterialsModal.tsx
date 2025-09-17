import React, { useEffect, useState } from 'react';
import { Material } from '../types';
import { getMaterials, saveMaterial, deleteMaterial, getMaterialMoves, getMaterialTop, getMaterialForecast } from '../api';

interface FormState {
  id?: number;
  name: string;
  unit: string;
  quantity: number;
  min_quantity?: number;
}

interface Props {
  onClose: () => void;
}

export default function ManageMaterialsModal({ onClose }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [edit, setEdit] = useState<FormState>({ name: '', unit: '', quantity: 0 });
  const [showMoves, setShowMoves] = useState(false);
  const [moves, setMoves] = useState<any[]>([]);
  const [filter, setFilter] = useState<{ materialId?: number | ''; orderId?: number | ''; user_id?: number | ''; from?: string; to?: string }>({});
  const [reportTop, setReportTop] = useState<any[]>([]);
  const [reportForecast, setReportForecast] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  function load() {
    getMaterials().then(res => setMaterials(res.data));
  }

  function onSave() {
    saveMaterial(edit).then(() => {
      setEdit({ name: '', unit: '', quantity: 0 });
      load();
    });
  }

  return (
    <div className="modal">
      <h3>Materials Stock</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={async () => {
          const params: any = {}
          if (filter.materialId) params.materialId = filter.materialId
          if (filter.orderId) params.orderId = filter.orderId
          if (filter.user_id) params.user_id = filter.user_id
          if (filter.from) params.from = filter.from
          if (filter.to) params.to = filter.to
          const res = await getMaterialMoves(params)
          setMoves(res.data)
          setShowMoves(true)
        }}>История движений</button>
        <select value={filter.materialId || ''} onChange={e => setFilter(s => ({ ...s, materialId: e.target.value ? Number(e.target.value) : '' }))}>
          <option value="">Все материалы</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input placeholder="OrderId" value={filter.orderId || ''} onChange={e => setFilter(s => ({ ...s, orderId: e.target.value ? Number(e.target.value) : '' }))} />
        <input placeholder="UserId" value={filter.user_id || ''} onChange={e => setFilter(s => ({ ...s, user_id: e.target.value ? Number(e.target.value) : '' }))} />
        <input type="date" value={filter.from || ''} onChange={e => setFilter(s => ({ ...s, from: e.target.value }))} />
        <input type="date" value={filter.to || ''} onChange={e => setFilter(s => ({ ...s, to: e.target.value }))} />
      </div>
      <table>
        <thead>
          <tr><th>Name</th><th>Unit</th><th>Qty</th><th>Min</th><th>Цена листа (1-стор)</th><th/></tr>
        </thead>
        <tbody>
          {materials.map(m => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.unit}</td>
              <td style={{ color: (m.quantity != null && m.quantity <= (m.quantity||0)) ? '#c00' : undefined }}>{m.quantity}</td>
              <td>{m.min_quantity ?? ''}</td>
              <td>{m.sheet_price_single ?? ''}</td>
              <td>
                <button onClick={() => deleteMaterial(m.id).then(load)}>✖</button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                value={edit.name}
                onChange={e => setEdit(s => ({ ...s, name: e.target.value }))}
                placeholder="Name"
              />
            </td>
            <td>
              <input
                value={edit.unit}
                onChange={e => setEdit(s => ({ ...s, unit: e.target.value }))}
                placeholder="Unit"
              />
            </td>
            <td>
              <input
                type="number"
                value={edit.quantity}
                onChange={e => setEdit(s => ({ ...s, quantity: Number(e.target.value) }))}
              />
            </td>
            <td>
              <input
                type="number"
                value={edit.min_quantity ?? 0}
                onChange={e => setEdit(s => ({ ...s, min_quantity: Number(e.target.value) }))}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.001"
                value={(edit as any).sheet_price_single ?? ''}
                onChange={e => setEdit(s => ({ ...s, sheet_price_single: e.target.value === '' ? undefined : Number(e.target.value) }) as any)}
                placeholder="BYN/лист (1-стор)"
              />
            </td>
            <td>
              <button onClick={onSave} disabled={!edit.name}>Save</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={onClose}>Close</button>
      {showMoves && (
        <div className="modal" style={{ marginTop: 12 }}>
          <h4>История движений</h4>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Материал</th>
                  <th>Δ</th>
                  <th>Причина</th>
                  <th>Заказ</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {moves.map(mv => (
                  <tr key={mv.id}>
                    <td>{mv.created_at}</td>
                    <td>{mv.material_name}</td>
                    <td>{mv.delta}</td>
                    <td>{mv.reason || ''}</td>
                    <td>{mv.orderId || ''}</td>
                    <td>{mv.user_id || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={async () => {
              const res = await getMaterialTop({ from: filter.from, to: filter.to, limit: 10 });
              setReportTop(res.data as any[]);
            }}>ТОП расход</button>
            <button onClick={async () => {
              const res = await getMaterialForecast();
              setReportForecast(res.data as any[]);
            }}>Прогноз закупок</button>
            <button onClick={() => { setReportTop([]); setReportForecast([]); setShowMoves(false); }}>Закрыть</button>
          </div>
          {(reportTop.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <h5>ТОП расход</h5>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {reportTop.map((r: any) => (
                  <li key={r.id}>{r.name}: {r.spent}</li>
                ))}
              </ul>
            </div>
          )}
          {(reportForecast.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <h5>Прогноз закупок</h5>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {reportForecast.map((r: any) => (
                  <li key={r.id}>{r.name} — остаток {r.quantity}{r.unit}, мин {r.min_quantity ?? ''}, рекомендовано заказать {r.suggested_order}{r.unit}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
