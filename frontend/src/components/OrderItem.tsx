import React, { useState } from 'react';
import { Item } from '../types';
import { updateOrderItem, deleteOrderItem } from '../api';

interface OrderItemProps {
  item: Item;
  orderId: number;
  onUpdate: () => void;
}

export const OrderItem: React.FC<OrderItemProps> = ({ item, orderId, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(item.quantity ?? 1);
  const [price, setPrice] = useState(item.price);
  const [sides, setSides] = useState(item.sides ?? 1);
  const [sheets, setSheets] = useState(item.sheets ?? 0);
  const [waste, setWaste] = useState(item.waste ?? 0);

  const handleSave = async () => {
    try {
      await updateOrderItem(orderId, item.id, {
        quantity: qty,
        price,
        sides,
        sheets,
        waste
      });
      setEditing(false);
      onUpdate();
    } catch (error) {
      alert('Ошибка при обновлении позиции');
    }
  };

  const handleDelete = async () => {
    if (confirm('Удалить позицию?')) {
      try {
        await deleteOrderItem(orderId, item.id);
        onUpdate();
      } catch (error) {
        alert('Ошибка при удалении позиции');
      }
    }
  };

  return (
    <div className="item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <strong>{item.type}</strong> — {item.params.description}
        {item.params.paperName && (
          <span style={{ marginLeft: 6, fontSize: 12, color: '#555' }}>({item.params.paperName}{item.params.lamination && item.params.lamination!=='none' ? `, ламинация: ${item.params.lamination==='matte'?'мат':'гл'}` : ''})</span>
        )}
        {" "}
        {editing ? (
          <>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} style={{ width: 100 }} /> BYN ×
            <input type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 60, marginLeft: 6 }} />
            <select value={sides} onChange={e => setSides(Number(e.target.value))} style={{ marginLeft: 6 }}>
              <option value={1}>1 стор.</option>
              <option value={2}>2 стор.</option>
            </select>
            <input type="number" value={sheets} min={0} onChange={e => setSheets(Math.max(0, Number(e.target.value) || 0))} style={{ width: 80, marginLeft: 6 }} placeholder="листы" />
            <input type="number" value={waste} min={0} onChange={e => setWaste(Math.max(0, Number(e.target.value) || 0))} style={{ width: 80, marginLeft: 6 }} placeholder="брак" />
          </>
        ) : (
          <>
            {price.toLocaleString()} BYN × {qty}
            {typeof sides !== 'undefined' ? ` — ${sides} стор.` : ''}
            {typeof sheets !== 'undefined' ? ` — листы: ${sheets}` : ''}
            {typeof waste !== 'undefined' ? ` — брак: ${waste}` : ''}
          </>
        )}
      </div>
      {editing ? (
        <>
          <button
            onClick={handleSave}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#4caf50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Сохранить
          </button>
          <button 
            className="btn-danger" 
            onClick={() => setEditing(false)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
        </>
      ) : (
        <>
          <button 
            onClick={() => setEditing(true)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#2196f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Редактировать
          </button>
          <button
            className="btn-danger"
            onClick={handleDelete}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Удалить
          </button>
        </>
      )}
    </div>
  );
};
