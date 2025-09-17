import React, { useEffect, useState } from 'react';
import { getDailyReports, getUsers, getCurrentUser, deleteDailyReport, updateDailyReport } from '../api';
import { DailyReport } from '../types';
import { ReportDetailPage } from './ReportDetailPage';

interface AdminReportsPageProps {
  onBack?: () => void;
}

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onBack }) => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedUser, fromDate, toDate]);

  const loadData = async () => {
    try {
      const [usersRes, currentUserRes] = await Promise.all([
        getUsers(),
        getCurrentUser()
      ]);
      setUsers(usersRes.data);
      setCurrentUser(currentUserRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedUser) params.user_id = selectedUser;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await getDailyReports(params);
      setReports(res.data);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот отчёт?')) return;

    try {
      await deleteDailyReport(reportId);
      await loadReports();
      alert('Отчёт успешно удалён');
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Ошибка при удалении отчёта');
    }
  };

  const handleEditReport = (report: DailyReport) => {
    setEditingReport(report);
  };

  const handleViewReport = (report: DailyReport) => {
    setSelectedReport(report);
  };

  const handleViewUserReport = (report: DailyReport) => {
    // Открываем отчёт конкретного пользователя
    setSelectedReport(report);
  };

  const handleSaveEdit = async (updatedReport: DailyReport) => {
    try {
      await updateDailyReport(updatedReport.report_date, {
        orders_count: updatedReport.orders_count,
        total_revenue: updatedReport.total_revenue
      });
      setEditingReport(null);
      await loadReports();
      alert('Отчёт успешно обновлён');
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Ошибка при обновлении отчёта');
    }
  };

  const getTotalStats = () => {
    const totalOrders = reports.reduce((sum, r) => sum + r.orders_count, 0);
    const totalRevenue = reports.reduce((sum, r) => sum + r.total_revenue, 0);
    const uniqueUsers = new Set(reports.map(r => r.user_id)).size;
    return { totalOrders, totalRevenue, uniqueUsers };
  };

  const stats = getTotalStats();

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '2px solid #e0e0e0',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Назад к заказам
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, color: '#333' }}>
              🛡️ Админ-панель: Архив отчётов
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
              Просматривайте и управляйте отчётами всех пользователей. Нажмите "👁️ Открыть отчёт" для детального просмотра.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Пользователь: {currentUser?.name} ({currentUser?.role})
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Показать инструкцию по использованию"
          >
            ❓ Помощь
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '16px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.totalOrders}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Всего заказов</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
            {stats.totalRevenue.toLocaleString('ru-RU')} BYN
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Общая выручка</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
            {stats.uniqueUsers}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Пользователей</div>
        </div>
        <div style={{
          padding: '16px',
          backgroundColor: '#fce4ec',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c2185b' }}>
            {reports.length}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Отчётов</div>
        </div>
      </div>

      {/* Быстрый доступ к отчётам пользователей */}
      <div style={{
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#e8f5e8',
        borderRadius: '8px',
        border: '1px solid #c8e6c9'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2e7d32', fontSize: '16px' }}>
          🚀 Быстрый доступ к отчётам пользователей
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user.id)}
              style={{
                padding: '8px 16px',
                backgroundColor: selectedUser === user.id ? '#4caf50' : '#81c784',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              👤 {user.name}
            </button>
          ))}
          <button
            onClick={() => setSelectedUser('')}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedUser === '' ? '#2196f3' : '#64b5f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            👥 Все пользователи
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        flexWrap: 'wrap'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            Пользователь:
          </label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : '')}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              minWidth: '150px'
            }}
          >
            <option value="">Все пользователи</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            От даты:
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            До даты:
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button
            onClick={loadReports}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Список отчётов */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            Отчёты ({reports.length})
          </div>
          <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
            💡 Нажмите "👁️ Открыть отчёт" для просмотра заказов и позиций
          </div>
        </div>
        
        {reports.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            Нет отчётов для отображения
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {reports.map(report => (
              <div
                key={report.id}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      📅 {report.report_date}
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: '#1976d2',
                      fontWeight: 'bold',
                      border: '1px solid #bbdefb'
                    }}>
                      👤 {report.user_name || 'Неизвестный пользователь'}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: '#f3e5f5',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: '#7b1fa2',
                      fontWeight: 'bold'
                    }}>
                      ID: {report.user_id || 'N/A'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#666' }}>
                    <span>Заказов: <strong>{report.orders_count}</strong></span>
                    <span>Выручка: <strong>{report.total_revenue.toLocaleString('ru-RU')} BYN</strong></span>
                    <span>Создан: {new Date(report.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleViewUserReport(report)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title={`Открыть полный отчёт пользователя ${report.user_name || 'Неизвестный'} за ${report.report_date}`}
                  >
                    👁️ Открыть отчёт
                  </button>
                  <button
                    onClick={() => handleEditReport(report)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Редактировать данные отчёта"
                  >
                    ✏️ Редактировать
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Удалить отчёт"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {editingReport && (
        <EditReportModal
          report={editingReport}
          onSave={handleSaveEdit}
          onClose={() => setEditingReport(null)}
        />
      )}

      {/* Детальный просмотр отчёта */}
      {selectedReport && (
        <ReportDetailPage
          reportDate={selectedReport.report_date}
          userId={selectedReport.user_id}
          onBack={() => setSelectedReport(null)}
        />
      )}

      {/* Модальное окно помощи */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1002
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            width: '600px',
            maxWidth: '90%',
            maxHeight: '80%',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '15px'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>
                📚 Руководство по админ-панели
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ lineHeight: '1.6' }}>
              <h3 style={{ color: '#1976d2', marginTop: '20px', marginBottom: '10px' }}>
                🎯 Как зайти в отчёт другого пользователя:
              </h3>
              <ol style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Быстрый доступ:</strong> Нажмите на кнопку с именем пользователя в зелёной секции "🚀 Быстрый доступ"
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Фильтр:</strong> Выберите пользователя в выпадающем списке "Пользователь"
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Просмотр:</strong> Нажмите кнопку "👁️ Открыть отчёт" рядом с нужным отчётом
                </li>
              </ol>

              <h3 style={{ color: '#1976d2', marginTop: '20px', marginBottom: '10px' }}>
                🔍 Что можно делать в отчёте:
              </h3>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li style={{ marginBottom: '6px' }}>📊 <strong>Просматривать статистику</strong> - заказы, выручка по статусам</li>
                <li style={{ marginBottom: '6px' }}>👁️ <strong>Видеть все заказы</strong> с полной информацией о клиентах</li>
                <li style={{ marginBottom: '6px' }}>✏️ <strong>Редактировать заказы</strong> - менять статусы, позиции, данные клиентов</li>
                <li style={{ marginBottom: '6px' }}>📋 <strong>Дублировать заказы</strong> - создавать копии для быстрого повторения</li>
                <li style={{ marginBottom: '6px' }}>🗑️ <strong>Удалять заказы</strong> - с подтверждением</li>
              </ul>

              <h3 style={{ color: '#1976d2', marginTop: '20px', marginBottom: '10px' }}>
                ⚡ Полезные функции:
              </h3>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                <li style={{ marginBottom: '6px' }}>📅 <strong>Фильтр по датам</strong> - выберите период для просмотра</li>
                <li style={{ marginBottom: '6px' }}>👥 <strong>Просмотр всех пользователей</strong> - кнопка "👥 Все пользователи"</li>
                <li style={{ marginBottom: '6px' }}>📈 <strong>Общая статистика</strong> - в верхней части страницы</li>
                <li style={{ marginBottom: '6px' }}>🔄 <strong>Обновление данных</strong> - кнопка "Обновить" в фильтрах</li>
              </ul>

              <div style={{
                backgroundColor: '#e3f2fd',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #bbdefb',
                marginTop: '20px'
              }}>
                <strong style={{ color: '#1976d2' }}>💡 Совет:</strong> 
                <span style={{ marginLeft: '8px' }}>
                  Используйте быстрые кнопки пользователей для мгновенного перехода к их отчётам. 
                  В детальном просмотре отчёта вы можете редактировать заказы так же, как в основной системе.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент для редактирования отчёта
interface EditReportModalProps {
  report: DailyReport;
  onSave: (report: DailyReport) => void;
  onClose: () => void;
}

const EditReportModal: React.FC<EditReportModalProps> = ({ report, onSave, onClose }) => {
  const [ordersCount, setOrdersCount] = useState(report.orders_count);
  const [totalRevenue, setTotalRevenue] = useState(report.total_revenue);

  const handleSave = () => {
    onSave({
      ...report,
      orders_count: ordersCount,
      total_revenue: totalRevenue
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1001
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90%'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          Редактировать отчёт за {report.report_date}
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Количество заказов:
          </label>
          <input
            type="number"
            value={ordersCount}
            onChange={(e) => setOrdersCount(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Общая выручка (BYN):
          </label>
          <input
            type="number"
            step="0.01"
            value={totalRevenue}
            onChange={(e) => setTotalRevenue(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
