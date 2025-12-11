# Imagen de producción para aplicación web estática con TLS
FROM nginx:alpine

# Copiar archivos estáticos al directorio de nginx
COPY . /usr/share/nginx/html

# Copiar configuración de nginx (incluye HTTP->HTTPS y TLS)
COPY config/nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puertos HTTP y HTTPS
EXPOSE 80 443

# Iniciar nginx en modo foreground
CMD ["nginx", "-g", "daemon off;"]

