# Продължаване локално

Repo: https://github.com/ivohtanev/Aram-Duel-Moba

1. Клонирай repo и създай branch chore/local-prototype-foundation.
2. Копирай файловете от архива в клонираната папка. Архивът не съдържа .git.
3. Прегледай README.md, docs/RULES.md и docs/TASKS.md.
4. npm ci, npm run build, npm run dev.
5. Провери сцената в браузър. Движение и бой още не са реализирани.
6. Commit/push през локалната GitHub автентикация; създай PR към main.

Локалната cloud история не е качена. Последният API опит за създаване на branch
на каноничния адрес връща HTTP 403 Resource not accessible by integration.
В repo са наблюдавани main и codex; провери текущото им съдържание преди промени.
Не презаписвай чужди или по-нови промени. Основата е TypeScript + Babylon.js + Vite.
След документацията следва задача 3.1 — конфигурация на карта и герой.
