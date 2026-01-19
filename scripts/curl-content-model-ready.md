# 📋 cURL Commands - Content Service - MODEL (Listos para usar)

**Token MODEL incluido** - Listo para copiar y pegar en Postman

---

## 📦 ENDPOINTS DE PACKS (Solo MODEL)

### 1. POST /content/packs/upload - Subir imagen para pack

**Nota:** En Postman, usa la pestaña "Body" → "form-data" y agrega:
- Key: `image` (tipo: File)
- Value: Selecciona una imagen

```bash
curl -X POST http://localhost:3005/api/v1/content/packs/upload \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -F "image=@/ruta/a/tu/imagen.jpg"
```

---

### 2. POST /content/packs - Crear pack

**IMPORTANTE:** Reemplaza `URL_DE_LA_IMAGEN_SUBIDA` y `KEY_DE_LA_IMAGEN_SUBIDA` con los valores obtenidos del endpoint anterior.

```bash
curl -X POST http://localhost:3005/api/v1/content/packs \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pack Premium",
    "description": "Contenido exclusivo y premium",
    "price": 49.99,
    "imageUrl": "URL_DE_LA_IMAGEN_SUBIDA",
    "imageKey": "KEY_DE_LA_IMAGEN_SUBIDA",
    "contentUrls": [],
    "contentKeys": []
  }'
```

**NOTA IMPORTANTE:** El precio se envía y almacena en **dólares** (ej: 49.99 = $49.99). Todo el sistema maneja precios en dólares, no en centavos.
```

---

### 3. GET /content/packs - Listar todos los packs

```bash
curl -X GET "http://localhost:3005/api/v1/content/packs?limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A"
```

---

### 4. GET /content/packs/:packId - Obtener pack por ID

**IMPORTANTE:** Reemplaza `PACK_ID_AQUI` con el ID del pack creado.

```bash
curl -X GET "http://localhost:3005/api/v1/content/packs/PACK_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A"
```

---

### 5. POST /content/packs/:packId/content - Subir múltiples imágenes y videos al pack

**IMPORTANTE:** 
- Reemplaza `PACK_ID_AQUI` con el ID del pack creado
- En Postman, usa la pestaña "Body" → "form-data" y agrega:
  - Key: `files` (tipo: File)
  - Value: Selecciona MÚLTIPLES archivos (imágenes y/o videos)
  - Puedes agregar varios archivos con el mismo key `files`

**Descripción:** Este es el endpoint principal para agregar contenido (fotos y videos) al pack. Permite subir hasta 20 archivos a la vez.

**Tipos permitidos:**
- Imágenes: JPEG, PNG, WebP, GIF (máx 10MB cada una)
- Videos: MP4, WebM, MOV, AVI (máx 100MB cada uno)

```bash
curl -X POST "http://localhost:3005/api/v1/content/packs/PACK_ID_AQUI/content" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -F "files=@/ruta/a/imagen1.jpg" \
  -F "files=@/ruta/a/imagen2.png" \
  -F "files=@/ruta/a/video1.mp4"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "packId": "pack_123",
    "uploaded": [
      {
        "contentUrl": "https://bravas-content-dev-663134816305.s3.us-east-1.amazonaws.com/packs/USER_ID/pack_123/content/uuid1.jpg",
        "contentKey": "packs/USER_ID/pack_123/content/uuid1.jpg",
        "type": "image"
      },
      {
        "contentUrl": "https://bravas-content-dev-663134816305.s3.us-east-1.amazonaws.com/packs/USER_ID/pack_123/content/uuid2.mp4",
        "contentKey": "packs/USER_ID/pack_123/content/uuid2.mp4",
        "type": "video"
      }
    ],
    "totalUploaded": 2
  },
  "message": "Contenido subido exitosamente"
}
```

---

### 6. PUT /content/packs/:packId - Actualizar pack

**IMPORTANTE:** Reemplaza `PACK_ID_AQUI` con el ID del pack creado.

```bash
curl -X PUT "http://localhost:3005/api/v1/content/packs/PACK_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pack Premium Actualizado",
    "description": "Nueva descripción",
    "price": 59.99
  }'
```

---

### 7. DELETE /content/packs/:packId - Eliminar pack

**IMPORTANTE:** Reemplaza `PACK_ID_AQUI` con el ID del pack creado.

```bash
curl -X DELETE "http://localhost:3005/api/v1/content/packs/PACK_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A"
```

---

## 📝 ENDPOINTS DE POSTS (Todos los roles, incluido MODEL)

### 7. POST /content/posts/upload - Subir imagen para post

**Nota:** En Postman, usa la pestaña "Body" → "form-data" y agrega:
- Key: `image` (tipo: File)
- Value: Selecciona una imagen

```bash
curl -X POST http://localhost:3005/api/v1/content/posts/upload \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -F "image=@/ruta/a/tu/imagen.jpg"
```

---

### 8. POST /content/posts - Crear post

**IMPORTANTE:** Reemplaza `URL_DE_LA_IMAGEN_SUBIDA` y `KEY_DE_LA_IMAGEN_SUBIDA` con los valores obtenidos del endpoint anterior.

```bash
curl -X POST http://localhost:3005/api/v1/content/posts \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Mi primer post como modelo",
    "imageUrl": "URL_DE_LA_IMAGEN_SUBIDA",
    "imageKey": "KEY_DE_LA_IMAGEN_SUBIDA"
  }'
