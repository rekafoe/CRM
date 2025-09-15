import React from 'react';
import { Order } from '../types';
import { formatBYN } from '../utils/currency';
import StatusBar from './StatusBar';

interface Props {
  order: Order;
  onAddItem: () => void;
  onDelete: (id: number) => void;
  onStatus: (id: number, status: number) => void;
}

export default function OrderDetails({ order, onAddItem, onDelete, onStatus }: Props) {
  return (
    <section className="order-details">
      <h2>{order.number}</h2>
      <StatusBar current={order.status} onChange={(s: number) => onStatus(order.id, s)} />
      <p>Created: {new Date(order.createdAt).toLocaleString()}</p>
      <button onClick={onAddItem}>➕ Add Item</button>
      <button onClick={() => onDelete(order.id)}>🗑 Delete Order</button>

      <ul>
        {order.items.map(item => (
          <li key={item.id}>
            {item.type} — {item.params.description} — {formatBYN(item.price)}
          </li>
        ))}
      </ul>
    </section>
  );
}
