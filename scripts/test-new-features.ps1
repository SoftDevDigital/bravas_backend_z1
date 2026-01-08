# Script de Prueba de Nuevas Funcionalidades - BRAVAS Backend
# Prueba las funcionalidades implementadas para el rol USER/BUYER
#
# Uso: .\scripts\test-new-features.ps1
# Opciones:
#   -SkipAuth: Salta el proceso de autenticación (usa token existente)
#   -Token: Token JWT a usar (requiere -SkipAuth)
#   -Verbose: Muestra requests y responses detallados

param(
    [switch]$SkipAuth,
    [string]$Token = $null,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host "🧪 Prueba de Nuevas Funcionalidades - BRAVAS Backend" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

# URLs de servicios
$baseUrls = @{
    Auth = "http://localhost:3000/api/v1"
    User = "http://localhost:3001/api/v1"
    Content = "http://localhost:3005/api/v1"
    Payment = "http://localhost:3002/api/v1"
}

# Variables globales
$global:testData = @{
    buyerToken = $null
    buyerUserId = $null
    modelToken = $null
    modelUserId = $null
    modelId = $null
    postId = $null
    packId = $null
}

# Función helper para hacer requests
function Invoke-ApiRequest {
    param(
        [string]$Service,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [switch]$SkipError
    )
    
    $url = "$($baseUrls[$Service])$Endpoint"
    $params = @{
        Uri = $url
        Method = $Method
        Headers = $Headers
        TimeoutSec = 10
        ErrorAction = if ($SkipError) { "Continue" } else { "Stop" }
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
        $params.ContentType = "application/json"
    }
    
    try {
        if ($Verbose) {
            Write-Host "    → $Method $url" -ForegroundColor Gray
            if ($Body) {
                Write-Host "    Body: $($params.Body)" -ForegroundColor Gray
            }
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json
        
        if ($Verbose) {
            Write-Host "    ← Status: $statusCode" -ForegroundColor Gray
            Write-Host "    Response: $($response.Content)" -ForegroundColor Gray
        }
        
        return @{
            Success = $true
            StatusCode = $statusCode
            Data = $content
            Response = $response
        }
    } catch {
        if ($SkipError) {
            $errorMsg = $_.Exception.Message
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $errorMsg += " - Response: $responseBody"
            }
            return @{
                Success = $false
                Error = $errorMsg
            }
        } else {
            Write-Host "    ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "    Response: $responseBody" -ForegroundColor Red
            }
            throw
        }
    }
}

