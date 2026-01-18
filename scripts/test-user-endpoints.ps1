# Script de Pruebas para Rol USER (Comprador)
# Este script prueba los endpoints principales para usuarios con rol "user"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost"
)

$ErrorActionPreference = "Stop"

# Colores para output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Headers comunes
$headers = @{
    "Authorization" = "Bearer $Token"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# Función para hacer requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = $headers,
        [object]$Body = $null
    )
    
    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $response
        }
    }
    catch {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{
            Success = $false
            Error = $errorResponse
            StatusCode = $_.Exception.Response.StatusCode.value__
        }
    }
}

Write-Info "🧪 Iniciando pruebas para Rol USER (Comprador)"
Write-Info "Token: $($Token.Substring(0, 20))..."
Write-Info ""

# ============================================
# PARTE 1: Gestión de Perfil
# ============================================
Write-Info "📋 PARTE 1: Gestión de Perfil de Usuario"
Write-Info "=========================================="

# 1.1 Obtener Mi Perfil
Write-Info "`n1.1 GET /users/me - Obtener mi perfil"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/me"
if ($result.Success) {
    Write-Success "✅ Perfil obtenido exitosamente"
    Write-Host "   UserId: $($result.Data.data.userId)" -ForegroundColor Gray
    Write-Host "   Email: $($result.Data.data.email)" -ForegroundColor Gray
    Write-Host "   Nombre: $($result.Data.data.fullName)" -ForegroundColor Gray
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# 1.2 Actualizar Perfil (JSON)
Write-Info "`n1.2 PUT /users/me - Actualizar perfil (JSON)"
$updateBody = @{
    fullName = "Usuario de Prueba $(Get-Date -Format 'HHmmss')"
    bio = "Biografía actualizada desde script de pruebas"
    country = "AR"
}
$result = Invoke-ApiRequest -Method "PUT" -Url "$BaseUrl:3001/api/v1/users/me" -Body $updateBody
if ($result.Success) {
    Write-Success "✅ Perfil actualizado exitosamente"
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# ============================================
# PARTE 2: Búsqueda y Marketplace
# ============================================
Write-Info "`n`n🔍 PARTE 2: Búsqueda y Marketplace"
Write-Info "====================================="

# 2.1 Listar Modelos
Write-Info "`n2.1 GET /users/models - Listar modelos"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/models?verified=true&page=1&limit=10"
if ($result.Success) {
    $models = $result.Data.data.items
    Write-Success "✅ Modelos obtenidos: $($models.Count)"
    if ($models.Count -gt 0) {
        Write-Host "   Primer modelo: $($models[0].fullName)" -ForegroundColor Gray
        $script:testModelId = $models[0].userId
    }
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# 2.2 Búsqueda Global
Write-Info "`n2.2 GET /users/search - Búsqueda global"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/search?q=test&type=all&page=1&limit=10"
if ($result.Success) {
    Write-Success "✅ Búsqueda realizada exitosamente"
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# 2.3 Ver Perfil de Modelo
if ($script:testModelId) {
    Write-Info "`n2.3 GET /users/models/:id - Ver perfil de modelo"
    $result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/models/$($script:testModelId)"
    if ($result.Success) {
        Write-Success "✅ Perfil de modelo obtenido"
    } else {
        Write-Error "❌ Error: $($result.Error.message)"
    }
}

# ============================================
# PARTE 3: Funcionalidad de Seguir
# ============================================
Write-Info "`n`n👥 PARTE 3: Funcionalidad de Seguir"
Write-Info "====================================="

if ($script:testModelId) {
    # 3.1 Seguir Modelo
    Write-Info "`n3.1 POST /users/models/:modelId/follow - Seguir modelo"
    $result = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl:3001/api/v1/users/models/$($script:testModelId)/follow"
    if ($result.Success) {
        Write-Success "✅ Modelo seguido exitosamente"
    } else {
        Write-Warning "⚠️  $($result.Error.message) (puede que ya lo estés siguiendo)"
    }
    
    # 3.2 Ver Modelos Seguidos
    Write-Info "`n3.2 GET /users/me/following - Ver modelos seguidos"
    $result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/me/following?page=1&limit=10"
    if ($result.Success) {
        $following = $result.Data.data.items
        Write-Success "✅ Modelos seguidos: $($following.Count)"
    } else {
        Write-Error "❌ Error: $($result.Error.message)"
    }
    
    # 3.3 Dejar de Seguir
    Write-Info "`n3.3 DELETE /users/models/:modelId/follow - Dejar de seguir"
    $result = Invoke-ApiRequest -Method "DELETE" -Url "$BaseUrl:3001/api/v1/users/models/$($script:testModelId)/follow"
    if ($result.Success) {
        Write-Success "✅ Dejaste de seguir al modelo"
    } else {
        Write-Warning "⚠️  $($result.Error.message)"
    }
}

# ============================================
# PARTE 4: Feed y Contenido
# ============================================
Write-Info "`n`n📱 PARTE 4: Feed y Contenido"
Write-Info "=============================="

# 4.1 Obtener Feed
Write-Info "`n4.1 GET /content/feed - Obtener feed personalizado"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3002/api/v1/content/feed?limit=10"
if ($result.Success) {
    $posts = $result.Data.data.posts
    Write-Success "✅ Feed obtenido: $($posts.Count) posts"
    if ($posts.Count -gt 0) {
        $script:testPostId = $posts[0].postId
        Write-Host "   Primer post: $($posts[0].postId)" -ForegroundColor Gray
    }
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# ============================================
# PARTE 5: Interacciones con Contenido
# ============================================
Write-Info "`n`n❤️  PARTE 5: Interacciones con Contenido"
Write-Info "=========================================="

if ($script:testPostId) {
    # 5.1 Dar Like
    Write-Info "`n5.1 POST /content/posts/:postId/like - Dar like"
    $result = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl:3002/api/v1/content/posts/$($script:testPostId)/like"
    if ($result.Success) {
        Write-Success "✅ Like dado exitosamente"
    } else {
        Write-Warning "⚠️  $($result.Error.message)"
    }
    
    # 5.2 Ver Likes
    Write-Info "`n5.2 GET /content/posts/:postId/likes - Ver likes"
    $result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3002/api/v1/content/posts/$($script:testPostId)/likes?page=1&limit=10"
    if ($result.Success) {
        Write-Success "✅ Likes obtenidos"
    } else {
        Write-Error "❌ Error: $($result.Error.message)"
    }
    
    # 5.3 Comentar
    Write-Info "`n5.3 POST /content/posts/:postId/comments - Comentar"
    $commentBody = @{
        content = "Excelente post! $(Get-Date -Format 'HH:mm:ss')"
    }
    $result = Invoke-ApiRequest -Method "POST" -Url "$BaseUrl:3002/api/v1/content/posts/$($script:testPostId)/comments" -Body $commentBody
    if ($result.Success) {
        Write-Success "✅ Comentario creado exitosamente"
    } else {
        Write-Error "❌ Error: $($result.Error.message)"
    }
    
    # 5.4 Ver Comentarios
    Write-Info "`n5.4 GET /content/posts/:postId/comments - Ver comentarios"
    $result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3002/api/v1/content/posts/$($script:testPostId)/comments?page=1&limit=10"
    if ($result.Success) {
        Write-Success "✅ Comentarios obtenidos"
    } else {
        Write-Error "❌ Error: $($result.Error.message)"
    }
    
    # 5.5 Quitar Like
    Write-Info "`n5.5 DELETE /content/posts/:postId/like - Quitar like"
    $result = Invoke-ApiRequest -Method "DELETE" -Url "$BaseUrl:3002/api/v1/content/posts/$($script:testPostId)/like"
    if ($result.Success) {
        Write-Success "✅ Like eliminado exitosamente"
    } else {
        Write-Warning "⚠️  $($result.Error.message)"
    }
}

# 5.6 Ver Packs Comprados
Write-Info "`n5.6 GET /content/packs/purchased - Ver packs comprados"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3002/api/v1/content/packs/purchased?page=1&limit=10"
if ($result.Success) {
    $packs = $result.Data.data.items
    Write-Success "✅ Packs comprados: $($packs.Count)"
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# ============================================
# PARTE 6: Historial de Pagos
# ============================================
Write-Info "`n`n💰 PARTE 6: Historial de Pagos y Suscripciones"
Write-Info "================================================"

# 6.1 Historial de Movimientos
Write-Info "`n6.1 GET /payments/me/movements - Historial de movimientos"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3003/api/v1/payments/me/movements?type=all&page=1&limit=10"
if ($result.Success) {
    $movements = $result.Data.data.items
    Write-Success "✅ Movimientos obtenidos: $($movements.Count)"
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# 6.2 Mis Suscripciones
Write-Info "`n6.2 GET /payments/me/subscriptions - Mis suscripciones"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3003/api/v1/payments/me/subscriptions?status=all&page=1&limit=10"
if ($result.Success) {
    $subscriptions = $result.Data.data.items
    Write-Success "✅ Suscripciones obtenidas: $($subscriptions.Count)"
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# 6.3 Estadísticas de Comprador
Write-Info "`n6.3 GET /users/me/buyer-stats - Estadísticas de comprador"
$result = Invoke-ApiRequest -Method "GET" -Url "$BaseUrl:3001/api/v1/users/me/buyer-stats"
if ($result.Success) {
    Write-Success "✅ Estadísticas obtenidas"
    $stats = $result.Data.data
    Write-Host "   Total gastado: $($stats.totalSpent)" -ForegroundColor Gray
    Write-Host "   Suscripciones activas: $($stats.activeSubscriptions)" -ForegroundColor Gray
} else {
    Write-Error "❌ Error: $($result.Error.message)"
}

# ============================================
# RESUMEN
# ============================================
Write-Info "`n`n📊 RESUMEN DE PRUEBAS"
Write-Info "======================"
Write-Success "✅ Pruebas completadas"
Write-Info "`nRevisa los resultados arriba para verificar que todos los endpoints funcionan correctamente."




