# 📚 Настройка GitHub репозитория

## Создание репозитория на GitHub

### 1. Создайте новый репозиторий
1. Перейдите на https://github.com
2. Нажмите "New repository"
3. Заполните данные:
   - **Repository name**: `crm-system` (или любое другое имя)
   - **Description**: `CRM system for print shop with order management, price calculator, and materials tracking`
   - **Visibility**: Public или Private (на ваш выбор)
   - **Initialize**: НЕ отмечайте "Add a README file" (у нас уже есть)

### 2. Скопируйте URL репозитория
После создания репозитория скопируйте URL (например: `https://github.com/username/crm-system.git`)

## Локальная настройка Git

### 1. Инициализация репозитория
```bash
# В корневой папке проекта
git init
```

### 2. Добавление файлов
```bash
# Добавить все файлы
git add .

# Проверить статус
git status
```

### 3. Первый коммит
```bash
git commit -m "Initial commit: CRM system with order management, price calculator, and materials tracking"
```

### 4. Подключение к GitHub
```bash
# Добавить remote origin (замените URL на ваш)
git remote add origin https://github.com/username/crm-system.git

# Проверить подключение
git remote -v
```

### 5. Отправка на GitHub
```bash
# Отправить код на GitHub
git push -u origin main

# Если используется master вместо main
git push -u origin master
```

## Автоматическая настройка

### Использование скрипта setup-git.bat
```bash
# Запустите скрипт настройки
setup-git.bat

# Следуйте инструкциям на экране
```

## Структура репозитория

После загрузки на GitHub структура будет выглядеть так:

```
crm-system/
├── .gitignore
├── README.md
├── DEPLOYMENT.md
├── GITHUB_SETUP.md
├── package.json
├── docker-compose.yml
├── setup-git.bat
├── backend/
│   ├── src/
│   ├── uploads/
│   ├── package.json
│   └── ...
└── frontend/
    ├── src/
    ├── dist/
    ├── package.json
    └── ...
```

## Настройка GitHub Actions (опционально)

### 1. Создайте файл .github/workflows/ci.yml
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm run install:all
    
    - name: Run tests
      run: npm test
    
    - name: Build application
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Добавьте команды развертывания
```

## Настройка веток

### 1. Создание веток для разработки
```bash
# Создать ветку для новой функции
git checkout -b feature/new-feature

# Создать ветку для исправлений
git checkout -b bugfix/fix-issue

# Создать ветку для релиза
git checkout -b release/v1.1.0
```

### 2. Работа с ветками
```bash
# Переключиться на ветку
git checkout main

# Слить ветку в main
git merge feature/new-feature

# Удалить ветку
git branch -d feature/new-feature
```

## Настройка защиты веток

### 1. Защита main ветки
1. Перейдите в Settings → Branches
2. Нажмите "Add rule"
3. Введите `main` в "Branch name pattern"
4. Отметьте:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

### 2. Настройка статусных проверок
1. В разделе "Require status checks to pass before merging"
2. Выберите "Require branches to be up to date before merging"
3. Добавьте проверки (если настроены GitHub Actions)

## Настройка Issues и Projects

### 1. Включение Issues
1. Перейдите в Settings → General
2. В разделе "Features" отметьте "Issues"

### 2. Создание шаблонов
Создайте файлы:
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`

### 3. Настройка Projects
1. Перейдите в "Projects"
2. Создайте новый проект
3. Настройте колонки: "To Do", "In Progress", "Done"

## Настройка Wiki (опционально)

### 1. Включение Wiki
1. Перейдите в Settings → General
2. В разделе "Features" отметьте "Wiki"

### 2. Создание документации
- API документация
- Руководство пользователя
- Архитектура системы

## Настройка уведомлений

### 1. Настройка email уведомлений
1. Перейдите в Settings → Notifications
2. Настройте уведомления о:
   - Pull requests
   - Issues
   - Commits
   - Releases

### 2. Настройка командных уведомлений
- Slack интеграция
- Discord webhooks
- Email рассылки

## Безопасность

### 1. Настройка секретов
1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте необходимые секреты:
   - `DEPLOY_TOKEN`
   - `DATABASE_URL`
   - `API_KEYS`

### 2. Настройка доступа
1. Перейдите в Settings → Manage access
2. Добавьте участников команды
3. Настройте права доступа

## Мониторинг

### 1. Настройка Insights
- Просмотр статистики коммитов
- Анализ активности
- Отслеживание проблем

### 2. Настройка Dependabot
1. Перейдите в Settings → Security
2. Включите "Dependabot alerts"
3. Настройте автоматические обновления

## Готово! 🎉

После выполнения всех шагов у вас будет:
- ✅ Полнофункциональный GitHub репозиторий
- ✅ Настроенный CI/CD pipeline
- ✅ Защищенные ветки
- ✅ Система управления задачами
- ✅ Документация проекта
