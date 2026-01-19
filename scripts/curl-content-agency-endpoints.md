# 📋 cURL Commands - Content Service - Endpoints AGENCY

Este documento contiene todos los comandos cURL para probar los endpoints del **Content Service** con rol **AGENCY**.

## 🔐 Paso 0: Login como AGENCY

**IMPORTANTE:** Necesitas las credenciales de un usuario con rol AGENCY.

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "TU_EMAIL_AGENCY@ejemplo.com",
    "password": "TU_PASSWORD"
  }'
```

**Guarda el `accessToken` de la respuesta para usarlo en los siguientes comandos.**

**Credenciales de prueba:**
- Email: `devtech.notification@gmail.com`
- Password: `Quelindouba2015@`

---

## 📝 ENDPOINTS DE POSTS (AGENCY puede usar)

### 1. POST /content/posts/upload - Subir imagen para post

**Descripción:** Sube una imagen a S3 para usar en crear post.

**Nota:** En Postman, usa la pestaña "Body" → "form-data" y agrega:
- Key: `image` (tipo: File)
- Value: Selecciona una imagen

```bash
curl -X POST http://localhost:3005/api/v1/content/posts/upload \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -F "image=@/ruta/a/tu/imagen.jpg"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://bravas-content-dev-663134816305.s3.us-east-1.amazonaws.com/posts/USER_ID/IMAGE_KEY.png",
    "imageKey": "posts/USER_ID/IMAGE_KEY.png"
  },
  "message": "Imagen subida exitosamente"
}
```

**Guarda `imageUrl` e `imageKey` para crear el post.**

---

### 2. POST /content/posts - Crear post

**Descripción:** Crea un post con texto e imagen opcional. AGENCY puede crear posts.

**Body:**
```json
{
  "description": "Post desde la agencia",
  "imageUrl": "URL_DE_LA_IMAGEN_SUBIDA",
  "imageKey": "KEY_DE_LA_IMAGEN_SUBIDA"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3005/api/v1/content/posts \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Post desde la agencia",
    "imageUrl": "URL_DE_LA_IMAGEN_SUBIDA",
    "imageKey": "KEY_DE_LA_IMAGEN_SUBIDA"
  }'
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "post_USER_ID_TIMESTAMP",
    "postId": "post_USER_ID_TIMESTAMP",
    "userId": "USER_ID",
    "userRole": "agency",
    "description": "Post desde la agencia",
    "imageUrl": "https://...",
    "likesCount": 0,
    "commentsCount": 0,
    "status": "active",
    "createdAt": "2026-01-19T..."
  },
  "message": "Post creado exitosamente"
}
```

**Guarda el `postId` para las siguientes operaciones.**

---

### 3. GET /content/posts - Feed global (AGENCY)

**Descripción:** Para AGENCY, sin `userId`, retorna feed global (todos los posts activos). AGENCY NO tiene feed personalizado.

#### 3.1 Feed global (por defecto para AGENCY)
```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?limit=20" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

#### 3.2 Feed global explícito
```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?type=global&limit=20" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

#### 3.3 Posts de un usuario específico
```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?userId=USER_ID_AQUI&limit=20" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "postId": "post_123",
      "userId": "user_456",
      "userRole": "user",
      "description": "Contenido...",
      "imageUrl": "https://...",
      "likesCount": 25,
      "commentsCount": 5
    }
  ],
  "message": "Feed global obtenido exitosamente",
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "cursor": "..."
  }
}
```

---

### 4. GET /content/posts/:postId - Obtener post por ID

**Descripción:** Obtiene los detalles de un post específico.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "postId": "post_123",
    "userId": "user_456",
    "userRole": "user",
    "authorName": "Juan Pérez",
    "description": "Contenido del post",
    "imageUrl": "https://...",
    "likesCount": 25,
    "commentsCount": 5,
    "status": "active"
  },
  "message": "Post obtenido exitosamente"
}
```

---

### 5. POST /content/posts/:postId/like - Dar like a post

**Descripción:** Da like a un post. Si ya le diste like, lo quita automáticamente (toggle).

```bash
curl -X POST "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/like" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "postId": "post_123",
    "liked": true,
    "likesCount": 26
  },
  "message": "Like agregado exitosamente"
}
```

---

### 6. GET /content/posts/:postId/likes - Ver quién dio like

