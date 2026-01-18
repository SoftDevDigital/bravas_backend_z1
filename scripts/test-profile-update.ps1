# Script para probar actualizacion de perfil con avatar y preferences
# Prueba los ultimos ajustes: normalizacion de roles y correccion de errores

$ErrorActionPreference = "Stop"

# Configuracion
$baseUrl = "http://localhost:3001/api/v1"
$authUrl = "http://localhost:3000/api/v1"

# Colores para output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }

Write-Info "`n=========================================="
Write-Info "PRUEBA DE ACTUALIZACION DE PERFIL"
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
        
        # Verificar diferentes formatos de respuesta
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
                Write-Info "Respuesta recibida: $($response | ConvertTo-Json -Depth 3)"
                return $null
            }
        } else {
            Write-ErrorMsg "ERROR - Error en login: $($response.message)"
            Write-Info "Respuesta recibida: $($response | ConvertTo-Json -Depth 3)"
            return $null
        }
    } catch {
        Write-ErrorMsg "ERROR - Error al hacer login: $($_.Exception.Message)"
        if ($_.ErrorDetails.Message) {
            Write-ErrorMsg "  Detalles: $($_.ErrorDetails.Message)"
        }
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-ErrorMsg "  Response body: $responseBody"
            } catch {
                # Ignorar error al leer response
            }
        }
        return $null
    }
}

# Funcion para obtener perfil actual
function Get-UserProfile {
    param($token)
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$baseUrl/users/me" `
            -Method GET `
            -Headers $headers
        
        if ($response.success) {
            return $response.data
        }
        return $null
    } catch {
        Write-ErrorMsg "Error al obtener perfil: $($_.Exception.Message)"
        return $null
    }
}

# Funcion para actualizar perfil con JSON (sin avatar)
function Update-ProfileJSON {
    param($token, $updateData)
    
    Write-Info "`nActualizando perfil con JSON (sin avatar)..."
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $body = $updateData | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri "$baseUrl/users/me" `
            -Method PUT `
            -Headers $headers `
            -Body $body
        
        if ($response.success) {
            Write-Success "OK - Perfil actualizado exitosamente (JSON)"
            Write-Info "  Campos actualizados: $($updateData.Keys -join ', ')"
            return $response.data
        } else {
            Write-ErrorMsg "ERROR - Error al actualizar perfil"
            return $null
        }
    } catch {
        Write-ErrorMsg "ERROR - Error al actualizar perfil: $($_.Exception.Message)"
        if ($_.ErrorDetails.Message) {
            try {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorDetails.error.message) {
                    Write-ErrorMsg "  Mensaje: $($errorDetails.error.message)"
                }
            } catch {
                # Ignorar error de parsing
            }
        }
        return $null
    }
}

# Funcion para probar actualizacion con preferences como objeto
function Test-PreferencesAsObject {
    param($token, $userRole)
    
    Write-Info "`n--- Prueba 1: Preferences como objeto JSON ---"
    
    $preferences = @{
        theme = "dark"
        language = "es"
        notifications = @{
            messages = $true
            contracts = $true
            transfers = $true
            payments = $true
            general = $true
        }
    }
    
    $updateData = @{
        preferences = $preferences
    }
    
    $result = Update-ProfileJSON -token $token -updateData $updateData
    
    if ($result) {
        Write-Success "OK - Preferences actualizadas correctamente como objeto"
        return $true
    }
    return $false
}

