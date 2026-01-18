#!/bin/bash
# Comando curl para probar POST /users/me/avatar

# Configuración
BASE_URL="http://localhost:3001/api/v1"
TOKEN="TU_TOKEN_AQUI"
IMAGE_PATH="/ruta/a/tu/imagen.jpg"

# Comando curl
curl -X POST "${BASE_URL}/users/me/avatar" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${IMAGE_PATH}" \
  -v
