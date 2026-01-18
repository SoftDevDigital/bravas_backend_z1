# Script de Prueba: Rutas de Follow para AGENCY (Individual)
# Prueba una por una las rutas que no funcionan

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA INDIVIDUAL: Follow/Following para AGENCY" -ForegroundColor Cyan
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
# RUTA 1: POST /users/models/:modelId/follow
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA 1: POST /users/models/$script:testModelId/follow" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "`n[DESC] Seguir a un modelo - Permite a una agencia seguir a un modelo/usuario/agencia. AGENCY puede seguir MODEL, USER y AGENCY." -ForegroundColor Yellow

$url1 = "$userServiceUrl/users/models/$script:testModelId/follow"

Write-Info "`n  -> POST $url1"
Write-Info "  Method: POST"
Write-Info "  Headers: Authorization: Bearer [TOKEN]"

try {
    $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
    
    $response1 = Invoke-RestMethod -Uri $url1 `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 200/201)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response1 | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ RUTA 1 FUNCIONA CORRECTAMENTE!"
} catch {
    $statusCode1 = $null
    $errorBody1 = $null
    
    if ($_.Exception.Response) {
        $statusCode1 = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorText = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            if ($errorText -and $errorText.Trim() -ne "") {
                try {
                    $errorBody1 = $errorText | ConvertFrom-Json
                } catch {
                    $errorBody1 = $errorText
                }
            }
        } catch {
            $errorBody1 = $_.Exception.Message
        }
    } else {
        $errorBody1 = $_.Exception.Message
    }
    
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode1"
    Write-Info "`n  [ERROR RESPONSE] DETALLADO:"
    
    if ($errorBody1) {
        if ($errorBody1 -is [string]) {
            Write-Host $errorBody1 -ForegroundColor Red
        } else {
            Write-Host ($errorBody1 | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
    
    Write-ErrorMsg "`n❌ RUTA 1 FALLA - Status: $statusCode1"
}

# ============================================
# RUTA 2: GET /users/me/following
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA 2: GET /users/me/following" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "`n[DESC] Listar usuarios que sigo - Obtiene la lista de usuarios que la agencia autenticada esta siguiendo. AGENCY puede seguir MODEL, USER y AGENCY." -ForegroundColor Yellow

$url2 = "$userServiceUrl/users/me/following?page=1&limit=10"

Write-Info "`n  -> GET $url2"
Write-Info "  Method: GET"
Write-Info "  Headers: Authorization: Bearer [TOKEN]"

try {
    $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
    
    $response2 = Invoke-RestMethod -Uri $url2 `
        -Method GET `
        -Headers $headers `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 200)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response2 | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ RUTA 2 FUNCIONA CORRECTAMENTE!"
} catch {
    $statusCode2 = $null
    $errorBody2 = $null
    
    if ($_.Exception.Response) {
        $statusCode2 = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorText = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            if ($errorText -and $errorText.Trim() -ne "") {
                try {
                    $errorBody2 = $errorText | ConvertFrom-Json
                } catch {
                    $errorBody2 = $errorText
                }
            }
        } catch {
            $errorBody2 = $_.Exception.Message
        }
    } else {
        $errorBody2 = $_.Exception.Message
    }
    
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode2"
    Write-Info "`n  [ERROR RESPONSE] DETALLADO:"
    
    if ($errorBody2) {
        if ($errorBody2 -is [string]) {
            Write-Host $errorBody2 -ForegroundColor Red
        } else {
            Write-Host ($errorBody2 | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
    
    Write-ErrorMsg "`n❌ RUTA 2 FALLA - Status: $statusCode2"
}

# ============================================
# RUTA 3: DELETE /users/models/:modelId/follow
# ============================================
Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "RUTA 3: DELETE /users/models/$script:testModelId/follow" -ForegroundColor Magenta
Write-Host ("="*70) -ForegroundColor Magenta
Write-Host "`n[DESC] Dejar de seguir a un modelo - Permite a una agencia dejar de seguir a otro modelo/usuario/agencia que estaba siguiendo." -ForegroundColor Yellow

$url3 = "$userServiceUrl/users/models/$script:testModelId/follow"

Write-Info "`n  -> DELETE $url3"
Write-Info "  Method: DELETE"
Write-Info "  Headers: Authorization: Bearer [TOKEN]"

try {
    $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
    
    $response3 = Invoke-RestMethod -Uri $url3 `
        -Method DELETE `
        -Headers $headers `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Success "`n  [OK] EXITO (Status: 200)"
    Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
    Write-Host "`n$($response3 | ConvertTo-Json -Depth 10)" -ForegroundColor White
    
    Write-Success "`n✅ RUTA 3 FUNCIONA CORRECTAMENTE!"
} catch {
    $statusCode3 = $null
    $errorBody3 = $null
    
    if ($_.Exception.Response) {
        $statusCode3 = $_.Exception.Response.StatusCode.value__
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorText = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            if ($errorText -and $errorText.Trim() -ne "") {
                try {
                    $errorBody3 = $errorText | ConvertFrom-Json
                } catch {
                    $errorBody3 = $errorText
                }
            }
        } catch {
            $errorBody3 = $_.Exception.Message
        }
    } else {
        $errorBody3 = $_.Exception.Message
    }
    
    Write-ErrorMsg "`n  [ERROR] Status: $statusCode3"
    Write-Info "`n  [ERROR RESPONSE] DETALLADO:"
    
    if ($errorBody3) {
        if ($errorBody3 -is [string]) {
            Write-Host $errorBody3 -ForegroundColor Red
        } else {
            Write-Host ($errorBody3 | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
    
    Write-ErrorMsg "`n❌ RUTA 3 FALLA - Status: $statusCode3"
}

Write-Host "`n" -NoNewline
Write-Host ("="*70) -ForegroundColor Cyan
Write-Host "PRUEBAS INDIVIDUALES COMPLETADAS" -ForegroundColor Cyan
Write-Host ("="*70) -ForegroundColor Cyan
Write-Host "`n"
