# Script para probar endpoints que usan S3
# Endpoints a probar:
# 1. POST /users/me/avatar - Subir avatar
# 2. PUT /users/me - Actualizar perfil con avatar
# 3. POST /content/posts/upload - Subir imagen para post

param(
    [string]$BaseUrl = "http://localhost:3001/api/v1",
    [string]$UserToken = "",
    [string]$ModelToken = ""
)

Write-Host "=== PRUEBAS DE ENDPOINTS S3 ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que tenemos tokens
if (-not $UserToken) {
    Write-Host "[ERROR] Necesitas proporcionar un token de usuario" -ForegroundColor Red
    Write-Host "Uso: .\test-s3-endpoints.ps1 -UserToken 'tu_token' -ModelToken 'token_modelo'" -ForegroundColor Yellow
    exit 1
}

# Crear imagen de prueba temporal
$testImagePath = "$env:TEMP\test-avatar.jpg"
Write-Host "1. Creando imagen de prueba..." -ForegroundColor Yellow
# Crear una imagen simple de 1x1 pixel (JPEG)
$bytes = [System.Convert]::FromBase64String("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A")
[System.IO.File]::WriteAllBytes($testImagePath, $bytes)
Write-Host "  [OK] Imagen de prueba creada: $testImagePath" -ForegroundColor Green

# Test 1: POST /users/me/avatar
Write-Host "`n2. Probando POST /users/me/avatar..." -ForegroundColor Yellow
try {
    $formData = @{
        file = Get-Item $testImagePath
    }
    
    $headers = @{
        "Authorization" = "Bearer $UserToken"
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/users/me/avatar" -Method Post -Headers $headers -Form $formData -ErrorAction Stop
    Write-Host "  [OK] Avatar subido exitosamente" -ForegroundColor Green
    Write-Host "  Avatar URL: $($response.avatarUrl)" -ForegroundColor Cyan
    Write-Host "  Thumbnail URL: $($response.thumbnailUrl)" -ForegroundColor Cyan
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# Test 2: PUT /users/me con avatar
Write-Host "`n3. Probando PUT /users/me con avatar..." -ForegroundColor Yellow
try {
    $formData = @{
        avatar = Get-Item $testImagePath
        fullName = "Test User $(Get-Date -Format 'HHmmss')"
    }
    
    $headers = @{
        "Authorization" = "Bearer $UserToken"
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/users/me" -Method Put -Headers $headers -Form $formData -ErrorAction Stop
    Write-Host "  [OK] Perfil actualizado con avatar" -ForegroundColor Green
    if ($response.avatarUrl) {
        Write-Host "  Avatar URL: $($response.avatarUrl)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# Test 3: POST /content/posts/upload (solo para usuarios con permisos)
if ($ModelToken) {
    Write-Host "`n4. Probando POST /content/posts/upload..." -ForegroundColor Yellow
    try {
        $formData = @{
            image = Get-Item $testImagePath
        }
        
        $headers = @{
            "Authorization" = "Bearer $ModelToken"
        }
        
        $response = Invoke-RestMethod -Uri "$BaseUrl/content/posts/upload" -Method Post -Headers $headers -Form $formData -ErrorAction Stop
        Write-Host "  [OK] Imagen de post subida exitosamente" -ForegroundColor Green
        Write-Host "  Image URL: $($response.data.imageUrl)" -ForegroundColor Cyan
        Write-Host "  Image Key: $($response.data.imageKey)" -ForegroundColor Cyan
    } catch {
        Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "  Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "`n4. Saltando POST /content/posts/upload (no hay token de modelo)" -ForegroundColor Yellow
}

# Limpiar
Remove-Item $testImagePath -ErrorAction SilentlyContinue

Write-Host "`n=== PRUEBAS COMPLETADAS ===" -ForegroundColor Cyan
