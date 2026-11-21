Для актуального index.html перенесите:
1. `<link rel="manifest" ...>`, Apple meta и touch-icon в `<head>`.
2. CSS-блок `v29.11.2` в `<style>`.
3. В начало `function go(id)` после переименования `plans`: добавьте `.classList.toggle('skillup-ai-locked',id==='assistant')` для html/body.
4. Не запускайте `window.scrollTo` для вкладки assistant.
5. Положите `manifest.webmanifest`, PNG из `icons/`, добавьте COPY в Dockerfile, отдельные location в nginx.conf.
Не заменяйте текущие более новые функции ИИ или JS-модули.
