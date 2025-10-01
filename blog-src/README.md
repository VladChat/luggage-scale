# Luggage Scale Blog

Блог для сайта [luggage-scale.com](https://luggage-scale.com), собранный на **Hugo** с темой [PaperMod](https://github.com/adityatelange/hugo-PaperMod).

---

## 📂 Структура

- `/blog-src/`  
  Исходники Hugo-блога.  
  - `config.yml` — конфигурация Hugo.  
  - `content/` — посты (`_index.md`, `posts/`).  
  - `themes/PaperMod/` — тема PaperMod (добавлена статической копией, без submodule).  
  - `static/favicon.svg` — иконка блога.  
  - `README.md` — документация по настройкам и изменениям.  

- `/blog/`  
  Скомпилированный блог (результат работы Hugo).  

- `/` (корень репозитория)  
  Мини-сайт на статических HTML (index.html, shop.html, manual.html и т.д.).  

- `.github/workflows/blog-build.yml`  
  GitHub Actions workflow, который билдит Hugo и коммитит результат в `/blog`.  

---

##⚙️ Конфигурация

- **Hugo**: `0.146.0` (минимальная версия для PaperMod).  
- **Тема**: PaperMod (локальная копия, не submodule).  
- **Пагинация**:  
  ```yaml
  pagination:
    pagerSize: 10
Google Analytics: отключён, чтобы убрать ошибку:

yaml
Copy code
params:
  disableGA: true
⚠️ Если понадобится включить GA, убрать строку disableGA: true и настроить googleAnalytics: "UA-XXXXXXX-X".

🚀 Деплой
При push в ветку main → GitHub Actions запускает workflow.

Hugo собирает /blog-src → результат кладётся в /blog.

GitHub Pages разворачивает сайт:

https://luggage-scale.com/ — мини-сайт.

https://luggage-scale.com/blog/ — блог Hugo.

📝 История проблем и решений
Submodule PaperMod не работал

Ошибка: module "PaperMod" not found.

Решение: скачали тему в blog-src/themes/PaperMod как обычную папку.

Deprecated параметр paginate

Hugo писал: paginate is deprecated.

Решение: заменили на

yaml
Copy code
pagination:
  pagerSize: 10
Ошибка Google Analytics

Ошибка: partial "google_analytics.html" not found.

Решение: добавили disableGA: true в config.yml.

Hugo версия слишком старая

Ошибка: PaperMod requires Hugo v0.146.0.

Решение: обновили workflow → hugo-version: '0.146.0'.

🔮 TODO
Добавить Writer-агента, который будет через OpenAI API генерировать посты (.md) в blog-src/content/posts/.

Включить Google Analytics, когда будут готовы UA/GA4-ключи.

Настроить SEO (мета-теги, sitemap, robots.txt уже включён).

Проверить кастомизацию меню и стилей.# Luggage Scale Blog

Блог для сайта [luggage-scale.com](https://luggage-scale.com), собранный на **Hugo** с темой [PaperMod](https://github.com/adityatelange/hugo-PaperMod).

---

## 📂 Структура

- `/blog-src/`  
  Исходники Hugo-блога.  
  - `config.yml` — конфигурация Hugo.  
  - `content/` — посты (`_index.md`, `posts/`).  
  - `themes/PaperMod/` — тема PaperMod (добавлена статической копией, без submodule).  
  - `static/favicon.svg` — иконка блога.  
  - `README.md` — документация по настройкам и изменениям.  

- `/blog/`  
  Скомпилированный блог (результат работы Hugo).  

- `/` (корень репозитория)  
  Мини-сайт на статических HTML (index.html, shop.html, manual.html и т.д.).  

- `.github/workflows/blog-build.yml`  
  GitHub Actions workflow, который билдит Hugo и коммитит результат в `/blog`.  

---

## ⚙️ Конфигурация

- **Hugo**: `0.146.0` (минимальная версия для PaperMod).  
- **Тема**: PaperMod (локальная копия, не submodule).  
- **Пагинация**:  
  ```yaml
  pagination:
    pagerSize: 10
Google Analytics: отключён, чтобы убрать ошибку:

yaml
Copy code
params:
  disableGA: true
⚠️ Если понадобится включить GA, убрать строку disableGA: true и настроить googleAnalytics: "UA-XXXXXXX-X".

🚀 Деплой
При push в ветку main → GitHub Actions запускает workflow.

Hugo собирает /blog-src → результат кладётся в /blog.

GitHub Pages разворачивает сайт:

https://luggage-scale.com/ — мини-сайт.

https://luggage-scale.com/blog/ — блог Hugo.

📝 История проблем и решений
Submodule PaperMod не работал

Ошибка: module "PaperMod" not found.

Решение: скачали тему в blog-src/themes/PaperMod как обычную папку.

Deprecated параметр paginate

Hugo писал: paginate is deprecated.

Решение: заменили на

yaml
Copy code
pagination:
  pagerSize: 10
Ошибка Google Analytics

Ошибка: partial "google_analytics.html" not found.

Решение: добавили disableGA: true в config.yml.

Hugo версия слишком старая

Ошибка: PaperMod requires Hugo v0.146.0.

Решение: обновили workflow → hugo-version: '0.146.0'.

🔮 TODO
Добавить Writer-агента, который будет через OpenAI API генерировать посты (.md) в blog-src/content/posts/.

Включить Google Analytics, когда будут готовы UA/GA4-ключи.

Настроить SEO (мета-теги, sitemap, robots.txt уже включён).

Проверить кастомизацию меню и стилей.