# ============================================
# PASO 1: AUTENTICACIÓN
# ============================================
if (-not $SkipAuth) {
    Write-Host "🔐 PASO 1: Autenticación" -ForegroundColor Cyan
    Write-Host "========================`n" -ForegroundColor Cyan
    
    # 1.1 Registrar/Login como BUYER
    Write-Host "1.1 Autenticando como BUYER..." -ForegroundColor Yellow
    $buyerEmail = "buyer_test_$(Get-Random)@bravas.test"
    $buyerPassword = "Test123!@#"
    
    $registerBody = @{
        email = $buyerEmail
        password = $buyerPassword
        role = "USER"
        birthDate = "1990-01-01"
        country = "AR"
    }
    
    $registerResult = Invoke-ApiRequest -Service "Auth" -Method "POST" -Endpoint "/auth/register" -Body $registerBody -SkipError
    
    if ($registerResult.Success) {
        Write-Host "  ✅ BUYER registrado: $buyerEmail" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Registro falló, intentando login..." -ForegroundColor Yellow
    }
    
    # Login
    $loginBody = @{
        email = $buyerEmail
        password = $buyerPassword
    }
    
    $loginResult = Invoke-ApiRequest -Service "Auth" -Method "POST" -Endpoint "/auth/login" -Body $loginBody -SkipError
    
    if ($loginResult.Success -and $loginResult.Data.data.accessToken) {
        $global:testData.buyerToken = $loginResult.Data.data.accessToken
        $global:testData.buyerUserId = $loginResult.Data.data.userId
        Write-Host "  ✅ BUYER autenticado" -ForegroundColor Green
    } else {
        Write-Host "  ❌ No se pudo autenticar BUYER" -ForegroundColor Red
        Write-Host "  Error: $($loginResult.Error)" -ForegroundColor Red
        exit 1
    }
    
    # 1.2 Registrar/Login como MODEL (para seguir)
    Write-Host "`n1.2 Autenticando como MODEL..." -ForegroundColor Yellow
    $modelEmail = "model_test_$(Get-Random)@bravas.test"
    $modelPassword = "Test123!@#"
    
    $modelRegisterBody = @{
        email = $modelEmail
        password = $modelPassword
        role = "MODEL"
        birthDate = "1995-01-01"
        country = "AR"
    }
    
    $modelRegisterResult = Invoke-ApiRequest -Service "Auth" -Method "POST" -Endpoint "/auth/register" -Body $modelRegisterBody -SkipError
    
    if (-not $modelRegisterResult.Success) {
        Write-Host "  ⚠️  Registro falló, intentando login..." -ForegroundColor Yellow
    }
    
    $modelLoginBody = @{
        email = $modelEmail
        password = $modelPassword
    }
    
    $modelLoginResult = Invoke-ApiRequest -Service "Auth" -Method "POST" -Endpoint "/auth/login" -Body $modelLoginBody -SkipError
    
    if ($modelLoginResult.Success -and $modelLoginResult.Data.data.accessToken) {
        $global:testData.modelToken = $modelLoginResult.Data.data.accessToken
        $global:testData.modelUserId = $modelLoginResult.Data.data.userId
        $global:testData.modelId = $modelLoginResult.Data.data.userId
        Write-Host "  ✅ MODEL autenticado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  No se pudo autenticar MODEL (continuando sin modelo)" -ForegroundColor Yellow
    }
    
    Write-Host ""
} else {
    if ($Token) {
        $global:testData.buyerToken = $Token
        Write-Host "✅ Usando token proporcionado`n" -ForegroundColor Green
    } else {
        Write-Host "❌ Se requiere token cuando se usa -SkipAuth`n" -ForegroundColor Red
        exit 1
    }
}

