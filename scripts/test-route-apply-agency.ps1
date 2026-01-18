# Script de Prueba: POST /users/agencies/:agencyId/apply
# Prueba la ruta de postulación a agencia para el rol MODEL

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA: POST /users/agencies/:agencyId/apply" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales MODEL
$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

# Variables globales
$script:modelToken = $null
$script:modelId = $null
$script:agencyId = $null

# Funciones de output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }

# ============================================
# INICIALIZACIÓN
# ============================================
Write-Info "Autenticando como MODEL..."

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
    
    $script:modelToken = $loginResponse.data.accessToken
    
    if ($script:modelToken) {
        Write-Success "  Token obtenido correctamente"
        
        # Obtener ID del modelo
        $profile = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
            -Method GET `
            -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
            -ErrorAction Stop
        
        $script:modelId = $profile.data.userId
        Write-Success "  Model ID: $script:modelId"
    } else {
        Write-ErrorMsg "  No se pudo obtener token"
        exit 1
    }
} catch {
    Write-ErrorMsg "  Error al autenticar: $($_.Exception.Message)"
    exit 1
}

# Obtener una agencia para postularse
Write-Info "`nObteniendo lista de agencias..."

try {
    $agenciesResponse = Invoke-RestMethod -Uri "$userServiceUrl/users/agencies?page=1&limit=1" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
        -ErrorAction Stop
    
    if ($agenciesResponse.data -and $agenciesResponse.data.Count -gt 0) {
        $script:agencyId = $agenciesResponse.data[0].userId
        Write-Success "  Agency ID capturado: $script:agencyId"
    } else {
        Write-ErrorMsg "  No se encontraron agencias"
        exit 1
    }
} catch {
    Write-ErrorMsg "  Error al obtener agencias: $($_.Exception.Message)"
    exit 1
}

# ============================================
# PRUEBA: POST /users/agencies/:agencyId/apply
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA: POST /users/agencies/$script:agencyId/apply" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "`n[DESC] Postularse a una agencia - Permite a un modelo enviar una solicitud de postulacion a una agencia para obtener representacion. Solo modelos pueden postularse a agencias." -ForegroundColor Yellow

$url = "$userServiceUrl/users/agencies/$script:agencyId/apply"
$body = @{
    message = "Me interesa formar parte de su agencia. Tengo experiencia en modelaje profesional y estoy buscando representacion seria y profesional."
} | ConvertTo-Json

Write-Info "`n  -> POST $url"
Write-Info "  Body: $body"

try {
    $headers = @{ "Authorization" = "Bearer $script:modelToken" }
    
    $response = Invoke-RestMethod -Uri $url `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 201/200)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ La ruta funciona correctamente!"
} catch {
    $statusCode = $null
    $errorBody = $null
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorText = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            if ($errorText -and $errorText.Trim() -ne "") {
                try {
                    $errorBody = $errorText | ConvertFrom-Json
                } catch {
                    $errorBody = $errorText
                }
            }
        } catch {
            $errorBody = $_.Exception.Message
        }
    } else {
        $errorBody = $_.Exception.Message
    }
    
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode"
    Write-Info "`n  [ERROR RESPONSE]:"
    
    if ($errorBody) {
        if ($errorBody -is [string]) {
            Write-Host $errorBody -ForegroundColor Red
        } else {
            Write-Host ($errorBody | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
    
    Write-ErrorMsg "`n❌ La ruta fallo con error $statusCode"
}
