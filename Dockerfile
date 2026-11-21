FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY skillup-cloud.js /usr/share/nginx/html/skillup-cloud.js
COPY skillup-ai.js /usr/share/nginx/html/skillup-ai.js
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY icons/ /usr/share/nginx/html/icons/
EXPOSE 8080
