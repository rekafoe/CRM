import React, { useEffect, useState } from "react";
import "./index.css";

type Order = {
  id: number;
  number: string;
  status: number;
  createdAt: string;
};

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then(r => r.json())
      .then((data: Order[]) => {
        setOrders(data);
        if (!selectedId && data.length) setSelectedId(data[0].id);
      });
  }, []);

  const addOrder = async () => {
    const res = await fetch("/api/orders", { method: "POST" });
    const order: Order = await res.json();
    setOrders([order, ...orders]);
    setSelectedId(order.id);
  };

  const selectedOrder = orders.find(o => o.id === selectedId);

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Заказы</h2>
        <ul className="order-list">
          {orders.map(o => (
            <li
              key={o.id}
              className={`order-item ${o.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(o.id)}
            >
              {o.number}
            </li>
          ))}
        </ul>
        <button className="add-order-btn" onClick={addOrder}>
          + Добавить заказ
        </button>
      </aside>

      <section className="detail">
        {selectedOrder ? (
          <>
            <div className="detail-header">
              <h2>{selectedOrder.number}</h2>
              <div className="detail-actions">
                <button onClick={() => alert("Настройка пресетов")}>
                  Пресеты
                </button>
                <button onClick={() => alert("Добавить позицию")}>
                  + Позиция
                </button>
              </div>
            </div>

            <div className="detail-body">
              {/* Здесь рендерим список items, материалы, сумму и т.д. */}
              <div className="item">
                {/* пример позиции */}
                <strong>Espresso</strong> — 2.5$ — qty: 1
              </div>
              <div className="item">
                <strong>Croissant</strong> — 3.5$ — qty: 2
              </div>
            </div>
          </>
        ) : (
          <p>Выберите заказ слева</p>
        )}
      </section>
    </div>
);
}
