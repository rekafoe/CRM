import React, { useEffect, useState } from "react";
import "./index.css";
import { Order } from "./types";
import {
  getOrders,
  createOrder,
  deleteOrder,
  deleteOrderItem,
  updateOrderStatus,
} from "./api";
import { Link } from 'react-router-dom';
import AddItemModal from "./components/AddItemModal";
import ManageMaterialsModal from "./components/ManageMaterialsModal";
import ManagePresetsModal from "./components/ManagePresetsModal";

import { ProgressBar, OrderStatus } from "./components/order/ProgressBar";
import { OrderTotal } from "./components/order/OrderTotal";
import { setAuthToken, getOrderStatuses, listOrderFiles, uploadOrderFile, deleteOrderFile, approveOrderFile, createPrepaymentLink } from './api';
import type { OrderFile } from './types';


export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [statuses, setStatuses] = useState<Array<{ id: number; name: string; color?: string; sort_order: number }>>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [prepayAmount, setPrepayAmount] = useState<string>('');

  useEffect(() => {
    loadOrders();
    getOrderStatuses().then(r => setStatuses(r.data));
  }, []);
  useEffect(() => {
    if (selectedId) {
      listOrderFiles(selectedId).then(r => setFiles(r.data));
    } else {
      setFiles([]);
    }
  }, [selectedId]);

  function loadOrders() {
    getOrders().then((res) => {
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

  const selectedOrder = orders.find((o) => o.id === selectedId);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/reports">Ежедневные отчёты</Link>
        <h2>Заказы</h2>
        
        <ul className="order-list">
          {orders.map((o) => (
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
        {selectedOrder && (
          <button
            className="btn-danger"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                await deleteOrder(selectedOrder.id);
                setSelectedId(null);
                loadOrders();
              } catch (e: any) {
                alert('Не удалось удалить заказ. Возможно нужна авторизация.');
              }
            }}
          >
            Удалить заказ
          </button>
        )}
        <button
          className="add-order-btn"
          style={{ marginTop: 8 }}
          onClick={() => setShowMaterials(true)}
        >
          📦 Материалы
        </button>
      </aside>

      <section className="detail">
        {selectedOrder ? (
          <>
            <div className="detail-header">
              <h2>{selectedOrder.number}</h2>
              <div className="detail-actions">
                {/* Управление статусом заказа */}
                <select
                  value={String(selectedOrder.status)}
                  onChange={async (e) => {
                    const newStatus = Number(e.target.value);
                    try {
                      await updateOrderStatus(selectedOrder.id, newStatus);
                      loadOrders();
                    } catch (err) {
                      alert('Не удалось обновить статус. Возможно нужна авторизация.');
                    }
                  }}
                  style={{ marginRight: 8 }}
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.sort_order}>{s.name}</option>
                  ))}
                </select>
                <button onClick={() => setShowPresets(true)}>Пресеты</button>
                <button onClick={() => setShowAddItem(true)}>+ Позиция</button>
                <button onClick={() => { setAuthToken(undefined); location.href = '/login'; }}>Выйти</button>
              </div>
            </div>

            {/* ====== ВСТАВЛЯЕМ ПРОГРЕСС-БАР ====== */}
            <ProgressBar
              current={String(selectedOrder.status)}
              totalSteps={Math.max(1, statuses.length || 5)}
              height="12px"
              fillColor="#1976d2"
              bgColor="#e0e0e0"
            />

            <div className="detail-body">
              {selectedOrder.items.length === 0 && (
                <div className="item">Пока нет позиций</div>
              )}

              {selectedOrder.items.map((it) => (
                <div className="item" key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{it.type}</strong> — {it.params.description} —{" "}
                    {it.price.toLocaleString()} BYN × {it.quantity ?? 1}
                  </div>
                  <button
                    className="btn-danger"
                    onClick={async () => {
                      try {
                        await deleteOrderItem(selectedOrder.id, it.id);
                        loadOrders();
                      } catch (e: any) {
                        alert('Не удалось удалить позицию. Возможно нужна авторизация.');
                      }
                    }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>

            {/* ====== ФАЙЛЫ ЗАКАЗА ====== */}
            <div className="order-total" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Файлы макетов</strong>
                <input type="file" onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return;
                  try {
                    await uploadOrderFile(selectedOrder.id, f);
                    const r = await listOrderFiles(selectedOrder.id);
                    setFiles(r.data);
                    e.currentTarget.value = '';
                  } catch { alert('Не удалось загрузить файл'); }
                }} />
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.length === 0 && <span>Файлы не загружены</span>}
                {files.map(f => (
                  <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a href={`/api/uploads/${encodeURIComponent(f.filename)}`} target="_blank" rel="noreferrer">
                      {f.originalName || f.filename}
                    </a>
                    <span style={{ fontSize: 12, color: '#666' }}>{(f.size ? Math.round(f.size/1024) : 0)} KB</span>
                    {f.approved ? <span style={{ color: '#2e7d32' }}>✔ утверждено</span> : (
                      <button onClick={async () => {
                        try {
                          await approveOrderFile(selectedOrder.id, f.id);
                          const r = await listOrderFiles(selectedOrder.id);
                          setFiles(r.data);
                        } catch { alert('Не удалось утвердить файл'); }
                      }}>Утвердить</button>
                    )}
                    <button className="btn-danger" onClick={async () => {
                      try {
                        await deleteOrderFile(selectedOrder.id, f.id);
                        const r = await listOrderFiles(selectedOrder.id);
                        setFiles(r.data);
                      } catch { alert('Не удалось удалить файл'); }
                    }}>Удалить</button>
                  </div>
                ))}
              </div>
            </div>

            {/* ====== ПРЕДОПЛАТА ====== */}
            <div className="order-total" style={{ marginTop: 8 }}>
              <strong>Предоплата</strong>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input
                  type="number"
                  placeholder="Сумма BYN"
                  value={prepayAmount}
                  onChange={e => setPrepayAmount(e.target.value)}
                  style={{ maxWidth: 160 }}
                />
                <button onClick={async () => {
                  try {
                    const amt = prepayAmount ? Number(prepayAmount) : undefined;
                    const res = await createPrepaymentLink(selectedOrder.id, amt);
                    await loadOrders();
                    setPrepayAmount(String(res.data.prepaymentAmount ?? ''));
                  } catch { alert('Не удалось создать ссылку'); }
                }}>Сформировать ссылку</button>
                {selectedOrder.paymentUrl && (
                  <>
                    <a href={selectedOrder.paymentUrl} target="_blank" rel="noreferrer">Перейти к оплате</a>
                    <button onClick={() => navigator.clipboard.writeText(selectedOrder.paymentUrl || '')}>Копировать</button>
                  </>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#555' }}>
                Статус: {selectedOrder.prepaymentStatus || '—'}{selectedOrder.paymentId ? ` (ID: ${selectedOrder.paymentId})` : ''}
              </div>
            </div>

            {/* ====== ВСТАВЛЯЕМ ИТОГОВУЮ СУММУ ====== */}
            <OrderTotal
              items={selectedOrder.items.map((it) => ({
                id: it.id,
                type: it.type,
                price: it.price,
                quantity: it.quantity ?? 1,
              }))}
              discount={0}
              taxRate={0.2}
            />
          </>
        ) : (
          <p>Выберите заказ слева</p>
        )}
      </section>

      {showAddItem && selectedOrder && (
        <AddItemModal
          order={selectedOrder}
          onSave={() => {
            setShowAddItem(false);
            loadOrders();
          }}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {showMaterials && (
        <ManageMaterialsModal onClose={() => setShowMaterials(false)} />
      )}

      {showPresets && (
        <ManagePresetsModal
          onClose={() => setShowPresets(false)}
          onSave={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}
