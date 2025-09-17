# 🚀 Развертывание CRM системы

## Локальная разработка

### Быстрый старт
```bash
# Установка всех зависимостей
npm run install:all

# Запуск в режиме разработки
npm run dev
```

### Ручной запуск
```bash
# Backend (терминал 1)
cd backend
npm install
npm run dev

# Frontend (терминал 2)
cd frontend
npm install
npm run dev
```

## Docker развертывание

### Сборка и запуск
```bash
# Сборка всех контейнеров
docker-compose build

# Запуск в фоновом режиме
docker-compose up -d

# Просмотр логов
docker-compose logs -f
```

### Остановка
```bash
# Остановка контейнеров
docker-compose down

# Остановка с удалением volumes
docker-compose down -v
```

## Продакшн развертывание

### 1. Подготовка сервера
```bash
# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2 для управления процессами
npm install -g pm2
```

### 2. Клонирование и настройка
```bash
# Клонирование репозитория
git clone <repository-url>
cd CRM

# Установка зависимостей
npm run install:all

# Сборка приложения
npm run build
```

### 3. Настройка переменных окружения
```bash
# Backend
cd backend
cp .env.example .env
# Отредактируйте .env файл

# Frontend
cd frontend
# Настройте API_URL в vite.config.ts
```

### 4. Запуск с PM2
```bash
# Запуск backend
cd backend
pm2 start dist/src/index.js --name "crm-backend"

# Запуск frontend (если нужно)
cd frontend
pm2 start "npm run preview" --name "crm-frontend"
```

### 5. Настройка Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # File uploads
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Мониторинг

### PM2 команды
```bash
# Статус процессов
pm2 status

# Логи
pm2 logs crm-backend

# Перезапуск
pm2 restart crm-backend

# Остановка
pm2 stop crm-backend
```

### Логи приложения
```bash
# Backend логи
tail -f backend/logs/app.log

# PM2 логи
pm2 logs --lines 100
```

## Резервное копирование

### База данных
```bash
# Создание бэкапа
cp backend/data.db backup/data-$(date +%Y%m%d).db

# Восстановление
cp backup/data-20240101.db backend/data.db
```

### Файлы загрузок
```bash
# Создание архива
tar -czf uploads-$(date +%Y%m%d).tar.gz backend/uploads/

# Восстановление
tar -xzf uploads-20240101.tar.gz
```

## Обновление

### 1. Остановка сервисов
```bash
pm2 stop crm-backend
```

### 2. Обновление кода
```bash
git pull origin main
npm run install:all
npm run build
```

### 3. Запуск сервисов
```bash
pm2 start crm-backend
```

## Безопасность

### 1. Настройка файрвола
```bash
# Разрешить только необходимые порты
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 2. SSL сертификаты
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com
```

### 3. Регулярные обновления
```bash
# Обновление системы
sudo apt update && sudo apt upgrade

# Обновление Node.js
npm install -g n
sudo n stable
```

## Мониторинг производительности

### 1. Мониторинг ресурсов
```bash
# Использование CPU и памяти
htop

# Использование диска
df -h

# Сетевые соединения
netstat -tulpn
```

### 2. Логи приложения
```bash
# PM2 мониторинг
pm2 monit

# Системные логи
journalctl -u nginx -f
```

## Устранение неполадок

### 1. Проблемы с портами
```bash
# Проверка занятых портов
lsof -i :3001
lsof -i :3000

# Освобождение порта
kill -9 <PID>
```

### 2. Проблемы с базой данных
```bash
# Проверка файла базы данных
ls -la backend/data.db

# Проверка прав доступа
chmod 644 backend/data.db
```

### 3. Проблемы с загрузкой файлов
```bash
# Проверка директории uploads
ls -la backend/uploads/

# Создание директории
mkdir -p backend/uploads
chmod 755 backend/uploads
```

## Масштабирование

### 1. Горизонтальное масштабирование
- Использование load balancer
- Разделение frontend и backend
- Использование CDN для статических файлов

### 2. Вертикальное масштабирование
- Увеличение RAM и CPU
- Оптимизация запросов к базе данных
- Кэширование часто используемых данных
