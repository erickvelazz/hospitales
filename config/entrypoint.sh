#!/bin/sh

# Variables de configuración
DOMAIN="hospital-integradora.duckdns.org"      # Tu dominio DuckDNS
EMAIL="20223tn081@utez.edu.mx"             # Email para notificaciones
PASS="JESUSKEYSTORE"                 # Contraseña para el keystore.p12

# Rutas
CREDENTIALS="/opt/duckdns/duckdns.ini"
LIVE="/etc/letsencrypt/live/$DOMAIN"
P12="$LIVE/keystore.p12"

# Función para generar el keystore P12
generate_p12() {
    if [ -f "$LIVE/fullchain.pem" ] && [ -f "$LIVE/privkey.pem" ]; then
        echo "Generando keystore.p12..."
        openssl pkcs12 -export \
            -in "$LIVE/fullchain.pem" \
            -inkey "$LIVE/privkey.pem" \
            -out "$P12" \
            -name spring \
            -password pass:$PASS
        echo "keystore.p12 generado exitosamente en $P12"
    else
        echo "Error: No se encontraron los certificados necesarios para generar el P12"
    fi
}

# Función para generar certificados iniciales
generate_certs() {
    echo "Generando certificados SSL para $DOMAIN..."
    certbot certonly \
        --agree-tos \
        --no-eff-email \
        --email "$EMAIL" \
        --authenticator dns-duckdns \
        --dns-duckdns-credentials "$CREDENTIALS" \
        --dns-duckdns-propagation-seconds 120 \
        -d "$DOMAIN"
    
    if [ $? -eq 0 ]; then
        echo "Certificados generados exitosamente"
        generate_p12
    else
        echo "Error al generar certificados"
        exit 1
    fi
}

# Función para renovar certificados
renew_all() {
    echo "Renovando certificados..."
    certbot renew --dns-duckdns --dns-duckdns-credentials "$CREDENTIALS"
    
    if [ $? -eq 0 ]; then
        echo "Renovación completada"
        generate_p12
    else
        echo "Error en la renovación"
    fi
}

# Verificar si existen certificados
if [ ! -d "$LIVE" ] || [ ! -f "$LIVE/fullchain.pem" ]; then
    echo "No se encontraron certificados existentes. Generando nuevos certificados..."
    generate_certs
else
    echo "Certificados existentes encontrados en $LIVE"
    # Asegurar que existe el P12
    if [ ! -f "$P12" ]; then
        echo "Generando keystore.p12..."
        generate_p12
    fi
fi

# Bucle de renovación automática (cada 12 horas)
echo "Iniciando bucle de renovación automática (cada 12 horas)..."
while true; do
    sleep 43200  # 12 horas en segundos
    renew_all
done

