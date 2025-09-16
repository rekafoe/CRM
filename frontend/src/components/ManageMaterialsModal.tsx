import React, { useEffect, useState } from 'react';
import { Material } from '../types';
import { getMaterials, saveMaterial, deleteMaterial } from '../api';

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
      <table>
        <thead>
          <tr><th>Name</th><th>Unit</th><th>Qty</th><th>Min</th><th/></tr>
        </thead>
        <tbody>
          {materials.map(m => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.unit}</td>
              <td style={{ color: (m.min_quantity != null && m.quantity <= (m.min_quantity||0)) ? '#c00' : undefined }}>{m.quantity}</td>
              <td>{m.min_quantity ?? ''}</td>
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
              <button onClick={onSave} disabled={!edit.name}>Save</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
