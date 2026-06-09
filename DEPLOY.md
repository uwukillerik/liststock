# ListStock — Руководство по деплою

## Содержание
1. [Локальная разработка](#1-локальная-разработка)
2. [Деплой на домен (VPS/сервер)](#2-деплой-на-домен-vpsсервер)
3. [Android APK (Capacitor)](#3-android-apk-capacitor)
4. [Windows EXE (Electron)](#4-windows-exe-electron)
5. [Переменные окружения](#5-переменные-окружения)

---

## 1. Локальная разработка

### Требования
- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)
- PostgreSQL 15+ (локально или в Docker)

### Настройка
```bash
# 1. Клонировать/перейти в папку проекта
cd scladser

# 2. Установить зависимости
pnpm install

# 3. Создать .env из примера
cp .env.example .env
# Открыть .env и указать DATABASE_URL

# 4. Создать базу и применить миграции + seed
pnpm db:setup

# 5. Запустить в режиме разработки
pnpm dev
```

Приложение откроется на http://localhost:5173  
API сервер: http://localhost:3000

### Учётные записи по умолчанию
| Логин | Пароль | Роль |
|-------|--------|------|
| admin | ScladAdmin! | Администратор |
| klad  | ScladWorker! | Кладовщик |

---

## 2. Деплой на домен (VPS/сервер)

### Вариант A — Docker Compose (рекомендуется)

```bash
# 1. Установить Docker + Docker Compose на сервер
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 2. Скопировать проект на сервер
git clone <ваш-репозиторий> /opt/liststock
cd /opt/liststock

# 3. Создать .env для продакшена
cat > .env << 'EOF'
POSTGRES_PASSWORD=НадёжныйПароль123!
JWT_SECRET=случайная-длинная-строка-минимум-32-символа
SEED_ADMIN_PASSWORD=ВашПарольАдмина!
SEED_WORKER_PASSWORD=ВашПарольКладовщика!
APP_PORT=3000
EOF

# 4. Собрать и запустить
docker compose up -d --build

# 5. Запустить миграции (первый раз)
docker compose exec app sh -c "cd /app && node -e \"
  import('./dist/server/node-build.mjs').then(() => {})
\""
```

### Настройка домена с nginx + Let's Encrypt

```bash
# 1. Установить certbot
apt install certbot python3-certbot-nginx -y

# 2. Получить SSL сертификат
certbot certonly --standalone -d ваш-домен.ru

# 3. Скопировать сертификаты
mkdir -p /opt/liststock/ssl
cp /etc/letsencrypt/live/ваш-домен.ru/fullchain.pem /opt/liststock/ssl/
cp /etc/letsencrypt/live/ваш-домен.ru/privkey.pem /opt/liststock/ssl/

# 4. В nginx.conf раскомментировать HTTPS блок и заменить ваш-домен.ru

# 5. Запустить с nginx
docker compose --profile with-nginx up -d
```

### Вариант B — Прямой запуск на сервере (без Docker)

```bash
# 1. Установить зависимости
pnpm install

# 2. Собрать проект
pnpm build

# 3. Запустить миграции
pnpm db:setup

# 4. Запустить сервер (с pm2 для автозапуска)
npm install -g pm2
pm2 start dist/server/node-build.mjs --name liststock
pm2 startup
pm2 save
```

---

## 3. Android APK (Capacitor)

### Требования
- Android Studio (скачать с developer.android.com)
- Java 17+
- Node.js 20+

### Шаги

```bash
# 1. Установить Capacitor CLI
pnpm add -D @capacitor/cli @capacitor/core @capacitor/android

# 2. Инициализировать Capacitor (уже настроен в capacitor.config.ts)
npx cap init

# 3. В capacitor.config.ts указать URL вашего сервера:
#    server: { url: "https://ваш-домен.ru" }

# 4. Собрать веб-часть
pnpm build:client

# 5. Добавить платформу Android
npx cap add android

# 6. Синхронизировать
npx cap sync android

# 7. Открыть в Android Studio
npx cap open android
```

### В Android Studio:
1. **Build → Generate Signed Bundle / APK**
2. Выбрать **APK**
3. Создать keystore: `android/keystore/liststock.keystore`
4. Заполнить поля (пароли записать!)
5. Build Variant: **release**
6. APK будет в `android/app/build/outputs/apk/release/`

### ⚠️ Важно для APK
Приложение работает как веб-оболочка — нужен работающий сервер.  
Укажите `server.url` в `capacitor.config.ts` на адрес вашего API сервера.

---

## 4. Windows EXE (Electron)

### Требования
- Node.js 20+
- pnpm 10+
- Windows 10/11 (для сборки под Windows)

### Шаги

```bash
# 1. Установить Electron и electron-builder
pnpm add -D electron electron-builder

# 2. Добавить в package.json (scripts):
#   "electron:dev": "electron electron/main.cjs",
#   "electron:build": "pnpm build && electron-builder"

# 3. Добавить в package.json (build конфиг):
```

Добавьте в `package.json`:

```json
"build": {
  "appId": "ru.liststock.app",
  "productName": "ListStock",
  "directories": { "output": "dist-electron" },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    { "from": "dist/server", "to": "server" }
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "public/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerLanguages": ["ru_RU"],
    "language": "1049"
  },
  "mac": {
    "target": "dmg",
    "icon": "public/icon.icns"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

```bash
# 4. Собрать EXE
pnpm electron:build

# Результат: dist-electron/ListStock Setup X.X.X.exe
```

### ⚠️ Для Electron нужна база данных
Electron запускает сервер локально на порту 3000.  
PostgreSQL должен быть установлен на компьютере пользователя.

**Вариант с SQLite** (проще для десктопа):
Можно заменить PostgreSQL на SQLite (better-sqlite3), изменив `server/db.ts`.

---

## 5. Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgresql://user:pass@localhost:5432/sclad` |
| `JWT_SECRET` | Секрет для подписи JWT токенов | `my-super-secret-32chars-min` |
| `PORT` | Порт HTTP сервера | `3000` |
| `SEED_ADMIN_PASSWORD` | Пароль администратора при первом запуске | `ScladAdmin!` |
| `SEED_WORKER_PASSWORD` | Пароль кладовщика при первом запуске | `ScladWorker!` |
| `SEED_DEMO_PRODUCTS` | `0` — не создавать демо-товары | `1` |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL (для Docker) | `changeme` |

### Файл `.env` (скопируйте в `.env.example` → `.env`)

```env
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/sclad
JWT_SECRET=замените-на-случайную-строку-минимум-32-символа
PORT=3000
SEED_ADMIN_PASSWORD=ScladAdmin!
SEED_WORKER_PASSWORD=ScladWorker!
SEED_DEMO_PRODUCTS=1
```

---

## Структура проекта

```
scladser/
├── client/           # React фронтенд
│   ├── pages/        # Страницы приложения
│   ├── components/   # Переиспользуемые компоненты
│   ├── context/      # React Context (Auth, Inventory)
│   └── lib/          # Утилиты, API клиент
├── server/           # Express бэкенд
│   ├── routes/       # API маршруты
│   ├── migrations/   # SQL миграции
│   └── middleware/   # JWT, авторизация
├── shared/           # Общие типы (фронт + бэк)
├── scripts/          # db-setup.ts
├── electron/         # Electron main + preload
├── capacitor.config.ts # Конфиг для Android APK
├── Dockerfile        # Docker образ
├── docker-compose.yml# Docker Compose
└── nginx.conf        # Nginx конфиг
```

## API маршруты

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | `/api/auth/login` | Все | Вход |
| GET | `/api/auth/me` | Auth | Текущий пользователь |
| POST | `/api/auth/change-password` | Auth | Смена пароля |
| GET | `/api/products` | Auth | Список товаров |
| POST | `/api/products` | Admin | Создать товар |
| PATCH | `/api/products/:id` | Admin | Изменить товар |
| POST | `/api/products/:id/adjust` | Admin | Скорректировать остаток |
| DELETE | `/api/products/:id` | Admin | Удалить товар |
| GET | `/api/movements` | Auth | История движений |
| GET | `/api/analytics` | Admin | Аналитика |
| GET | `/api/users` | Admin | Список пользователей |
| POST | `/api/users` | Admin | Создать пользователя |
| PATCH | `/api/users/:id` | Admin | Изменить пользователя |
| DELETE | `/api/users/:id` | Admin | Удалить пользователя |