**Descripción:** Retorna la lista paginada de usuarios que dieron like a un post.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/likes?page=1&limit=20" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "user_123",
      "fullName": "Juan Pérez",
      "avatarUrl": "https://..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2
  }
}
```

---

### 7. POST /content/posts/:postId/comments - Comentar en post

**Descripción:** Agrega un comentario a un post.

**Body:**
```json
{
  "content": "Excelente post desde la agencia!"
}
```

**cURL:**
```bash
curl -X POST "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/comments" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Excelente post desde la agencia!"
  }'
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "commentId": "comment_123",
    "postId": "post_123",
    "userId": "agency_456",
    "userRole": "agency",
    "content": "Excelente post desde la agencia!",
    "authorName": "Agencia XYZ",
    "createdAt": "2026-01-19T..."
  },
  "message": "Comentario creado exitosamente"
}
```

---

### 8. GET /content/posts/:postId/comments - Ver comentarios de un post

**Descripción:** Retorna la lista paginada de comentarios de un post.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/comments?page=1&limit=20" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "commentId": "comment_123",
      "userId": "user_456",
      "userRole": "user",
      "content": "Excelente post!",
      "authorName": "Juan Pérez",
      "createdAt": "2026-01-19T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 9. PUT /content/posts/:postId - Actualizar post

**Descripción:** Actualiza un post existente (solo el autor puede editar).

**Body:**
```json
{
  "description": "Post actualizado desde la agencia"
}
```

**cURL:**
```bash
curl -X PUT "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Post actualizado desde la agencia"
  }'
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "postId": "post_123",
    "description": "Post actualizado desde la agencia",
    "updatedAt": "2026-01-19T..."
  },
  "message": "Post actualizado exitosamente"
}
```

---

### 10. DELETE /content/posts/:postId - Eliminar post

**Descripción:** Elimina un post (solo el autor puede eliminar).

```bash
curl -X DELETE "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Post eliminado exitosamente"
}
```

---

## 🚫 ENDPOINTS QUE AGENCY NO PUEDE USAR

### ❌ GET /content/feed - Feed personalizado
**Razón:** AGENCY no tiene feed personalizado. Debe usar `GET /content/posts` para feed global.

```bash
# Esto retornará 403 Forbidden
curl -X GET "http://localhost:3005/api/v1/content/feed" \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

**Respuesta esperada:**
```json
{
  "statusCode": 403,
  "message": "Solo usuarios con rol USER o MODEL pueden acceder al feed personalizado. AGENCY debe usar GET /content/posts para feed global."
}
```

### ❌ POST /content/packs/upload - Subir imagen para pack
**Razón:** Solo MODEL puede crear packs.

### ❌ POST /content/packs - Crear pack
**Razón:** Solo MODEL puede crear packs.

### ❌ GET /content/packs/purchased - Packs comprados
**Razón:** Solo USER puede ver packs comprados.

---

## 🔄 FLUJO COMPLETO RECOMENDADO PARA AGENCY

1. **Login** → Obtener token
2. **POST /content/posts/upload** → Subir imagen para post
3. **POST /content/posts** → Crear post con la imagen
4. **GET /content/posts** → Ver feed global (verificar que el post aparece)
5. **GET /content/posts/:postId** → Ver detalles del post creado
6. **POST /content/posts/:postId/like** → Dar like a un post
7. **GET /content/posts/:postId/likes** → Ver quién dio like
8. **POST /content/posts/:postId/comments** → Comentar en un post
9. **GET /content/posts/:postId/comments** → Ver comentarios del post
10. **PUT /content/posts/:postId** → Actualizar el post
11. **GET /content/posts?userId=USER_ID** → Ver posts de un usuario específico

---

## ⚠️ NOTAS IMPORTANTES

1. **AGENCY NO tiene feed personalizado:**
   - No puede usar `GET /content/feed`
   - Debe usar `GET /content/posts` que retorna feed global

2. **AGENCY NO puede crear packs:**
   - Solo MODEL puede crear y gestionar packs
   - AGENCY puede ver packs pero no crearlos

3. **AGENCY puede:**
   - ✅ Crear posts
   - ✅ Ver feed global
   - ✅ Ver posts de usuarios específicos
   - ✅ Dar likes y comentar
   - ✅ Editar y eliminar sus propios posts

4. **Para subir imágenes en Postman:**
   - Usa la pestaña "Body"
   - Selecciona "form-data"
   - Key: `image` (tipo: File)
   - Value: Selecciona tu archivo

5. **Reemplaza los valores:**
   - `TU_TOKEN_AQUI` → Token obtenido del login
   - `POST_ID_AQUI` → ID del post creado
   - `USER_ID_AQUI` → ID del usuario específico

6. **Todos los endpoints requieren autenticación** (header `Authorization: Bearer TOKEN`)

7. **El puerto del content-service es 3005**

---

## 🧪 ORDEN DE PRUEBAS SUGERIDO

1. Login como AGENCY
2. Subir imagen para post
3. Crear post
4. Ver feed global (verificar que aparece)
5. Ver post por ID
6. Dar like a un post
7. Ver likes de un post
8. Comentar en un post
9. Ver comentarios de un post
10. Actualizar post propio
11. Ver posts de un usuario específico
12. Intentar acceder a feed personalizado (debe fallar con 403)
13. Intentar crear pack (debe fallar con 400/403)
