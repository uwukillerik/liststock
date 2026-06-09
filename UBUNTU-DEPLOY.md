# ListStock — деплой на Ubuntu + домен

Пошаговая инструкция: как поднять проект на VPS с Ubuntu, подключить домен и включить HTTPS.

> **Итог:** сайт открывается по адресу `https://ваш-домен.ru`, фронтенд и API работают на одном порту через Nginx → Node.js → PostgreSQL.

---

## Содержание

1. [Что понадобится](#1-что-понадобится)
2. [DNS — привязка домена к серверу](#2-dns--привязка-домена-к-серверу)
3. [Первичная настройка Ubuntu](#3-первичная-настройка-ubuntu)
4. [Установка Node.js и PostgreSQL](#4-установка-nodejs-и-postgresql)
5. [Загрузка проекта на сервер](#5-загрузка-проекта-на-сервер)
6. [Файл .env (секреты)](#6-файл-env-секреты)
7. [База данных](#7-база-данных)
8. [Сборка и запуск через PM2](#8-сборка-и-запуск-через-pm2)
9. [Nginx — прокси на приложение](#9-nginx--прокси-на-приложение)
10. [SSL (Let's Encrypt)](#10-ssl-lets-encrypt)
11. [Проверка](#11-проверка)
12. [Обновление после изменений в коде](#12-обновление-после-изменений-в-коде)
13. [Альтернатива: Docker Compose](#13-альтернатива-docker-compose)
14. [Мобильное APK и домен](#14-мобильное-apk-и-домен)
15. [Частые проблемы](#15-частые-проблемы)

---

## 1. Что понадобится

| Что | Рекомендация |
|-----|----------------|
| VPS | Ubuntu **22.04** или **24.04**, от 1 GB RAM (лучше 2 GB+) |
| Доступ | SSH (логин + пароль или ключ) |
| Домен | Любой регистратор (Reg.ru, Timeweb, Cloudflare и т.д.) |
| IP сервера | Публичный IPv4 (запишите его) |

**Стек на сервере (основной способ):**

- Node.js 20+
- PostgreSQL 16
- PM2 (автозапуск приложения)
- Nginx (прокси + HTTPS)
- Certbot (бесплатный SSL)

---

## 2. DNS — привязка домена к серверу

В панели регистратора домена создайте записи:

| Тип | Имя (Host) | Значение | TTL |
|-----|------------|----------|-----|
| **A** | `@` | `123.45.67.89` | 300–3600 |
| **A** | `www` | `123.45.67.89` | 300–3600 |

`123.45.67.89` — **IP вашего VPS**.

Подождите 5–30 минут (иногда до нескольких часов), затем проверьте:

```bash
ping ваш-домен.ru
```

Должен отвечать IP сервера.

---

## 3. Первичная настройка Ubuntu

Подключитесь по SSH:

```bash
ssh root@123.45.67.89
# или
ssh ubuntu@123.45.67.89
```

Обновите систему и базовые пакеты:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential
```

Создайте отдельного пользователя (если работаете от root):

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

Настройте firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 4. Установка Node.js и PostgreSQL

### Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
npm -v
```

### PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Создайте пользователя и базу для приложения:

```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните (замените пароль):

```sql
CREATE USER sclad_user WITH PASSWORD 'НадёжныйПароль123!';
CREATE DATABASE sclad OWNER sclad_user;
GRANT ALL PRIVILEGES ON DATABASE sclad TO sclad_user;
\q
```

---

## 5. Загрузка проекта на сервер

### Вариант A — через Git (удобнее)

На сервере:

```bash
cd /opt
sudo mkdir -p liststock
sudo chown $USER:$USER liststock
git clone https://github.com/ВАШ_АККАУНТ/scladser.git liststock
cd liststock
```

### Вариант B — архив с компьютера

На Windows (PowerShell), в папке проекта:

```powershell
# Исключите node_modules и dist
tar -czf liststock.tar.gz --exclude=node_modules --exclude=dist .
scp liststock.tar.gz deploy@123.45.67.89:/opt/
```

На сервере:

```bash
sudo mkdir -p /opt/liststock
sudo chown $USER:$USER /opt/liststock
cd /opt/liststock
tar -xzf ~/liststock.tar.gz
```

### Установка зависимостей

```bash
cd /opt/liststock
npm install
```

> В проекте есть и `pnpm-lock.yaml`. Можно использовать `pnpm install`, если установлен pnpm:  
> `npm install -g pnpm && pnpm install`

---

## 6. Файл .env (секреты)

Создайте файл окружения:

```bash
cd /opt/liststock
cp .env.example .env
nano .env
```

Пример для **production** (подставьте свои значения):

```env
DATABASE_URL=postgresql://sclad_user:НадёжныйПароль123!@127.0.0.1:5432/sclad
JWT_SECRET=сгенерируйте-длинную-случайную-строку-минимум-32-символа
PORT=3000
SEED_DEMO_PRODUCTS=0
```

Сгенерировать `JWT_SECRET`:

```bash
openssl rand -base64 48
```

**Важно:**

- Файл `.env` **не коммитьте** в Git и не публикуйте.
- Пароль в `DATABASE_URL` должен совпадать с паролем пользователя PostgreSQL.
- `PORT=3000` — приложение слушает только localhost/внутреннюю сеть; снаружи к нему ходит Nginx.

---

## 7. База данных

Первичная инициализация (таблицы, схема, демо-данные по желанию):

```bash
cd /opt/liststock
npm run db:setup
```

Создать/обновить учётные записи **admin1** и **sclad1**:

```bash
npm run db:seed-users
```

| Логин | Пароль | Роль |
|-------|--------|------|
| admin1 | admin | Администратор |
| sclad1 | sclad1 | Кладовщик |

После первого деплоя **смените пароли** через интерфейс («Сменить пароль») или создайте новых пользователей в разделе «Сотрудники».

При обновлениях схемы БД (новые функции в проекте):

```bash
npm run db:sync
```

---

## 8. Сборка и запуск через PM2

### Сборка

```bash
cd /opt/liststock
npm run build
```

Собираются:

- фронтенд → `dist/spa/`
- сервер → `dist/server/node-build.mjs`

### Проверка вручную (опционально)

```bash
npm start
# Откройте http://IP_СЕРВЕРА:3000 — должна открыться страница входа
# Ctrl+C для остановки
```

### PM2 — автозапуск

```bash
sudo npm install -g pm2
cd /opt/liststock
pm2 start dist/server/node-build.mjs --name liststock
pm2 save
pm2 startup
# Выполните команду, которую выведет pm2 startup (с sudo)
```

Полезные команды:

```bash
pm2 status
pm2 logs liststock
pm2 restart liststock
```

---

## 9. Nginx — прокси на приложение

Установка:

```bash
sudo apt install -y nginx
```

Создайте конфиг сайта:

```bash
sudo nano /etc/nginx/sites-available/liststock
```

Вставьте (замените `ваш-домен.ru`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
```

Включите сайт и перезапустите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/liststock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Проверьте в браузере: `http://ваш-домен.ru` — должна открыться страница входа **без указания порта**.

---

## 10. SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru
```

Certbot сам:

- получит сертификат;
- настроит HTTPS в Nginx;
- добавит редирект HTTP → HTTPS.

Проверка автообновления:

```bash
sudo certbot renew --dry-run
```

После этого сайт доступен по **`https://ваш-домен.ru`**.

---

## 11. Проверка

| Проверка | Ожидание |
|----------|----------|
| `https://ваш-домен.ru` | Страница входа |
| `https://ваш-домен.ru/api/ping` | JSON `{"message":"..."}` |
| `https://ваш-домен.ru/health` | `{"status":"ok",...}` |
| Вход admin1 / admin | Главная, каталог, отчёты |
| Вход sclad1 / sclad1 | Кладовщик, нужна открытая смена |

На сервере:

```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
curl -s http://127.0.0.1:3000/health
```

---

## 12. Обновление после изменений в коде

```bash
cd /opt/liststock
git pull                    # если используете Git
npm install                 # при новых зависимостях
npm run db:sync             # при изменениях схемы БД
npm run build
pm2 restart liststock
```

---

## 13. Альтернатива: Docker Compose

Если предпочитаете Docker, в проекте уже есть `Dockerfile` и `docker-compose.yml`.

```bash
cd /opt/liststock

cat > .env << 'EOF'
POSTGRES_PASSWORD=НадёжныйПароль123!
JWT_SECRET=ваш-jwt-secret-минимум-32-символа
SEED_ADMIN_PASSWORD=ScladAdmin!
SEED_WORKER_PASSWORD=ScladWorker!
APP_PORT=3000
EOF

docker compose up -d --build
```

После первого запуска выполните миграции **внутри контейнера** или с хоста с тем же `DATABASE_URL`.

Nginx с SSL на хосте — проксируйте на `127.0.0.1:3000` так же, как в разделе 9.

Для Nginx **внутри Docker** (профиль `with-nginx`):

```bash
# Настройте nginx.conf и ssl/, затем:
docker compose --profile with-nginx up -d
```

---

## 14. Мобильное APK и домен

После деплоя укажите URL сервера в `capacitor.config.ts`:

```ts
server: {
  url: "https://ваш-домен.ru",
  androidScheme: "https",
},
```

Сборка APK на компьютере с Android Studio:

```bash
npm run build:mobile
npm run cap:android
```

APK будет обращаться к вашему домену — сервер должен быть доступен по HTTPS.

---

## 15. Частые проблемы

### «502 Bad Gateway» в Nginx

Приложение не запущено или слушает другой порт.

```bash
pm2 status
pm2 logs liststock
curl http://127.0.0.1:3000/health
```

Убедитесь, что в `.env` указан `PORT=3000` и он совпадает с `proxy_pass` в Nginx.

### «Connection refused» к PostgreSQL

```bash
sudo systemctl status postgresql
```

Проверьте `DATABASE_URL`: пользователь, пароль, имя базы `sclad`.

### Certbot не выдаёт сертификат

- DNS A-запись домена указывает на IP сервера.
- Порт 80 открыт: `sudo ufw status`.
- Домен уже резолвится: `dig ваш-домен.ru +short`.

### Белый экран / 404 на `/inventory`

Не выполнена сборка или PM2 запущен со старым `dist`:

```bash
npm run build
pm2 restart liststock
```

### После обновления нет новых таблиц (партии, 3D-план и т.д.)

```bash
npm run db:sync
pm2 restart liststock
```

---

## Краткий чеклист

- [ ] VPS Ubuntu, SSH доступ
- [ ] DNS: A `@` и `www` → IP сервера
- [ ] Node.js 20, PostgreSQL, Nginx, PM2
- [ ] Проект в `/opt/liststock`
- [ ] `.env` с `DATABASE_URL`, `JWT_SECRET`, `PORT=3000`
- [ ] `npm run db:setup` + `npm run db:seed-users`
- [ ] `npm run build` + `pm2 start`
- [ ] Nginx → `127.0.0.1:3000`
- [ ] `certbot --nginx` для HTTPS
- [ ] Вход в приложение, смена паролей

---

## Схема работы

```
Браузер / APK
     │
     ▼
  Nginx :443 (HTTPS)
     │
     ▼
  Node.js :3000  ──►  PostgreSQL :5432
  (dist/server)         (база sclad)
     │
     └──► dist/spa/  (React SPA)
```

---

*ListStock — production-деплой на Ubuntu. При вопросах смотрите также `DEPLOY.md` (APK, Electron, переменные окружения).*
