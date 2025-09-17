import React, { useEffect, useState } from "react";
import "./index.css";
import "./app.css";
import { Order } from "./types";
import {
  getOrders,
  createOrder,
  deleteOrder,
  deleteOrderItem,
  updateOrderStatus,
  updateOrderItem,
} from "./api";
import { Link } from 'react-router-dom';
import AddItemModal from "./components/AddItemModal";
import ManageMaterialsModal from "./components/ManageMaterialsModal";
import ManagePresetsModal from "./components/ManagePresetsModal";
import { PrepaymentModal } from "./components/PrepaymentModal";
import { AdminMenu } from "./components/AdminMenu";
import { AdminReportsPage } from "./pages/AdminReportsPage";

import { ProgressBar, OrderStatus } from "./components/order/ProgressBar";
import { OrderTotal } from "./components/order/OrderTotal";
import { OrderItem } from "./components/OrderItem";
import { setAuthToken, getOrderStatuses, listOrderFiles, uploadOrderFile, deleteOrderFile, approveOrderFile, createPrepaymentLink, getLowStock, getCurrentUser, getUsers, getDailyReportByDate, createDailyReport } from './api';
import { APP_CONFIG } from './types';
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
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState<string>('orders');
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [contextDate, setContextDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [contextUserId, setContextUserId] = useState<number | null>(null);
  const [showTopPicker, setShowTopPicker] = useState(false);

  function handleLogout() {
    try {
      setAuthToken(undefined);
      localStorage.removeItem('crmRole');
      localStorage.removeItem('crmSessionDate');
      localStorage.removeItem('crmUserId');
    } catch {}
    location.href = '/login';
  }

  useEffect(() => {
    getOrderStatuses().then(r => setStatuses(r.data));
    getCurrentUser().then(r => setCurrentUser(r.data)).catch(() => setCurrentUser(null));
    getUsers().then(r => setAllUsers(r.data)).catch(() => setAllUsers([]));
    if (typeof window !== 'undefined' && localStorage.getItem(APP_CONFIG.storage.role) === 'admin') {
      getLowStock().then(r => setLowStock(r.data as any[]));
    }
  }, []);

  // Set default context user when currentUser loads
  useEffect(() => {
    if (currentUser && !contextUserId) setContextUserId(currentUser.id);
  }, [currentUser]);

  // Reload orders when context changes and user is known
  useEffect(() => {
    if (currentUser) loadOrders();
  }, [currentUser, contextUserId, contextDate]);

  useEffect(() => {
    if (selectedId) {
      listOrderFiles(selectedId).then(r => {
        setFiles(r.data);
      }).catch((error) => {
        console.error('Error loading files for order', selectedId, ':', error);
        setFiles([]);
      });
    } else {
      setFiles([]);
    }
  }, [selectedId]);

  function loadOrders() {
    getOrders().then((res) => {
      const date = contextDate.slice(0,10);
      const uid = contextUserId ?? currentUser?.id ?? null;
      const filtered = res.data
        .filter(o => String(o.createdAt || '').slice(0,10) === date)
        .filter(o => uid == null ? true : ((o as any).userId == null || (o as any).userId === uid));
      setOrders(filtered);
      if (!selectedId && filtered.length) setSelectedId(filtered[0].id);
    }).catch((error) => {
      console.error('Error loading orders:', error);
      alert('Ошибка загрузки заказов: ' + error.message);
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
      {currentPage === 'orders' && (
        <>
          <div className="app-topbar">
            <div className="topbar-info">
              <button className="chip chip--clickable" onClick={() => setShowTopPicker(s => !s)} title="Выбрать пользователя и дату отчёта" aria-label="Выбрать пользователя и дату отчёта">
                📅 {contextDate} · 👤 {currentUser?.name || ''}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {currentUser?.role === 'admin' && (
                <Link to="/reports" title="Ежедневные отчёты" aria-label="Ежедневные отчёты" className="app-icon-btn">📊</Link>
              )}
              <button onClick={handleLogout} title="Выйти" aria-label="Выйти" className="app-icon-btn">⎋</button>
            </div>
          </div>
          {showTopPicker && (
            <div className="topbar-picker" onMouseLeave={() => setShowTopPicker(false)}>
              <div className="row">
                <span style={{ width: 90 }}>Дата:</span>
                <input type="date" value={contextDate} onChange={async e => {
                  setContextDate(e.target.value);
                  setShowTopPicker(false);
                  try {
                    const uid = contextUserId ?? currentUser?.id ?? undefined;
                    await getDailyReportByDate(e.target.value, uid).catch(() => Promise.resolve());
                  } finally { loadOrders(); }
                }} />
              </div>
              <div className="row">
                <span style={{ width: 90 }}>Пользователь:</span>
                <select value={String(contextUserId ?? currentUser?.id ?? '')} onChange={async e => {
                  const uid = e.target.value ? Number(e.target.value) : null;
                  setContextUserId(uid);
                  setShowTopPicker(false);
                  try {
                    await getDailyReportByDate(contextDate, uid ?? undefined).catch(() => Promise.resolve());
                  } finally { loadOrders(); }
                }}>
                  {currentUser?.role === 'admin' ? (
                    allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                  ) : (
                    <option value={currentUser?.id}>{currentUser?.name}</option>
                  )}
                </select>
              </div>
              <div className="note">Отчёт создаётся только в день входа. Переключение даты показывает сохранённые данные.</div>
            </div>
          )}
          <aside className="sidebar">
        {/* Ссылка на отчёты вынесена в верхнюю панель */}
        {currentUser?.role === 'admin' && (
          <button onClick={() => setShowAdminMenu(true)} className="add-order-btn" style={{ marginBottom: 12 }}>🛡️ Админ-панель</button>
        )}

        <div className="sidebar-toolbar">
          <button className="icon-btn" title="Добавить заказ" aria-label="Добавить заказ" onClick={handleCreateOrder}>＋</button>
          <button
            className="icon-btn"
            title="Удалить выбранный заказ"
            aria-label="Удалить выбранный заказ"
            disabled={!selectedOrder}
            onClick={async () => {
              if (!selectedOrder) return;
              try {
                await deleteOrder(selectedOrder.id);
                setSelectedId(null);
                loadOrders();
              } catch (e: any) {
                alert('Не удалось удалить заказ. Возможно нужна авторизация.');
              }
            }}
          >🗑️</button>
        </div>
        
        <h2>Заказы</h2>
        {lowStock.length > 0 && (
          <div style={{ background: '#fff4e5', border: '1px solid #ffcc80', color: '#7a4f01', padding: 8, borderRadius: 6 }}>
            Низкие остатки: {lowStock.slice(0,3).map((m: any) => m.name).join(', ')}{lowStock.length>3?'…':''}
          </div>
        )}
        
        <ul className="order-list">
          {orders.map((o) => {
            const st = statuses.find(s => s.sort_order === o.status);
            const maxSort = Math.max(1, ...statuses.map(s => s.sort_order));
            const pct = Math.max(0, Math.min(100, Math.round(((o.status - 1) / Math.max(1, (maxSort - 1))) * 100)));
            return (
              <li
                key={o.id}
                className={`order-item order-list__item ${o.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(o.id)}
              >
                <div className="order-item__header">
                  <span>{o.number}</span>
                  <span className="order-item__id">ID: {o.id}</span>
                </div>
                <div className="order-item__status" style={{ ['--status-color' as any]: st?.color || '#1976d2' }}>
                  <span className="status-pill">{st?.name || `Статус ${o.status}`}</span>
                  <div className="status-bar">
                    <div className="status-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {/* Кнопки добавления/удаления перенесены в панель */}
        
        {currentUser?.role === 'admin' && (
          <button
            className="add-order-btn"
            style={{ marginTop: 8 }}
            onClick={() => setShowMaterials(true)}
          >
            📦 Материалы
          </button>
        )}
      </aside>

      <section className="detail">
        {selectedOrder ? (
          <>
            <div className="detail-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ marginBottom: 8 }}>{selectedOrder.number}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#666' }}>Дата</label>
                    <input type="date" value={contextDate} onChange={async e => {
                      setContextDate(e.target.value);
                      try {
                        const uid = contextUserId ?? currentUser?.id ?? undefined;
                        await getDailyReportByDate(e.target.value, uid).catch(async () => {
                          if (uid) await createDailyReport({ report_date: e.target.value, user_id: uid });
                        });
                      } finally { loadOrders(); }
                    }} style={{ marginLeft: 8 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#666' }}>Пользователь</label>
                    <select value={String(contextUserId ?? currentUser?.id ?? '')} onChange={async e => {
                      const uid = e.target.value ? Number(e.target.value) : null;
                      setContextUserId(uid);
                      try {
                        await getDailyReportByDate(contextDate, uid ?? undefined).catch(async () => {
                          if (uid) await createDailyReport({ report_date: contextDate, user_id: uid });
                        });
                      } catch {}
                    }} style={{ marginLeft: 8 }}>
                      {currentUser?.role === 'admin' ? (
                        allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                      ) : (
                        <option value={currentUser?.id}>{currentUser?.name}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
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
                {typeof window !== 'undefined' && localStorage.getItem('crmRole') === 'admin' && (
                  <button onClick={() => setShowPresets(true)}>Пресеты</button>
                )}
                <button onClick={() => setShowAddItem(true)}>+ Позиция</button>
                {/* Кнопка выхода перенесена в сайдбар */}
              </div>
            </div>

            {/* ====== ВСТАВЛЯЕМ ПРОГРЕСС-БАР ====== */}
            <ProgressBar
              current={selectedOrder.status}
              statuses={statuses}
              onStatusChange={async (newStatus) => {
                try {
                  await updateOrderStatus(selectedOrder.id, newStatus);
                  loadOrders();
                } catch (e: any) {
                  alert('Не удалось изменить статус');
                }
              }}
              height="12px"
            />

            <div className="detail-body">
              {selectedOrder.items.length === 0 && (
                <div className="item">Пока нет позиций</div>
              )}

              {selectedOrder.items.map((it) => (
                <OrderItem key={it.id} item={it} orderId={selectedOrder.id} onUpdate={loadOrders} />
              ))}
            </div>

            {/* ====== ФАЙЛЫ ЗАКАЗА ====== */}
            <div className="order-total" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>Файлы макетов</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {files.length > 0 && (
                    <button 
                      onClick={() => {
                        // Скачиваем все файлы одним архивом
                        files.forEach(f => {
                          const link = document.createElement('a');
                          link.href = `/api/uploads/${encodeURIComponent(f.filename)}`;
                          link.download = f.originalName || f.filename;
                          link.click();
                        });
                      }}
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        backgroundColor: '#1976d2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      📥 Скачать все
                    </button>
                  )}
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
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.length === 0 && <span>Файлы не загружены</span>}
                {files.map(f => (
                  <div key={f.id} style={{ 
                    display: 'flex', 
                    gap: 8, 
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <a 
                        href={`/api/uploads/${encodeURIComponent(f.filename)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ textDecoration: 'none', color: '#1976d2' }}
                      >
                        {f.originalName || f.filename}
                      </a>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        {(f.size ? Math.round(f.size/1024) : 0)} KB
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/uploads/${encodeURIComponent(f.filename)}`;
                          link.download = f.originalName || f.filename;
                          link.click();
                        }}
                        style={{ 
                          fontSize: '12px', 
                          padding: '2px 6px',
                          backgroundColor: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        📥
                      </button>
                      {f.approved ? (
                        <span style={{ color: '#2e7d32', fontSize: '12px' }}>✔ утверждено</span>
                      ) : (
                        <button 
                          onClick={async () => {
                            try {
                              await approveOrderFile(selectedOrder.id, f.id);
                              const r = await listOrderFiles(selectedOrder.id);
                              setFiles(r.data);
                            } catch { alert('Не удалось утвердить файл'); }
                          }}
                          style={{ 
                            fontSize: '12px', 
                            padding: '2px 6px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          ✓
                        </button>
                      )}
                      <button 
                        className="btn-danger" 
                        onClick={async () => {
                          try {
                            await deleteOrderFile(selectedOrder.id, f.id);
                            const r = await listOrderFiles(selectedOrder.id);
                            setFiles(r.data);
                          } catch { alert('Не удалось удалить файл'); }
                        }}
                        style={{ 
                          fontSize: '12px', 
                          padding: '2px 6px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ====== ПРЕДОПЛАТА ====== */}
            <div className="order-total" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>💳 Предоплата</strong>
                <button 
                  onClick={() => setShowPrepaymentModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  💳 Выставить предоплату
                </button>
              </div>
              
              {selectedOrder.prepaymentAmount && selectedOrder.prepaymentAmount > 0 && (
                <div style={{ 
                  marginTop: 12, 
                  padding: 12, 
                  backgroundColor: '#f0f8ff', 
                  borderRadius: 6,
                  border: '1px solid #e3f2fd'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 'bold', color: '#1976d2' }}>
                      Сумма: {selectedOrder.prepaymentAmount} BYN
                    </span>
                    <span style={{ 
                      fontSize: '12px', 
                      padding: '2px 8px',
                      backgroundColor: selectedOrder.prepaymentStatus === 'paid' ? '#4caf50' : '#ff9800',
                      color: 'white',
                      borderRadius: '12px'
                    }}>
                      {selectedOrder.prepaymentStatus === 'paid' ? 'Оплачено' : 'Ожидает оплаты'}
                    </span>
                  </div>
                  
                  {selectedOrder.paymentUrl && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <a 
                        href={selectedOrder.paymentUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#4caf50',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        🔗 Перейти к оплате
                      </a>
                      <button 
                        onClick={() => navigator.clipboard.writeText(selectedOrder.paymentUrl || '')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        📋 Копировать ссылку
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              taxRate={0}
            />
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Выберите заказ слева</p>
            {selectedId && (
              <div style={{ marginTop: '10px', color: '#666', fontSize: '14px' }}>
                <p>Заказ с ID {selectedId} не найден в списке</p>
                <p>Всего заказов: {orders.length}</p>
                <button 
                  onClick={() => setSelectedId(null)}
                  style={{ 
                    marginTop: '10px', 
                    padding: '8px 16px', 
                    backgroundColor: '#f5f5f5', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Сбросить выбор
                </button>
              </div>
            )}
          </div>
        )}
      </section>
        </>
      )}

      {showAddItem && selectedOrder && (
        <AddItemModal
          order={selectedOrder}
          allowedCategories={[ 'Листовки' ]}
          initialCategory={'Листовки'}
          onSave={() => {
            setShowAddItem(false);
            loadOrders();
          }}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {currentUser?.role === 'admin' && showMaterials && (
        <ManageMaterialsModal onClose={() => setShowMaterials(false)} />
      )}

      {showPresets && (
        <ManagePresetsModal
          onClose={() => setShowPresets(false)}
          onSave={() => setShowPresets(false)}
        />
      )}

      {showPrepaymentModal && selectedOrder && (
        <PrepaymentModal
          isOpen={showPrepaymentModal}
          onClose={() => setShowPrepaymentModal(false)}
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.number}
          currentAmount={selectedOrder.prepaymentAmount}
          onPrepaymentCreated={async (amount, email) => {
            try {
              const res = await createPrepaymentLink(selectedOrder.id, amount);
              await loadOrders();
              setPrepayAmount(String(amount));
              alert(`Предоплата на сумму ${amount} BYN создана. Ссылка отправлена на ${email}`);
            } catch (error) {
              console.error('Error creating prepayment:', error);
              const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
              alert(`Не удалось создать предоплату: ${errorMessage}`);
            }
          }}
        />
      )}

      {/* Админ-меню */}
      {showAdminMenu && (
        <AdminMenu
          isOpen={showAdminMenu}
          onClose={() => setShowAdminMenu(false)}
          onNavigate={(page) => {
            setCurrentPage(page);
            setShowAdminMenu(false);
          }}
        />
      )}

      {/* Админ-страницы */}
      {currentPage === 'reports' && currentUser?.role === 'admin' && (
        <AdminReportsPage onBack={() => setCurrentPage('orders')} />
      )}
    </div>
  );
}
