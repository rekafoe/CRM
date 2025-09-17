import React, { useState } from 'react';

interface AdminMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({ isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'reports',
      title: '📊 Архив отчётов',
      description: 'Просмотр и управление всеми отчётами',
      icon: '📊'
    },
    {
      id: 'materials',
      title: '📦 Материалы',
      description: 'Склад, остатки и движения материалов',
      icon: '📦'
    },
    {
      id: 'users',
      title: '👥 Управление пользователями',
      description: 'Добавление и редактирование пользователей',
      icon: '👥'
    },
    {
      id: 'orders',
      title: '📦 Все заказы',
      description: 'Просмотр и управление всеми заказами',
      icon: '📦'
    },
    {
      id: 'settings',
      title: '⚙️ Настройки системы',
      description: 'Конфигурация и параметры',
      icon: '⚙️'
    }
  ];

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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        maxWidth: '90%',
        maxHeight: '80%',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          borderBottom: '2px solid #f0f0f0',
          paddingBottom: '16px'
        }}>
          <h2 style={{ margin: 0, color: '#333', fontSize: '24px' }}>
            🛡️ Админ-панель
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '4px',
              borderRadius: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          {menuItems.map(item => (
            <div
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              style={{
                padding: '20px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: '#fafafa'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1976d2';
                e.currentTarget.style.backgroundColor = '#f5f5f5';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.backgroundColor = '#fafafa';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '24px', marginRight: '12px' }}>
                  {item.icon}
                </span>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  color: '#333'
                }}>
                  {item.title}
                </h3>
              </div>
              <p style={{
                margin: 0,
                color: '#666',
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '2px solid #f0f0f0',
          textAlign: 'center'
        }}>
          <p style={{
            margin: 0,
            color: '#888',
            fontSize: '12px'
          }}>
            Административные функции доступны только пользователям с ролью "admin"
          </p>
        </div>
      </div>
    </div>
  );
};
