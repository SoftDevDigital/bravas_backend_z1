# Script de Prueba: Follow/Following para AGENCY
# Prueba las rutas de follow que ahora AGENCY puede usar

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA: Follow/Following para AGENCY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales AGENCY
$agencyEmail = "devtech.notification@gmail.com"
$agencyPassword = "Quelindouba2015@"

# Variables globales
$script:agencyToken = $null
$script:agencyId = $null
$script:testModelId = $null

# Funciones de output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }

# ============================================
# INICIALIZACIÓN
# ============================================
Write-Info "Autenticando como AGENCY..."

try {
    $loginBody = @{
        email = $agencyEmail
        password = $agencyPassword
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    $script:agencyToken = $loginResponse.data.accessToken
    
    if ($script:agencyToken) {
        Write-Success "  Token obtenido correctamente"
        
        # Obtener ID de la agencia
        $profile = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
            -Method GET `
            -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
            -ErrorAction Stop
        
        $script:agencyId = $profile.data.userId
        Write-Success "  Agency ID: $script:agencyId"
    }
} catch {
    Write-ErrorMsg "  Error al autenticar: $($_.Exception.Message)"
    exit 1
}

# Obtener un modelo para seguir
Write-Info "`nObteniendo lista de modelos..."

try {
    $modelsResponse = Invoke-RestMethod -Uri "$userServiceUrl/users/models?page=1&limit=1" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -ErrorAction Stop
    
    if ($modelsResponse.data -and $modelsResponse.data.Count -gt 0) {
        $script:testModelId = $modelsResponse.data[0].userId
        Write-Success "  Model ID capturado: $script:testModelId"
    }
} catch {
    Write-ErrorMsg "  Error al obtener modelos: $($_.Exception.Message)"
    exit 1
}

# ============================================
# PRUEBA: POST /users/models/:modelId/follow
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA: POST /users/models/$script:testModelId/follow" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta

$url = "$userServiceUrl/users/models/$script:testModelId/follow"

Write-Info "`n  -> POST $url"

try {
    $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
    
    $response = Invoke-RestMethod -Uri $url `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 200)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ AGENCY puede seguir modelos correctamente!"
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode"
    Write-ErrorMsg "`n❌ AGENCY NO puede seguir modelos"
}

# ============================================
# PRUEBA: GET /users/me/following
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA: GET /users/me/following" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta

$url = "$userServiceUrl/users/me/following?page=1&limit=10"

Write-Info "`n  -> GET $url"

try {
    $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
    
    $response = Invoke-RestMethod -Uri $url `
        -Method GET `
        -Headers $headers `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 200)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ AGENCY puede listar siguiendo correctamente!"
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode"
    Write-ErrorMsg "`n❌ AGENCY NO puede listar siguiendo"
}
