#!/bin/bash

# Script de prueba rápida para Auth Service
# Uso: ./test-auth.sh

BASE_URL="http://localhost:3000/api/v1"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="Password123!"

echo "🧪 Iniciando pruebas del Auth Service..."
echo "Base URL: $BASE_URL"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para hacer requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data"
    else
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

echo "📝 1. Probando REGISTER..."
REGISTER_RESPONSE=$(make_request POST "/auth/register" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"role\": \"user\",
    \"birthDate\": \"2000-01-01\",
    \"country\": \"AR\"
}")

echo "$REGISTER_RESPONSE" | jq '.'
echo ""

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Registro exitoso${NC}"
    USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.userId')
    echo "User ID: $USER_ID"
else
    echo -e "${RED}❌ Error en registro${NC}"
    echo "Continúo con las pruebas asumiendo que el usuario ya existe..."
fi

echo ""
echo "🔐 2. Probando LOGIN..."
echo "⚠️  NOTA: Si el registro fue nuevo, el usuario debe verificar su email en AWS Cognito antes de poder hacer login"
echo ""

LOGIN_RESPONSE=$(make_request POST "/auth/login" "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
}")

echo "$LOGIN_RESPONSE" | jq '.'
echo ""

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    echo -e "${GREEN}✅ Login exitoso${NC}"
    echo "Access Token obtenido: ${ACCESS_TOKEN:0:50}..."
    echo ""
    
    echo "👤 3. Probando /me (endpoint protegido)..."
    ME_RESPONSE=$(make_request GET "/auth/me" "" "$ACCESS_TOKEN")
    echo "$ME_RESPONSE" | jq '.'
    echo ""
    
    if echo "$ME_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ /me exitoso${NC}"
    else
        echo -e "${RED}❌ Error en /me${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Login falló - esto puede ser normal si:${NC}"
    echo "  - El usuario no ha verificado su email"
    echo "  - Las credenciales son incorrectas"
    echo "  - El usuario no existe"
fi

echo ""
echo "🔄 4. Probando REFRESH TOKEN..."
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken // empty')

if [ -n "$REFRESH_TOKEN" ] && [ "$REFRESH_TOKEN" != "null" ]; then
    REFRESH_RESPONSE=$(make_request POST "/auth/refresh" "{
        \"refreshToken\": \"$REFRESH_TOKEN\"
    }")
    echo "$REFRESH_RESPONSE" | jq '.'
    echo ""
    echo -e "${YELLOW}ℹ️  Nota: Refresh token puede estar en desarrollo${NC}"
else
    echo -e "${YELLOW}⚠️  No hay refresh token disponible${NC}"
fi

echo ""
echo "✅ Pruebas completadas!"
echo ""
echo "📧 Email usado para pruebas: $TEST_EMAIL"
echo "🔑 Password: $TEST_PASSWORD"






