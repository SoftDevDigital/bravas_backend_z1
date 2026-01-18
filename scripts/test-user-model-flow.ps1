# Script de Pruebas - Interaccion USER y MODEL
# Ejecuta: .\scripts\test-user-model-flow.ps1

$ErrorActionPreference = "Continue"

Write-Host "`nPRUEBAS DE INTERACCION USER y MODEL" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Variables globales
$script:userToken = $null
$script:userUserId = $null
$script:modelToken = $null
$script:modelUserId = $null
$script:testModelId = $null
$script:testPostId = $null

# PASO 0: LOGIN DE USER
Write-Host "PASO 0: Login de Usuario USER" -ForegroundColor Cyan
Write-Host "============================`n" -ForegroundColor Cyan

Write-Host "0.1 Login como USER..." -ForegroundColor Yellow
$userLoginBody = @{
    email = "alexis.correa026@gmail.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $userLoginBody -ContentType "application/json" -ErrorAction Stop
    $script:userToken = $response.data.accessToken
    $script:userUserId = $response.data.user.userId
    Write-Host "OK - USER logueado exitosamente" -ForegroundColor Green
    Write-Host "   User ID: $($script:userUserId)" -ForegroundColor Gray
    Write-Host "   Rol: $($response.data.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR en login de USER: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$userHeaders = @{
    "Authorization" = "Bearer $script:userToken"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# FLUJO 1: USER BUSCA MODEL
Write-Host "`nFLUJO 1: USER busca y encuentra MODEL" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

Write-Host "1.1 USER busca modelos..." -ForegroundColor Yellow
try {
    $uri = "http://localhost:3001/api/v1/users/models?verified=true" + [char]38 + "page=1" + [char]38 + "limit=20"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $userHeaders -ErrorAction Stop
    $models = $response.data.items
    Write-Host "OK - USER encontro $($models.Count) modelos" -ForegroundColor Green
    
    if ($models.Count -gt 0) {
        $script:testModelId = $models[0].userId
        $modelName = $models[0].fullName
        Write-Host "   Modelo seleccionado: $modelName (ID: $script:testModelId)" -ForegroundColor Gray
    } else {
        Write-Host "ADVERTENCIA - No hay modelos disponibles" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# 1.2 USER ve perfil del MODEL
if ($script:testModelId) {
    Write-Host "`n1.2 USER ve perfil del MODEL..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)" -Method GET -Headers $userHeaders -ErrorAction Stop
        Write-Host "OK - USER puede ver perfil del MODEL" -ForegroundColor Green
        Write-Host "   Nombre: $($response.data.fullName)" -ForegroundColor Gray
        Write-Host "   Verificado: $($response.data.verified)" -ForegroundColor Gray
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# FLUJO 2: USER SIGUE AL MODEL
Write-Host "`nFLUJO 2: USER sigue al MODEL" -ForegroundColor Cyan
Write-Host "============================`n" -ForegroundColor Cyan

if ($script:userToken -and $script:testModelId) {
    Write-Host "2.1 USER sigue al MODEL..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)/follow" -Method POST -Headers $userHeaders -ErrorAction Stop
        Write-Host "OK - USER siguio al MODEL exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "ADVERTENCIA: $($_.Exception.Message) (puede que ya lo sigas)" -ForegroundColor Yellow
    }
    
    Write-Host "`n2.2 USER ve modelos que sigue..." -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3001/api/v1/users/me/following?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $userHeaders -ErrorAction Stop
        $following = $response.data.items
        Write-Host "OK - USER esta siguiendo $($following.Count) modelos" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# FLUJO 3: USER VE FEED DEL MODEL
Write-Host "`nFLUJO 3: USER ve feed del MODEL" -ForegroundColor Cyan
Write-Host "===============================`n" -ForegroundColor Cyan

if ($script:userToken) {
    Write-Host "3.1 USER ve su feed personalizado..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/feed?limit=20" -Method GET -Headers $userHeaders -ErrorAction Stop
        $posts = $response.data.posts
        Write-Host "OK - USER puede ver su feed: $($posts.Count) posts" -ForegroundColor Green
        
        if ($posts.Count -gt 0) {
            $script:testPostId = $posts[0].postId
            $postAuthor = $posts[0].authorName
            Write-Host "   Primer post: ID $script:testPostId de $postAuthor" -ForegroundColor Gray
        } else {
            Write-Host "ADVERTENCIA - Feed vacio (no hay posts de modelos seguidos)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# FLUJO 4: USER INTERACTUA CON CONTENIDO
Write-Host "`nFLUJO 4: USER interactua con contenido del MODEL" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

if ($script:userToken -and $script:testPostId) {
    Write-Host "4.1 USER da LIKE a un post del MODEL..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/like" -Method POST -Headers $userHeaders -ErrorAction Stop
        Write-Host "OK - USER dio LIKE al post" -ForegroundColor Green
    } catch {
        Write-Host "ADVERTENCIA: $($_.Exception.Message) (puede que ya le hayas dado like)" -ForegroundColor Yellow
    }
    
    Write-Host "`n4.2 USER comenta en un post del MODEL..." -ForegroundColor Yellow
    $commentBody = @{
        content = "Excelente post! $(Get-Date -Format 'HH:mm:ss')"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/comments" -Method POST -Headers $userHeaders -Body $commentBody -ErrorAction Stop
        Write-Host "OK - USER comento en el post" -ForegroundColor Green
        Write-Host "   Comentario ID: $($response.data.commentId)" -ForegroundColor Gray
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# FLUJO 5: USER VE ESTADISTICAS
Write-Host "`nFLUJO 5: USER ve estadisticas de comprador" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

if ($script:userToken) {
    Write-Host "5.1 USER ve sus estadisticas de comprador..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me/buyer-stats" -Method GET -Headers $userHeaders -ErrorAction Stop
        Write-Host "OK - USER puede ver sus estadisticas de comprador" -ForegroundColor Green
        $stats = $response.data
        Write-Host "   Total gastado: $($stats.totalSpent)" -ForegroundColor Gray
        Write-Host "   Suscripciones activas: $($stats.activeSubscriptions)" -ForegroundColor Gray
        Write-Host "   Modelos seguidos: $($stats.followingCount)" -ForegroundColor Gray
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# RESUMEN
Write-Host "`nRESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "OK - Flujos de interaccion USER y MODEL probados" -ForegroundColor Green
Write-Host "`nRevisa los resultados arriba para verificar que todas las interacciones funcionan correctamente.`n" -ForegroundColor White