# ============================================
# PASO 2: SISTEMA DE FOLLOW/UNFOLLOW
# ============================================
Write-Host "👥 PASO 2: Sistema de Follow/Unfollow" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    if ($global:testData.modelId) {
        # 2.1 Seguir modelo
        Write-Host "2.1 Siguiendo modelo..." -ForegroundColor Yellow
        $followBody = @{
            modelId = $global:testData.modelId
        }
        
        $followResult = Invoke-ApiRequest -Service "User" -Method "POST" -Endpoint "/users/follow" -Headers $buyerHeaders -Body $followBody -SkipError
        
        if ($followResult.Success) {
            Write-Host "  ✅ Modelo seguido correctamente" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Error al seguir: $($followResult.Error)" -ForegroundColor Yellow
        }
        
        # 2.2 Listar seguidos
        Write-Host "`n2.2 Listando modelos seguidos..." -ForegroundColor Yellow
        $followingResult = Invoke-ApiRequest -Service "User" -Method "GET" -Endpoint "/users/me/following" -Headers $buyerHeaders -SkipError
        
        if ($followingResult.Success) {
            $count = $followingResult.Data.data?.length ?? 0
            Write-Host "  ✅ Siguiendo $count modelo(s)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Error al listar seguidos: $($followingResult.Error)" -ForegroundColor Yellow
        }
        
        # 2.3 Dejar de seguir
        Write-Host "`n2.3 Dejando de seguir modelo..." -ForegroundColor Yellow
        $unfollowBody = @{
            modelId = $global:testData.modelId
        }
        
        $unfollowResult = Invoke-ApiRequest -Service "User" -Method "DELETE" -Endpoint "/users/unfollow" -Headers $buyerHeaders -Body $unfollowBody -SkipError
        
        if ($unfollowResult.Success) {
            Write-Host "  ✅ Dejado de seguir correctamente" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Error al dejar de seguir: $($unfollowResult.Error)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  No hay modelo disponible para seguir" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 3: FEED PERSONALIZADO
# ============================================
Write-Host "📰 PASO 3: Feed Personalizado" -ForegroundColor Cyan
Write-Host "=============================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    Write-Host "3.1 Obteniendo feed personalizado..." -ForegroundColor Yellow
    $feedResult = Invoke-ApiRequest -Service "Content" -Method "GET" -Endpoint "/content/feed?limit=10" -Headers $buyerHeaders -SkipError
    
    if ($feedResult.Success) {
        $posts = $feedResult.Data.data?.posts ?? @()
        Write-Host "  ✅ Feed obtenido: $($posts.Count) posts" -ForegroundColor Green
        if ($posts.Count -gt 0) {
            $global:testData.postId = $posts[0].id
            Write-Host "  📌 Post ID para pruebas: $($global:testData.postId)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️  Error al obtener feed: $($feedResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 4: SISTEMA DE LIKES
# ============================================
Write-Host "❤️  PASO 4: Sistema de Likes" -ForegroundColor Cyan
Write-Host "==========================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} elseif (-not $global:testData.postId) {
    Write-Host "  ⚠️  No hay post disponible para dar like" -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    # 4.1 Dar like
    Write-Host "4.1 Dando like al post..." -ForegroundColor Yellow
    $likeResult = Invoke-ApiRequest -Service "Content" -Method "POST" -Endpoint "/content/posts/$($global:testData.postId)/like" -Headers $buyerHeaders -SkipError
    
    if ($likeResult.Success) {
        Write-Host "  ✅ Like agregado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al dar like: $($likeResult.Error)" -ForegroundColor Yellow
    }
    
    # 4.2 Listar likes
    Write-Host "`n4.2 Listando likes del post..." -ForegroundColor Yellow
    $likesResult = Invoke-ApiRequest -Service "Content" -Method "GET" -Endpoint "/content/posts/$($global:testData.postId)/likes" -Headers $buyerHeaders -SkipError
    
    if ($likesResult.Success) {
        $likes = $likesResult.Data.data?.likes ?? @()
        Write-Host "  ✅ Likes obtenidos: $($likes.Count)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al listar likes: $($likesResult.Error)" -ForegroundColor Yellow
    }
    
    # 4.3 Quitar like
    Write-Host "`n4.3 Quitando like del post..." -ForegroundColor Yellow
    $unlikeResult = Invoke-ApiRequest -Service "Content" -Method "DELETE" -Endpoint "/content/posts/$($global:testData.postId)/like" -Headers $buyerHeaders -SkipError
    
    if ($unlikeResult.Success) {
        Write-Host "  ✅ Like removido" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al quitar like: $($unlikeResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 5: SISTEMA DE COMENTARIOS
# ============================================
Write-Host "💬 PASO 5: Sistema de Comentarios" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} elseif (-not $global:testData.postId) {
    Write-Host "  ⚠️  No hay post disponible para comentar" -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    # 5.1 Crear comentario
    Write-Host "5.1 Creando comentario..." -ForegroundColor Yellow
    $commentBody = @{
        content = "¡Excelente post! Me encantó 😍"
    }
    
    $commentResult = Invoke-ApiRequest -Service "Content" -Method "POST" -Endpoint "/content/posts/$($global:testData.postId)/comments" -Headers $buyerHeaders -Body $commentBody -SkipError
    
    if ($commentResult.Success) {
        Write-Host "  ✅ Comentario creado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al crear comentario: $($commentResult.Error)" -ForegroundColor Yellow
    }
    
    # 5.2 Listar comentarios
    Write-Host "`n5.2 Listando comentarios del post..." -ForegroundColor Yellow
    $commentsResult = Invoke-ApiRequest -Service "Content" -Method "GET" -Endpoint "/content/posts/$($global:testData.postId)/comments" -Headers $buyerHeaders -SkipError
    
    if ($commentsResult.Success) {
        $comments = $commentsResult.Data.data?.comments ?? @()
        Write-Host "  ✅ Comentarios obtenidos: $($comments.Count)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al listar comentarios: $($commentsResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 6: BÚSQUEDA GLOBAL
# ============================================
Write-Host "🔍 PASO 6: Búsqueda Global" -ForegroundColor Cyan
Write-Host "=========================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    Write-Host "6.1 Buscando 'test'..." -ForegroundColor Yellow
    $searchResult = Invoke-ApiRequest -Service "User" -Method "GET" -Endpoint "/users/search?q=test&limit=10" -Headers $buyerHeaders -SkipError
    
    if ($searchResult.Success) {
        $results = $searchResult.Data.data?.results ?? @()
        Write-Host "  ✅ Búsqueda completada: $($results.Count) resultados" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error en búsqueda: $($searchResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 7: ESTADÍSTICAS DEL BUYER
# ============================================
Write-Host "📊 PASO 7: Estadísticas del Buyer" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    Write-Host "7.1 Obteniendo estadísticas..." -ForegroundColor Yellow
    $statsResult = Invoke-ApiRequest -Service "User" -Method "GET" -Endpoint "/users/me/stats/buyer" -Headers $buyerHeaders -SkipError
    
    if ($statsResult.Success) {
        $stats = $statsResult.Data.data
        Write-Host "  ✅ Estadísticas obtenidas:" -ForegroundColor Green
        Write-Host "     - Total gastado: $($stats.totalSpent ?? 0)" -ForegroundColor Gray
        Write-Host "     - Packs comprados: $($stats.packsPurchased ?? 0)" -ForegroundColor Gray
        Write-Host "     - Modelos seguidos: $($stats.modelsFollowed ?? 0)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  Error al obtener estadísticas: $($statsResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 8: HISTORIAL DE MOVIMIENTOS
# ============================================
Write-Host "💰 PASO 8: Historial de Movimientos" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    Write-Host "8.1 Obteniendo movimientos..." -ForegroundColor Yellow
    $movementsResult = Invoke-ApiRequest -Service "Payment" -Method "GET" -Endpoint "/payments/me/movements" -Headers $buyerHeaders -SkipError
    
    if ($movementsResult.Success) {
        $movements = $movementsResult.Data.data?.movements ?? @()
        Write-Host "  ✅ Movimientos obtenidos: $($movements.Count)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al obtener movimientos: $($movementsResult.Error)" -ForegroundColor Yellow
    }
    
    Write-Host "`n8.2 Obteniendo suscripciones activas..." -ForegroundColor Yellow
    $subscriptionsResult = Invoke-ApiRequest -Service "Payment" -Method "GET" -Endpoint "/payments/me/subscriptions" -Headers $buyerHeaders -SkipError
    
    if ($subscriptionsResult.Success) {
        $subscriptions = $subscriptionsResult.Data.data?.subscriptions ?? @()
        Write-Host "  ✅ Suscripciones obtenidas: $($subscriptions.Count)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al obtener suscripciones: $($subscriptionsResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# PASO 9: PACKS COMPRADOS
# ============================================
Write-Host "📦 PASO 9: Packs Comprados" -ForegroundColor Cyan
Write-Host "=========================`n" -ForegroundColor Cyan

if (-not $global:testData.buyerToken) {
    Write-Host "  ⚠️  Se requiere autenticación. Saltando..." -ForegroundColor Yellow
} else {
    $buyerHeaders = @{
        "Authorization" = "Bearer $($global:testData.buyerToken)"
    }
    
    Write-Host "9.1 Listando packs comprados..." -ForegroundColor Yellow
    $packsResult = Invoke-ApiRequest -Service "Content" -Method "GET" -Endpoint "/content/packs/purchased" -Headers $buyerHeaders -SkipError
    
    if ($packsResult.Success) {
        $packs = $packsResult.Data.data?.packs ?? @()
        Write-Host "  ✅ Packs obtenidos: $($packs.Count)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Error al obtener packs: $($packsResult.Error)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Pruebas completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Resumen:" -ForegroundColor Cyan
Write-Host "  - Follow/Unfollow: Probado" -ForegroundColor Gray
Write-Host "  - Feed personalizado: Probado" -ForegroundColor Gray
Write-Host "  - Sistema de Likes: Probado" -ForegroundColor Gray
Write-Host "  - Sistema de Comentarios: Probado" -ForegroundColor Gray
Write-Host "  - Búsqueda global: Probado" -ForegroundColor Gray
Write-Host "  - Estadísticas buyer: Probado" -ForegroundColor Gray
Write-Host "  - Historial de movimientos: Probado" -ForegroundColor Gray
Write-Host "  - Packs comprados: Probado" -ForegroundColor Gray
Write-Host ""



