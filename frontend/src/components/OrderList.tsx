import React from 'react';
import { Order } from '../types';

interface Props {
  orders: Order[];
  selected: number | null;
  onSelect: (o: Order) => void;
  onCreate: () => void;
}

export default function OrderList({ orders, selected, onSelect, onCreate }: Props) {
  return (
    <aside className="order-list">
      <button onClick={onCreate}>➕ New Order</button>
      <ul>
        {orders.map(o => (
          <li
            key={o.id}
            className={o.id === selected ? 'selected' : ''}
            onClick={() => onSelect(o)}
          >
            {o.number} — {o.items.length} items
          </li>
        ))}
      </ul>
    </aside>
  );
}
