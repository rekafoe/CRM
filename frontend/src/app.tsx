import React, { useEffect, useState } from "react";
import "./index.css";
import { Order } from "./types";
import { getOrders, createOrder, addOrderItem, updateOrderStatus, deleteOrder, deleteOrderItem } from "./api";
import AddItemModal from "./components/AddItemModal";
import ManageMaterialsModal from "./components/ManageMaterialsModal";
import ManagePresetsModal from "./components/ManagePresetsModal";

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  function loadOrders() {
    getOrders().then(res => {
      setOrders(res.data);
      if (!selectedId && res.data.length) setSelectedId(res.data[0].id);
    });
  }

  async function handleCreateOrder() {
    const res = await createOrder();
    const order = res.data;
    setOrders([order, ...orders]);
    setSelectedId(order.id);
  }

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
        <button className="add-order-btn" onClick={handleCreateOrder}>
          + Добавить заказ
        </button>
        <button className="add-order-btn" style={{ marginTop: 8 }} onClick={() => setShowMaterials(true)}>
          📦 Материалы
        </button>
      </aside>

      <section className="detail">
        {selectedOrder ? (
          <>
            <div className="detail-header">
              <h2>{selectedOrder.number}</h2>
              <div className="detail-actions">
                <button onClick={() => setShowPresets(true)}>Пресеты</button>
                <button onClick={() => setShowAddItem(true)}>+ Позиция</button>
              </div>
            </div>

            <div className="detail-body">
              {selectedOrder.items.length === 0 && <div className="item">Пока нет позиций</div>}
              {selectedOrder.items.map(it => (
                <div className="item" key={it.id}>
                  <strong>{it.type}</strong> — {it.params.description} — {it.price}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>Выберите заказ слева</p>
        )}
      </section>

      {showAddItem && selectedOrder && (
        <AddItemModal
          order={selectedOrder}
          onSave={() => { setShowAddItem(false); loadOrders(); }}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {showMaterials && (
        <ManageMaterialsModal onClose={() => setShowMaterials(false)} />
      )}

      {showPresets && (
        <ManagePresetsModal onClose={() => setShowPresets(false)} onSave={() => setShowPresets(false)} />
      )}
    </div>
  );
}
