# SkillUp v24 — Railway deployment

Это **фронтенд-прототип** v24 без изменений интерфейса. Данные пока сохраняются в localStorage конкретного браузера. Настоящий backend, БД, Telegram server-side auth, AI API и реальная оплата пока не реализованы.

## Через GitHub + Railway

1. Распакуйте ZIP. Создайте **новый репозиторий GitHub** и загрузите файлы из папки проекта **в корень репозитория**: `index.html`, `Dockerfile`, `nginx.conf`, `railway.toml`.
2. Откройте https://railway.app/ → **New Project** → **Deploy from GitHub repo**.
3. Подключите GitHub при необходимости, выберите репозиторий и начните deploy. Railway обнаружит Dockerfile.
4. Когда деплой станет успешным, откройте сервис → **Settings** → **Networking** → **Public Networking** → **Generate Domain**.
5. Проверьте HTTPS-адрес. Должна открыться Главная SkillUp. Health check: `/health` → `ok`.
6. Для Telegram Mini App укажите полученный HTTPS-адрес в настройках бота через @BotFather (Menu Button / Mini App URL, в зависимости от вашей конфигурации).

## Важно

- Railway деплоит только исходный код, и сам по себе не превращает localStorage в базу данных.
- Для v24 *не требуются* секреты или переменные окружения.
- Не публикуйте ключи Telegram-бота или AI в index.html.
- Сайту нужен HTTPS для работы внутри Telegram; публичный домен Railway предоставляет HTTPS.
- Для синхронизации данных между устройствами следующий этап — API + PostgreSQL + проверка подписи Telegram initData на сервере.
- При переподключении к новому домену localStorage на старом домене автоматически не переносится.
