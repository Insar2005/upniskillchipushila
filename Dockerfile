FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY skillup-cloud.js /usr/share/nginx/html/skillup-cloud.js
EXPOSE 8080
