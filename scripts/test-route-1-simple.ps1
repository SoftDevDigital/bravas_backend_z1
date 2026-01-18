# Script de Prueba: Ruta 1 del User Service
# Prueba GET /users/me

$ErrorActionPreference = "Continue"

Write-Host "Prueba: GET /users/me" -ForegroundColor Cyan
Write-Host "=====================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales MODEL
$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

Write-Host "[INIT] Autenticando como MODEL..." -ForegroundColor Yellow

# Obtener token
try {
    $loginBody = @{
        email = $modelEmail
        password = $modelPassword
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    $token = $loginResponse.data.accessToken
    
    if ($token) {
        Write-Host "[OK] Token obtenido`n" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] No se pudo obtener token`n" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Error al autenticar: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Descripción de la ruta
Write-Host "[DESC] Obtener mi perfil completo" -ForegroundColor Yellow
Write-Host "Obtiene el perfil completo del usuario autenticado, incluyendo informacion basica," -ForegroundColor Gray
Write-Host "perfil extendido, estado de verificacion y configuraciones.`n" -ForegroundColor Gray

# Probar la ruta
Write-Host "[TEST] GET $userServiceUrl/users/me" -ForegroundColor Cyan

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "`n[OK] EXITO (Status: 200)`n" -ForegroundColor Green
    Write-Host "[RESPONSE] RESPUESTA COMPLETA:" -ForegroundColor Cyan
    Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
} catch {
    $statusCode = $null
    $errorBody = $null
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
        } catch {
            $errorBody = $_.Exception.Message
        }
    } else {
        $errorBody = $_.Exception.Message
    }
    
    Write-Host "`n[ERROR] ERROR (Status: $statusCode)`n" -ForegroundColor Red
    Write-Host "[ERROR RESPONSE] RESPUESTA DE ERROR:" -ForegroundColor Red
    Write-Host "`n$($errorBody | ConvertTo-Json -Depth 10)" -ForegroundColor Red
}

Write-Host "`n[FIN] Prueba completada" -ForegroundColor Cyan