# Funcion para probar endpoints especificos por rol
function Test-RoleSpecificEndpoints {
    param($token, $userRole)
    
    Write-Info "`n--- Prueba de endpoints especificos por rol ---"
    
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $tests = @()
    
    if ($userRole -eq "model") {
        Write-Info "Probando endpoints de MODEL..."
        
        # Test 1: GET /users/me/buyers
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/users/me/buyers" `
                -Method GET `
                -Headers $headers
            Write-Success "OK - GET /users/me/buyers - OK"
            $tests += @{ name = "GET /users/me/buyers"; status = "OK" }
        } catch {
            Write-ErrorMsg "ERROR - GET /users/me/buyers - Error: $($_.Exception.Message)"
            $tests += @{ name = "GET /users/me/buyers"; status = "ERROR" }
        }
        
        # Test 2: GET /users/me/stats
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/users/me/stats" `
                -Method GET `
                -Headers $headers
            Write-Success "OK - GET /users/me/stats - OK"
            $tests += @{ name = "GET /users/me/stats"; status = "OK" }
        } catch {
            Write-ErrorMsg "ERROR - GET /users/me/stats - Error: $($_.Exception.Message)"
            $tests += @{ name = "GET /users/me/stats"; status = "ERROR" }
        }
        
    } elseif ($userRole -eq "agency") {
        Write-Info "Probando endpoints de AGENCY..."
        
        # Test 1: GET /users/me/models
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/users/me/models" `
                -Method GET `
                -Headers $headers
            Write-Success "OK - GET /users/me/models - OK"
            $tests += @{ name = "GET /users/me/models"; status = "OK" }
        } catch {
            Write-ErrorMsg "ERROR - GET /users/me/models - Error: $($_.Exception.Message)"
            $tests += @{ name = "GET /users/me/models"; status = "ERROR" }
        }
        
        # Test 2: GET /users/agencies (listar agencias)
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/users/agencies" `
                -Method GET `
                -Headers $headers
            Write-Success "OK - GET /users/agencies - OK"
            $tests += @{ name = "GET /users/agencies"; status = "OK" }
        } catch {
            Write-ErrorMsg "ERROR - GET /users/agencies - Error: $($_.Exception.Message)"
            $tests += @{ name = "GET /users/agencies"; status = "ERROR" }
        }
    }
    
    return $tests
}

# ============================================
# PRUEBAS PRINCIPALES
# ============================================

# 1. Prueba con cuenta MODEL
Write-Info "`n=========================================="
Write-Info "PRUEBA CON CUENTA MODEL"
Write-Info "=========================================="

$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

$modelToken = Get-AuthToken -email $modelEmail -password $modelPassword

if ($modelToken) {
    # Obtener perfil actual
    $modelProfile = Get-UserProfile -token $modelToken
    if ($modelProfile) {
        Write-Success "OK - Perfil obtenido: $($modelProfile.fullName) (Role: $($modelProfile.role))"
    }
    
    # Prueba 1: Preferences como objeto
    Test-PreferencesAsObject -token $modelToken -userRole "model"
    
    # Prueba 2: Endpoints especificos de MODEL
    Test-RoleSpecificEndpoints -token $modelToken -userRole "model"
} else {
    Write-ErrorMsg "No se pudo obtener token de MODEL, saltando pruebas..."
}

# 2. Prueba con cuenta AGENCY
Write-Info "`n=========================================="
Write-Info "PRUEBA CON CUENTA AGENCY"
Write-Info "=========================================="

$agencyEmail = "devtech.notification@gmail.com"
$agencyPassword = "Quelindouba2015@"

$agencyToken = Get-AuthToken -email $agencyEmail -password $agencyPassword

if ($agencyToken) {
    # Obtener perfil actual
    $agencyProfile = Get-UserProfile -token $agencyToken
    if ($agencyProfile) {
        Write-Success "OK - Perfil obtenido: $($agencyProfile.fullName) (Role: $($agencyProfile.role))"
    }
    
    # Prueba 1: Preferences como objeto
    Test-PreferencesAsObject -token $agencyToken -userRole "agency"
    
    # Prueba 2: Endpoints especificos de AGENCY
    Test-RoleSpecificEndpoints -token $agencyToken -userRole "agency"
    
    # Prueba 3: Actualizar perfil de agencia (sin avatar por ahora)
    Write-Info "`n--- Prueba: Actualizar perfil de agencia ---"
    $agencyUpdate = @{
        fullName = "Agencia Test Actualizada"
        bio = "Descripcion de agencia actualizada para pruebas"
    }
    Update-ProfileJSON -token $agencyToken -updateData $agencyUpdate
    
} else {
    Write-ErrorMsg "No se pudo obtener token de AGENCY, saltando pruebas..."
}

# Resumen final
Write-Info "`n=========================================="
Write-Info "RESUMEN DE PRUEBAS"
Write-Info "=========================================="
Write-Success "OK - Pruebas completadas"
Write-Info "`nNota: Para probar la carga de avatar, necesitas:"
Write-Info "  1. Un archivo de imagen valido"
Write-Info "  2. Usar multipart/form-data con el campo 'avatar'"
Write-Info "  3. El campo 'preferences' debe enviarse como string JSON en multipart`n"
