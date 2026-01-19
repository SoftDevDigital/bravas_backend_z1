# 📋 cURL Commands - Content Service - AGENCY (Listos para usar)

**Token AGENCY incluido** - Listo para copiar y pegar en Postman

---

## 📝 ENDPOINTS DE POSTS (AGENCY puede usar)

### 1. POST /content/posts/upload - Subir imagen para post

**Nota:** En Postman, usa la pestaña "Body" → "form-data" y agrega:
- Key: `image` (tipo: File)
- Value: Selecciona una imagen

```bash
curl -X POST http://localhost:3005/api/v1/content/posts/upload \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw" \
  -F "image=@/ruta/a/tu/imagen.jpg"
```

---

### 2. POST /content/posts - Crear post

**IMPORTANTE:** Reemplaza `URL_DE_LA_IMAGEN_SUBIDA` y `KEY_DE_LA_IMAGEN_SUBIDA` con los valores obtenidos del endpoint anterior.

```bash
curl -X POST http://localhost:3005/api/v1/content/posts \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Post desde la agencia",
    "imageUrl": "URL_DE_LA_IMAGEN_SUBIDA",
    "imageKey": "KEY_DE_LA_IMAGEN_SUBIDA"
  }'
```

---

### 3. GET /content/posts - Feed global (AGENCY)

**Descripción:** Para AGENCY, retorna feed global (todos los posts activos). AGENCY NO tiene feed personalizado.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 4. GET /content/posts/:postId - Obtener post por ID

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post creado.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 5. POST /content/posts/:postId/like - Dar like a post

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post.

```bash
curl -X POST "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/like" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 6. GET /content/posts/:postId/likes - Ver quién dio like

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/likes?page=1&limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 7. POST /content/posts/:postId/comments - Comentar en post

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post.

**Body:**
```json
{
  "content": "Excelente post desde la agencia!"
}
```

**cURL:**
```bash
curl -X POST "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/comments" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Excelente post desde la agencia!"
  }'
```

---

### 8. GET /content/posts/:postId/comments - Ver comentarios de un post

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI/comments?page=1&limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 9. PUT /content/posts/:postId - Actualizar post

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post creado por AGENCY.

**Body:**
```json
{
  "description": "Post actualizado desde la agencia"
}
```

**cURL:**
```bash
curl -X PUT "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Post actualizado desde la agencia"
  }'
```

---

### 10. DELETE /content/posts/:postId - Eliminar post

**IMPORTANTE:** Reemplaza `POST_ID_AQUI` con el ID del post creado por AGENCY.

```bash
curl -X DELETE "http://localhost:3005/api/v1/content/posts/POST_ID_AQUI" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

### 11. GET /content/posts?userId=USER_ID - Ver posts de un usuario específico

**IMPORTANTE:** Reemplaza `USER_ID_AQUI` con el ID del usuario.

```bash
curl -X GET "http://localhost:3005/api/v1/content/posts?userId=USER_ID_AQUI&limit=20" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

---

## 🚫 ENDPOINTS QUE AGENCY NO PUEDE USAR

### ❌ GET /content/feed - Feed personalizado

**Esto retornará 403 Forbidden:**

```bash
curl -X GET "http://localhost:3005/api/v1/content/feed" \
  -H "Authorization: Bearer eyJraWQiOiJkQ1dkbVBXWDQxc0lVaDVHM1FEUHRxOXZadFF5OXRcL2RmWEVKdFRZYnpDWT0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1NGQ4YzQ3OC03MGMxLTcwZGMtMDlhNy04NTU2YTFhNWE0MzYiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0xLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMV96WHB3czBWU2ciLCJjbGllbnRfaWQiOiIyYXFtMzlnbWFjaWpndmFsNGhwazVpbGwwayIsIm9yaWdpbl9qdGkiOiI4MWIzMmM3NS1lMjJmLTQ4NDEtYWVmYi1jMjlhODY0OWJmM2IiLCJldmVudF9pZCI6ImJlYTZkOTRiLTNhMjktNDUxMy1iOGI5LTVmMGZkOGE1MWVlZiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3Njg3OTk2ODIsImV4cCI6MTc2ODgwMzI4MiwiaWF0IjoxNzY4Nzk5NjgyLCJqdGkiOiI5NmM2YzJkOS0yNzJmLTRlOGItYjNhYS1mNmVhYTY2ZDExNDYiLCJ1c2VybmFtZSI6Ijk4NmViNWE3LWQzZWMtNGIwMi1hYmYwLTNmZTUxYjM3MWNkZiJ9.esniBeCpz-HNHrUZygf-N_mFf6sYWLI8xuAktdrqkF_gp1tpq6110YuEY_7wnZjnV6jwCp37aC-3ElwWYAklq7K-RU0S4FCko68KXEOZ3ylu9pcjImiRNYI_pa1DtfosadgLmDCOodm0CtyQcpuc6JfXBNtefAfm-W8zixZAXh7jR9d4CQAhh49Ydg6t--KUXPUSexZasuCy5ahFRWiJMAQmsJ7SAo4mWubNqRlofM1KUT6fqIhWxn16H6O6sizk8DtK9z2KNSRopCs75gbnOK9HuzeKDtDHR8_ouiXpoLqxYWRBdXed_I4wQY-dTWpcVNgxiq1ZIvxeMWEw8eM1Fw"
```

**Respuesta esperada:**
```json
{
  "statusCode": 403,
  "message": "Solo usuarios con rol USER o MODEL pueden acceder al feed personalizado. AGENCY debe usar GET /content/posts para feed global."
}
```

---

## 🔄 ORDEN RECOMENDADO DE PRUEBAS

1. **POST /content/posts/upload** → Subir imagen para post
2. **POST /content/posts** → Crear post (usa los valores del paso 1)
3. **GET /content/posts** → Ver feed global (verificar que el post aparece)
4. **GET /content/posts/:postId** → Ver detalles del post creado
5. **POST /content/posts/:postId/like** → Dar like a un post
6. **GET /content/posts/:postId/likes** → Ver quién dio like
7. **POST /content/posts/:postId/comments** → Comentar en un post
8. **GET /content/posts/:postId/comments** → Ver comentarios del post
9. **PUT /content/posts/:postId** → Actualizar el post propio
10. **GET /content/posts?userId=USER_ID** → Ver posts de un usuario específico
11. **GET /content/feed** → Intentar acceder a feed personalizado (debe fallar con 403)

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
   - `URL_DE_LA_IMAGEN_SUBIDA` → URL obtenida del upload
   - `KEY_DE_LA_IMAGEN_SUBIDA` → Key obtenida del upload
   - `POST_ID_AQUI` → ID del post creado
   - `USER_ID_AQUI` → ID del usuario específico

6. **Todos los endpoints requieren autenticación** (token ya incluido)

7. **El puerto del content-service es 3005**