```

---

### 9. GET /content/posts - Feed personalizado (MODEL)

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A"
```

---

### 10. GET /content/feed - Feed personalizado (MODEL)

```bash
curl -X GET "http://localhost:3005/api/v1/content/feed?limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2NGE4ODQ3OC0zMGQxLTcwMWUtZmIzOS0wNGFjM2I2NDlmOTQiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiIwYTk0NDg5MC1iMTk3LTQ1ZDYtYTM1Ni04MDI4ZDAwNDgxMTgiLCJldmVudF9pZCI6IjUwYTk1Mjk0LTYyY2MtNGYxNC1hNTgzLTk4ODFkM2U1MGY1OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTYyMzgsImV4cCI6MTc2ODc5OTgzOCwiaWF0IjoxNzY4Nzk2MjM4LCJqdGkiOiIwOTNkZGEyNC1mZGU3LTQ4ZmEtOTQ4NC1jN2U2ODdhMTdiN2QiLCJ1c2VybmFtZSI6Ijc0ZjM5Yjk2LWY0NTktNGNmZi04NDgxLWE5NWU1MDcyNDA1YSJ9.q22tXWtGUHSEznFXCC4Nx6r-3Xwfhz5bLitQX7kMR7fyoi-hX7L0HgmC3-gRZwE7RkKglXWvJzoDSd2cSbgzumMoQRL3nHy8ts06qW4Qllym9YfkDE8qWbU6_PV3gYkZCLbDP32VoQ8JWuip2Uj8TykvIdoEpLFQ5bZdAZ8uOmGjwWoQ8_V4-5oJe0HHEs6afd00tiuq2wdVG9pB2BJyL85edIXC9rhfGUVlDn-XdNPJ_RN4y8szlZGoD8VA-lOPMXZa3gaY6UZ4ZuvtS3rpwlt4J2uKZoJPo6aRdd0COktpiwOpiWzTCJrXKmQK1p0RH71y-PkoUrv7NZ5rDCDJ7A"
```

---

## 🔄 ORDEN RECOMENDADO DE PRUEBAS

### Flujo completo de creación de pack con contenido:

1. **POST /content/packs/upload** → Subir imagen de portada para pack
2. **POST /content/packs** → Crear pack básico (usa los valores del paso 1)
3. **POST /content/packs/:packId/content** → Subir múltiples imágenes y videos al pack ⭐ **IMPORTANTE**
4. **GET /content/packs/:packId** → Ver detalles del pack completo (con todo el contenido)
5. **GET /content/packs** → Verificar que el pack se creó correctamente
6. **PUT /content/packs/:packId** → Actualizar información del pack (nombre, descripción, precio)
7. **POST /content/posts/upload** → Subir imagen para post
8. **POST /content/posts** → Crear post (usa los valores del paso 7)
9. **GET /content/posts** → Ver feed personalizado
10. **GET /content/feed** → Ver feed personalizado (alternativa)

### ⚠️ NOTA IMPORTANTE SOBRE PACKS:

Un pack **DEBE** tener contenido (fotos y/o videos). El flujo correcto es:
1. Crear el pack básico (con imagen de portada)
2. **Agregar contenido** usando `POST /content/packs/:packId/content` (múltiples imágenes y videos)
3. El pack quedará completo con todo su contenido

---

## ⚠️ NOTAS IMPORTANTES

1. **Para subir imágenes/videos en Postman:**
   - Usa la pestaña "Body"
   - Selecciona "form-data"
   - Para imagen de portada: Key: `image` (tipo: File)
   - Para contenido del pack: Key: `files` (tipo: File) - Puedes agregar múltiples archivos con el mismo key
   - Value: Selecciona tu archivo(s)

2. **Reemplaza los valores:**
   - `URL_DE_LA_IMAGEN_SUBIDA` → URL obtenida del upload de portada
   - `KEY_DE_LA_IMAGEN_SUBIDA` → Key obtenida del upload de portada
   - `PACK_ID_AQUI` → ID del pack creado
   - `POST_ID_AQUI` → ID del post creado

3. **Todos los endpoints requieren autenticación** (token ya incluido)

4. **El puerto del content-service es 3005**

5. **Sobre el contenido de packs:**
   - Un pack puede tener múltiples imágenes y videos
   - Usa `POST /content/packs/:packId/content` para agregar contenido
   - Puedes subir hasta 20 archivos por request
   - Tipos permitidos: JPEG, PNG, WebP, GIF (imágenes) y MP4, WebM, MOV, AVI (videos)
