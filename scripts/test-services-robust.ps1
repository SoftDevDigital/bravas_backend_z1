# Script de Pruebas Robusto - USER y MODEL
# Ejecuta: .\scripts\test-services-robust.ps1
# Este script verifica servicios y ejecuta pruebas sin cortarse

$ErrorActionPreference = "Continue"

Write-Host "`n🧪 PRUEBAS DE ENDPOINTS - ROL USER" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Verificar servicios primero
Write-Host "🔍 Verificando servicios...`n" -ForegroundColor Yellow
$servicesOK = $true

# Test Auth Service
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Auth Service (3000): OK" -ForegroundColor Green
} catch {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ Auth Service (3000): OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ Auth Service (3000): NO RESPONDE" -ForegroundColor Red
        $servicesOK = $false
    }
}

# Test User Service
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ User Service (3001): OK" -ForegroundColor Green
} catch {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ User Service (3001): OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ User Service (3001): NO RESPONDE" -ForegroundColor Red
        $servicesOK = $false
    }
}

# Test Content Service
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3005/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Content Service (3005): OK" -ForegroundColor Green
} catch {
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3005/api/v1/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ Content Service (3005): OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ Content Service (3005): NO RESPONDE" -ForegroundColor Red
        $servicesOK = $false
    }
}

if (-not $servicesOK) {
    Write-Host "`n⚠️  ALGUNOS SERVICIOS NO ESTÁN CORRIENDO" -ForegroundColor Yellow
    Write-Host "Por favor, inicia los servicios antes de continuar:`n" -ForegroundColor Yellow
    Write-Host "Terminal 1: npm run start:auth:dev" -ForegroundColor White
    Write-Host "Terminal 2: npm run start:user:dev" -ForegroundColor White
    Write-Host "Terminal 3: npm run start:content:dev`n" -ForegroundColor White
    exit 1
}

Write-Host "`n✅ Todos los servicios están corriendo`n" -ForegroundColor Green

# Paso 1: Login
Write-Host "🔐 Paso 1: Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "alexis.correa026@gmail.com"
    password = "Password123!"
} | ConvertTo-Json

$token = $null
$userId = $null

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResponse.data.accessToken
    $userId = $loginResponse.data.user.userId
    Write-Host "✅ Login exitoso!" -ForegroundColor Green
    Write-Host "   User ID: $userId" -ForegroundColor Gray
    Write-Host "   Rol: $($loginResponse.data.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# PARTE 1: Gestión de Perfil
Write-Host "`n📋 PARTE 1: Gestión de Perfil" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1.1 Obtener Mi Perfil
Write-Host "`n1.1 GET /users/me - Obtener mi perfil" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "✅ Perfil obtenido exitosamente" -ForegroundColor Green
    Write-Host "   Email: $($response.data.email)" -ForegroundColor Gray
    Write-Host "   Nombre: $($response.data.fullName)" -ForegroundColor Gray
    Write-Host "   Rol: $($response.data.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 1.2 Actualizar Perfil
Write-Host "`n1.2 PUT /users/me - Actualizar perfil" -ForegroundColor Yellow
$updateBody = @{
    fullName = "Usuario de Prueba $(Get-Date -Format 'HH:mm:ss')"
    bio = "Biografía actualizada desde script de pruebas"
    country = "AR"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me" -Method PUT -Headers $headers -Body $updateBody -ErrorAction Stop
    Write-Host "✅ Perfil actualizado exitosamente" -ForegroundColor Green
    Write-Host "   Nuevo nombre: $($response.data.fullName)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# PARTE 2: Búsqueda
Write-Host "`n🔍 PARTE 2: Búsqueda y Marketplace" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 2.1 Listar Modelos
Write-Host "`n2.1 GET /users/models - Listar modelos" -ForegroundColor Yellow
$testModelId = $null
try {
    $uri = "http://localhost:3001/api/v1/users/models?verified=true&page=1&limit=10"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
    $models = $response.data.items
    Write-Host "✅ Modelos obtenidos: $($models.Count)" -ForegroundColor Green
    if ($models.Count -gt 0) {
        $testModelId = $models[0].userId
        $modelName = $models[0].fullName
        Write-Host "   Primer modelo: $modelName (ID: $testModelId)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# PARTE 3: Follow
if ($testModelId) {
    Write-Host "`n👥 PARTE 3: Funcionalidad de Seguir" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    
    Write-Host "`n3.1 POST /users/models/$testModelId/follow - Seguir modelo" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$testModelId/follow" -Method POST -Headers $headers -ErrorAction Stop
        Write-Host "✅ Modelo seguido exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($_.Exception.Message) (puede que ya lo estés siguiendo)" -ForegroundColor Yellow
    }
}

# PARTE 4: Feed
Write-Host "`n📱 PARTE 4: Feed y Contenido" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

Write-Host "`n4.1 GET /content/feed - Obtener feed" -ForegroundColor Yellow
$testPostId = $null
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/feed?limit=10" -Method GET -Headers $headers -ErrorAction Stop
    $posts = $response.data.posts
    Write-Host "✅ Feed obtenido: $($posts.Count) posts" -ForegroundColor Green
    if ($posts.Count -gt 0) {
        $testPostId = $posts[0].postId
        Write-Host "   Primer post: $testPostId" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n📊 RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "✅ Pruebas completadas" -ForegroundColor Green
Write-Host "`nRevisa los resultados arriba para verificar que todos los endpoints funcionan correctamente." -ForegroundColor White
