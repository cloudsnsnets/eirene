FROM nginx:alpine

# Copy PWA files to nginx web root
COPY index.html /usr/share/nginx/html/
COPY tunnel-worker.js /usr/share/nginx/html/
COPY noise-worker.js /usr/share/nginx/html/

# Nginx config — serve with correct headers for Service Workers
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8082

CMD ["nginx", "-g", "daemon off;"]
