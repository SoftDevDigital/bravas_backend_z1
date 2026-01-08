# Script de Pruebas para Rol USER - Versión Simple
# Ejecuta: .\scripts\test-user-endpoints-simple.ps1

$ErrorActionPreference = "Continue"

Write-Host "`n🧪 PRUEBAS DE ENDPOINTS - ROL USER" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Paso 1: Login
Write-Host "🔐 Paso 1: Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "alexis.correa026@gmail.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $global:token = $loginResponse.data.accessToken
    $global:userId = $loginResponse.data.user.userId
    Write-Host "✅ Login exitoso!" -ForegroundColor Green
    Write-Host "   User ID: $($global:userId)" -ForegroundColor Gray
    Write-Host "   Rol: $($loginResponse.data.user.role)" -ForegroundColor Gray
    $tokenPreview = $global:token.Substring(0, [Math]::Min(50, $global:token.Length))
    Write-Host "   Token: $tokenPreview..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

$global:headers = @{
    "Authorization" = "Bearer $global:token"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# ============================================
# PARTE 1: Gestión de Perfil
# ============================================
Write-Host "`n📋 PARTE 1: Gestión de Perfil" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1.1 Obtener Mi Perfil
Write-Host "`n1.1 GET /users/me - Obtener mi perfil" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me" -Method GET -Headers $global:headers
    Write-Host "✅ Perfil obtenido exitosamente" -ForegroundColor Green
    Write-Host "   Email: $($response.data.email)" -ForegroundColor Gray
    Write-Host "   Nombre: $($response.data.fullName)" -ForegroundColor Gray
    Write-Host "   Rol: $($response.data.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 1.2 Actualizar Perfil (JSON)
Write-Host "`n1.2 PUT /users/me - Actualizar perfil (JSON)" -ForegroundColor Yellow
$updateBody = @{
    fullName = "Usuario de Prueba $(Get-Date -Format 'HH:mm:ss')"
    bio = "Biografía actualizada desde script de pruebas"
    country = "AR"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me" -Method PUT -Headers $global:headers -Body $updateBody
    Write-Host "✅ Perfil actualizado exitosamente" -ForegroundColor Green
    Write-Host "   Nuevo nombre: $($response.data.fullName)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# PARTE 2: Búsqueda y Marketplace
# ============================================
Write-Host "`n🔍 PARTE 2: Búsqueda y Marketplace" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 2.1 Listar Modelos
Write-Host "`n2.1 GET /users/models - Listar modelos" -ForegroundColor Yellow
try {
    $uri = "http://localhost:3001/api/v1/users/models?verified=true" + [char]38 + "page=1" + [char]38 + "limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
    $models = $response.data.items
    Write-Host "✅ Modelos obtenidos: $($models.Count)" -ForegroundColor Green
    if ($models.Count -gt 0) {
        $script:testModelId = $models[0].userId
        $modelName = $models[0].fullName
        $modelId = $script:testModelId
        Write-Host "   Primer modelo: $modelName (ID: $modelId)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 2.2 Búsqueda Global
Write-Host "`n2.2 GET /users/search - Búsqueda global" -ForegroundColor Yellow
try {
    $uri = "http://localhost:3001/api/v1/users/search?q=test" + [char]38 + "type=all" + [char]38 + "page=1" + [char]38 + "limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
    Write-Host "✅ Búsqueda realizada exitosamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 2.3 Ver Perfil de Modelo
if ($script:testModelId) {
    Write-Host "`n2.3 GET /users/models/:id - Ver perfil de modelo" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)" -Method GET -Headers $global:headers
        Write-Host "✅ Perfil de modelo obtenido" -ForegroundColor Green
        Write-Host "   Nombre: $($response.data.fullName)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# PARTE 3: Funcionalidad de Seguir
# ============================================
Write-Host "`n👥 PARTE 3: Funcionalidad de Seguir" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if ($script:testModelId) {
    # 3.1 Seguir Modelo
    Write-Host "`n3.1 POST /users/models/:modelId/follow - Seguir modelo" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)/follow" -Method POST -Headers $global:headers
        Write-Host "✅ Modelo seguido exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($_.Exception.Message) (puede que ya lo estés siguiendo)" -ForegroundColor Yellow
    }
    
    # 3.2 Ver Modelos Seguidos
    Write-Host "`n3.2 GET /users/me/following - Ver modelos seguidos" -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3001/api/v1/users/me/following?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
        $following = $response.data.items
        Write-Host "✅ Modelos seguidos: $($following.Count)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# PARTE 4: Feed y Contenido
# ============================================
Write-Host "`n📱 PARTE 4: Feed y Contenido" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# 4.1 Obtener Feed
Write-Host "`n4.1 GET /content/feed - Obtener feed personalizado" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/feed?limit=10" -Method GET -Headers $global:headers
    $posts = $response.data.posts
    Write-Host "✅ Feed obtenido: $($posts.Count) posts" -ForegroundColor Green
    if ($posts.Count -gt 0) {
        $script:testPostId = $posts[0].postId
        Write-Host "   Primer post: $($script:testPostId)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# PARTE 5: Interacciones con Contenido
# ============================================
Write-Host "`n❤️  PARTE 5: Interacciones con Contenido" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

if ($script:testPostId) {
    # 5.1 Dar Like
    Write-Host "`n5.1 POST /content/posts/:postId/like - Dar like" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/like" -Method POST -Headers $global:headers
        Write-Host "✅ Like dado exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 5.2 Ver Likes
    Write-Host "`n5.2 GET /content/posts/:postId/likes - Ver likes" -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/likes?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
        Write-Host "✅ Likes obtenidos" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 5.3 Comentar
    Write-Host "`n5.3 POST /content/posts/:postId/comments - Comentar" -ForegroundColor Yellow
    $commentBody = @{
        content = "Excelente post! $(Get-Date -Format 'HH:mm:ss')"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/comments" -Method POST -Headers $global:headers -Body $commentBody
        Write-Host "✅ Comentario creado exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 5.4 Ver Comentarios
    Write-Host "`n5.4 GET /content/posts/:postId/comments - Ver comentarios" -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/comments?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
        Write-Host "✅ Comentarios obtenidos" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 5.5 Ver Packs Comprados
Write-Host "`n5.5 GET /content/packs/purchased - Ver packs comprados" -ForegroundColor Yellow
try {
    $uri = "http://localhost:3005/api/v1/content/packs/purchased?page=1" + [char]38 + "limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
    $packs = $response.data.items
    Write-Host "✅ Packs comprados: $($packs.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# PARTE 6: Historial de Pagos
# ============================================
Write-Host "`n💰 PARTE 6: Historial de Pagos y Suscripciones" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 6.1 Historial de Movimientos
Write-Host "`n6.1 GET /payments/me/movements - Historial de movimientos" -ForegroundColor Yellow
try {
    $uri = "http://localhost:3002/api/v1/payments/me/movements?type=all" + [char]38 + "page=1" + [char]38 + "limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
    $movements = $response.data.items
    Write-Host "✅ Movimientos obtenidos: $($movements.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 6.2 Mis Suscripciones
Write-Host "`n6.2 GET /payments/me/subscriptions - Mis suscripciones" -ForegroundColor Yellow
try {
    $uri = "http://localhost:3002/api/v1/payments/me/subscriptions?status=all" + [char]38 + "page=1" + [char]38 + "limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $global:headers
    $subscriptions = $response.data.items
    Write-Host "✅ Suscripciones obtenidas: $($subscriptions.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 6.3 Estadísticas de Comprador
Write-Host "`n6.3 GET /users/me/buyer-stats - Estadísticas de comprador" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me/buyer-stats" -Method GET -Headers $global:headers
    Write-Host "✅ Estadísticas obtenidas" -ForegroundColor Green
    $stats = $response.data
    Write-Host "   Total gastado: $($stats.totalSpent)" -ForegroundColor Gray
    Write-Host "   Suscripciones activas: $($stats.activeSubscriptions)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# RESUMEN
# ============================================
Write-Host "`n📊 RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "✅ Pruebas completadas" -ForegroundColor Green
Write-Host "`nRevisa los resultados arriba para verificar que todos los endpoints funcionan correctamente." -ForegroundColor White

