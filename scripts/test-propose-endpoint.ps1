# Script para probar el endpoint POST /users/models/{modelId}/propose
# Prueba que solo agencias puedan usar este endpoint

$ErrorActionPreference = "Continue"

# Configuracion
$baseUrl = "http://localhost:3001/api/v1"
$authUrl = "http://localhost:3000/api/v1"

# Colores para output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }

Write-Info "`n=========================================="
Write-Info "PRUEBA: POST /users/models/{modelId}/propose"
Write-Info "==========================================`n"

# Funcion para hacer login
function Get-AuthToken {
    param($email, $password)
    
    Write-Info "Iniciando sesion con: $email"
    
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$authUrl/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $loginBody
        
        if ($response.success) {
            $token = $null
            if ($response.data.token) {
                $token = $response.data.token
            } elseif ($response.data.accessToken) {
                $token = $response.data.accessToken
            } elseif ($response.data.access_token) {
                $token = $response.data.access_token
            }
            
            if ($token) {
                Write-Success "OK - Login exitoso"
                return $token
            } else {
                Write-ErrorMsg "ERROR - Token no encontrado en respuesta"
                return $null
            }
        } else {
            Write-ErrorMsg "ERROR - Error en login: $($response.message)"
            return $null
        }
    } catch {
        Write-ErrorMsg "ERROR - Error al hacer login: $($_.Exception.Message)"
        return $null
    }
}

# Funcion para obtener lista de modelos
function Get-Models {
    param($token)
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$baseUrl/users/models?page=1&limit=5" `
            -Method GET `
            -Headers $headers
        
        if ($response.success -and $response.data) {
            $models = $response.data
            if ($models -is [array]) {
                return $models
            } elseif ($models.items) {
                return $models.items
            } elseif ($models.data) {
                return $models.data
            }
        }
        return @()
    } catch {
        Write-ErrorMsg "Error al obtener modelos: $($_.Exception.Message)"
        return @()
    }
}

# Funcion para probar el endpoint propose
function Test-ProposeEndpoint {
    param($token, $modelId, $userRole, $testName)
    
    Write-Info "`n--- $testName ---"
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        message = "Nos gustaria representarte. Ofrecemos marketing profesional, gestion de contenido y negociacion de contratos."
        terms = "Comision del 20%, exclusividad, marketing incluido, soporte 24/7"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users/models/$modelId/propose" `
            -Method POST `
            -Headers $headers `
            -Body $body
        
        if ($response.success) {
            Write-Success "OK - Propuesta enviada exitosamente"
            Write-Info "  Respuesta: $($response.message)"
            return $true
        } else {
            Write-ErrorMsg "ERROR - La propuesta no fue exitosa"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        if ($_.ErrorDetails.Message) {
            try {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorDetails.error.message) {
                    $errorMessage = $errorDetails.error.message
                }
            } catch {
                # Ignorar error de parsing
            }
        }
        
        if ($statusCode -eq 403) {
            if ($userRole -eq "agency") {
                Write-ErrorMsg "ERROR - Agencia no puede usar el endpoint (esto es un problema!)"
            } else {
                Write-Success "OK - Correctamente rechazado (rol $userRole no puede usar este endpoint)"
            }
        } elseif ($statusCode -eq 404) {
            Write-Warning "WARNING - Modelo no encontrado (puede ser normal si el ID no existe)"
        } else {
            Write-ErrorMsg "ERROR - Status: $statusCode, Mensaje: $errorMessage"
        }
        return $false
    }
}

# ============================================
# PRUEBAS PRINCIPALES
# ============================================

# 1. Login con cuenta AGENCY
Write-Info "`n=========================================="
Write-Info "PASO 1: Login con cuenta AGENCY"
Write-Info "=========================================="

$agencyEmail = "devtech.notification@gmail.com"
$agencyPassword = "Quelindouba2015@"

$agencyToken = Get-AuthToken -email $agencyEmail -password $agencyPassword

if (-not $agencyToken) {
    Write-ErrorMsg "No se pudo obtener token de AGENCY. Abortando pruebas."
    exit 1
}

# 2. Obtener lista de modelos para tener un ID de prueba
Write-Info "`n=========================================="
Write-Info "PASO 2: Obtener lista de modelos"
Write-Info "=========================================="

$models = Get-Models -token $agencyToken

if ($models.Count -eq 0) {
    Write-Warning "No se encontraron modelos. Usando un ID de prueba generico."
    $testModelId = "550e8400-e29b-41d4-a716-446655440000"
} else {
    $testModelId = $models[0].userId
    Write-Success "OK - Modelo encontrado: $($models[0].fullName) (ID: $testModelId)"
}

# 3. Prueba 1: AGENCY puede usar el endpoint
Write-Info "`n=========================================="
Write-Info "PASO 3: Prueba con rol AGENCY"
Write-Info "=========================================="

$test1 = Test-ProposeEndpoint -token $agencyToken -modelId $testModelId -userRole "agency" -testName "Prueba 1: AGENCY puede enviar propuesta"

# 4. Login con cuenta MODEL para probar que NO puede usar el endpoint
Write-Info "`n=========================================="
Write-Info "PASO 4: Login con cuenta MODEL"
Write-Info "=========================================="

$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

$modelToken = Get-AuthToken -email $modelEmail -password $modelPassword

if ($modelToken) {
    # 5. Prueba 2: MODEL NO puede usar el endpoint
    Write-Info "`n=========================================="
    Write-Info "PASO 5: Prueba con rol MODEL (debe fallar)"
    Write-Info "=========================================="
    
    # Usar un ID diferente para evitar conflictos
    $testModelId2 = $testModelId
    if ($models.Count -gt 1) {
        $testModelId2 = $models[1].userId
    }
    
    $test2 = Test-ProposeEndpoint -token $modelToken -modelId $testModelId2 -userRole "model" -testName "Prueba 2: MODEL NO puede enviar propuesta"
} else {
    Write-Warning "No se pudo obtener token de MODEL. Saltando prueba de rechazo."
    $test2 = $false
}

# Resumen final
Write-Info "`n=========================================="
Write-Info "RESUMEN DE PRUEBAS"
Write-Info "=========================================="

if ($test1) {
    Write-Success "OK - Prueba 1: AGENCY puede usar el endpoint"
} else {
    Write-ErrorMsg "ERROR - Prueba 1: AGENCY no pudo usar el endpoint"
}

if (-not $test2) {
    Write-Success "OK - Prueba 2: MODEL correctamente rechazado"
} else {
    Write-ErrorMsg "ERROR - Prueba 2: MODEL pudo usar el endpoint (no deberia ser posible)"
}

Write-Info "`nPruebas completadas.`n"
