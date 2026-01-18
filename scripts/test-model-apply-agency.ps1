# Script de Prueba: MODEL aplica a AGENCY
# Prueba el endpoint POST /users/agencies/:agencyId/apply
# 
# Uso: .\scripts\test-model-apply-agency.ps1
# Opciones:
#   -ModelEmail: Email del modelo (opcional, por defecto crea uno nuevo)
#   -ModelPassword: Password del modelo (opcional)
#   -AgencyEmail: Email de la agencia (opcional, por defecto usa la existente)
#   -AgencyPassword: Password de la agencia (opcional)
#   -Verbose: Muestra requests y responses detallados

param(
    [string]$ModelEmail = $null,
    [string]$ModelPassword = "Test123!@#",
    [string]$AgencyEmail = $null,
    [string]$AgencyPassword = $null,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host "🧪 Prueba: MODEL aplica a AGENCY" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# URLs de servicios
$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Variables globales
$script:modelToken = $null
$script:modelId = $null
$script:agencyToken = $null
$script:agencyId = $null

# Colores para output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n$('='*60)`n$msg`n$('='*60)" -ForegroundColor Magenta }

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
    
    $url = "$Service$Endpoint"
    $params = @{
        Uri = $url
        Method = $Method
        Headers = $Headers
        TimeoutSec = 10
        ErrorAction = if ($SkipError) { "Continue" } else { "Stop" }
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
        if (-not $Headers.ContainsKey("Content-Type")) {
            $params.Headers["Content-Type"] = "application/json"
        }
    }
    
    try {
        if ($Verbose) {
            Write-Info "    → $Method $url"
            if ($Body) {
                Write-Info "    Body: $($params.Body)"
            }
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json
        
        if ($Verbose) {
            Write-Info "    ← Status: $statusCode"
            Write-Info "    Response: $($response.Content)"
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
            $statusCode = $null
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $errorMsg += " - Response: $responseBody"
            }
            return @{
                Success = $false
                StatusCode = $statusCode
                Error = $errorMsg
            }
        } else {
            Write-ErrorMsg "    ❌ Error: $($_.Exception.Message)"
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-ErrorMsg "    Response: $responseBody"
            }
            throw
        }
    }
}

# Función para obtener token de autenticación
function Get-AuthToken {
    param($email, $password)
    
    try {
        $loginBody = @{
            email = $email
            password = $password
        }
        
        $result = Invoke-ApiRequest -Service $authServiceUrl -Method "POST" -Endpoint "/auth/login" -Body $loginBody -SkipError
        
        if ($result.Success -and $result.Data.data.accessToken) {
            return $result.Data.data.accessToken
        }
        return $null
    } catch {
        Write-ErrorMsg "  ❌ Error al obtener token: $($_.Exception.Message)"
        return $null
    }
}

# Función para registrar usuario
function Register-User {
    param($email, $password, $role, $birthDate = "1990-01-01", $country = "AR")
    
    try {
        $registerBody = @{
            email = $email
            password = $password
            role = $role
            birthDate = $birthDate
            country = $country
        }
        
        $result = Invoke-ApiRequest -Service $authServiceUrl -Method "POST" -Endpoint "/auth/register" -Body $registerBody -SkipError
        
        if ($result.Success) {
            Write-Success "  ✅ Usuario registrado: $email"
            return $true
        } else {
            Write-Warning "  ⚠️ Registro falló (puede que el usuario ya exista): $($result.Error)"
            return $false
        }
    } catch {
        Write-ErrorMsg "  ❌ Error al registrar: $($_.Exception.Message)"
        return $false
    }
}

# ============================================
# PASO 1: AUTENTICACIÓN
# ============================================

Write-Header "PASO 1: AUTENTICACIÓN"

# 1.1 Preparar o autenticar MODEL
Write-Info "`n1.1 Autenticando como MODEL..."

if ($ModelEmail) {
    Write-Info "  Usando email proporcionado: $ModelEmail"
    $script:modelToken = Get-AuthToken -email $ModelEmail -password $ModelPassword
    
    if (-not $script:modelToken) {
        Write-Warning "  ⚠️ No se pudo autenticar con las credenciales proporcionadas"
        Write-Info "  Intentando registrar usuario..."
        Register-User -email $ModelEmail -password $ModelPassword -role "MODEL"
        $script:modelToken = Get-AuthToken -email $ModelEmail -password $ModelPassword
    }
} else {
    Write-Info "  Creando nuevo usuario MODEL..."
    $modelEmailTest = "model_test_$(Get-Random)_@bravas.test"
    Register-User -email $modelEmailTest -password $ModelPassword -role "MODEL"
    $script:modelToken = Get-AuthToken -email $modelEmailTest -password $ModelPassword
    $ModelEmail = $modelEmailTest
}

if (-not $script:modelToken) {
    Write-ErrorMsg "`n❌ No se pudo autenticar como MODEL. Abortando pruebas."
    exit 1
}

Write-Success "  ✅ MODEL autenticado: $ModelEmail"

# Obtener ID del modelo
Write-Info "  Obteniendo ID del modelo..."
$profileResult = Invoke-ApiRequest -Service $userServiceUrl -Method "GET" -Endpoint "/users/me" -Headers @{ "Authorization" = "Bearer $script:modelToken" } -SkipError
if ($profileResult.Success) {
    $script:modelId = $profileResult.Data.data.userId
    Write-Success "  ✅ Model ID: $script:modelId"
} else {
    Write-ErrorMsg "  ❌ No se pudo obtener el perfil del modelo"
    exit 1
}

# 1.2 Preparar o autenticar AGENCY
Write-Info "`n1.2 Autenticando como AGENCY..."

if ($AgencyEmail) {
    Write-Info "  Usando email proporcionado: $AgencyEmail"
    $agencyPasswordToUse = if ($AgencyPassword) { $AgencyPassword } else { $ModelPassword }
    $script:agencyToken = Get-AuthToken -email $AgencyEmail -password $agencyPasswordToUse
    
    if (-not $script:agencyToken) {
        Write-Warning "  ⚠️ No se pudo autenticar con las credenciales proporcionadas"
        Write-Info "  Intentando registrar usuario..."
        Register-User -email $AgencyEmail -password $agencyPasswordToUse -role "AGENCY"
        $script:agencyToken = Get-AuthToken -email $AgencyEmail -password $agencyPasswordToUse
    }
} else {
    # Intentar con credenciales por defecto del proyecto
    Write-Info "  Intentando con credenciales por defecto..."
    $defaultAgencyEmail = "devtech.notification@gmail.com"
    $defaultAgencyPassword = "Quelindouba2015@"
    $script:agencyToken = Get-AuthToken -email $defaultAgencyEmail -password $defaultAgencyPassword
    
    if (-not $script:agencyToken) {
        Write-Info "  Creando nueva agencia..."
        $agencyEmailTest = "agency_test_$(Get-Random)_@bravas.test"
        Register-User -email $agencyEmailTest -password $ModelPassword -role "AGENCY"
        $script:agencyToken = Get-AuthToken -email $agencyEmailTest -password $ModelPassword
        $AgencyEmail = $agencyEmailTest
    } else {
        $AgencyEmail = $defaultAgencyEmail
    }
}

if (-not $script:agencyToken) {
    Write-ErrorMsg "`n❌ No se pudo autenticar como AGENCY. Abortando pruebas."
    exit 1
}

Write-Success "  ✅ AGENCY autenticada: $AgencyEmail"

# Obtener ID de la agencia
Write-Info "  Obteniendo ID de la agencia..."
$agencyProfileResult = Invoke-ApiRequest -Service $userServiceUrl -Method "GET" -Endpoint "/users/me" -Headers @{ "Authorization" = "Bearer $script:agencyToken" } -SkipError
if ($agencyProfileResult.Success) {
    $script:agencyId = $agencyProfileResult.Data.data.userId
    Write-Success "  ✅ Agency ID: $script:agencyId"
} else {
    Write-ErrorMsg "  ❌ No se pudo obtener el perfil de la agencia"
    exit 1
}

# ============================================
# PASO 2: PROBAR ENDPOINT DE APLICACIÓN
# ============================================

Write-Header "PASO 2: PROBAR ENDPOINT DE APLICACIÓN"

# 2.1 POST /users/agencies/:agencyId/apply - MODEL se postula a AGENCY
Write-Info "`n2.1 POST /users/agencies/$script:agencyId/apply (MODEL aplica a AGENCY)"

$applyBody = @{
    message = "Me interesa formar parte de su agencia. Tengo experiencia en modelaje profesional y estoy buscando representación seria y profesional. Tengo portfolio completo y referencias disponibles."
}

$modelHeaders = @{
    "Authorization" = "Bearer $script:modelToken"
}

Write-Info "  Enviando postulación..."
Write-Info "  Mensaje: $($applyBody.message)"

$applyResult = Invoke-ApiRequest -Service $userServiceUrl -Method "POST" -Endpoint "/users/agencies/$script:agencyId/apply" -Headers $modelHeaders -Body $applyBody -SkipError

if ($applyResult.Success) {
    Write-Success "  ✅ Postulación enviada exitosamente"
    if ($applyResult.Data.message) {
        Write-Info "    Mensaje: $($applyResult.Data.message)"
    }
    if ($applyResult.Data.success) {
        Write-Info "    Success: $($applyResult.Data.success)"
    }
} else {
    $statusCode = $applyResult.StatusCode
    $errorMsg = $applyResult.Error
    
    if ($statusCode -eq 400) {
        Write-Warning "  ⚠️ Bad Request (400): $errorMsg"
        Write-Info "    Esto puede ser porque ya existe una postulación pendiente"
    } elseif ($statusCode -eq 403) {
        Write-ErrorMsg "  ❌ Forbidden (403): $errorMsg"
        Write-Info "    Verifica que el usuario sea un MODEL"
    } elseif ($statusCode -eq 404) {
        Write-ErrorMsg "  ❌ Not Found (404): $errorMsg"
        Write-Info "    Verifica que la agencia existe"
    } else {
        Write-ErrorMsg "  ❌ Error: Status $statusCode - $errorMsg"
    }
}

# 2.2 Intentar aplicar nuevamente (debería fallar)
Write-Info "`n2.2 Intentando aplicar nuevamente (debería fallar si ya existe postulación)..."

$applyAgainResult = Invoke-ApiRequest -Service $userServiceUrl -Method "POST" -Endpoint "/users/agencies/$script:agencyId/apply" -Headers $modelHeaders -Body $applyBody -SkipError

if ($applyAgainResult.Success) {
    Write-Warning "  ⚠️ Postulación enviada (no debería permitir duplicados)"
} else {
    $statusCode = $applyAgainResult.StatusCode
    if ($statusCode -eq 400) {
        Write-Success "  ✅ Correctamente rechazada - Ya existe una postulación (Status: 400)"
        Write-Info "    Error: $($applyAgainResult.Error)"
    } else {
        Write-Warning "  ⚠️ Respuesta inesperada: Status $statusCode"
    }
}

# 2.3 Verificar que USER no puede aplicar (debería fallar)
Write-Info "`n2.3 Verificando que USER no puede aplicar (prueba de seguridad)..."

if ($script:userToken) {
    $userHeaders = @{
        "Authorization" = "Bearer $script:userToken"
    }
    
    $userApplyResult = Invoke-ApiRequest -Service $userServiceUrl -Method "POST" -Endpoint "/users/agencies/$script:agencyId/apply" -Headers $userHeaders -Body $applyBody -SkipError
    
    if ($userApplyResult.Success) {
        Write-ErrorMsg "  ❌ ERROR DE SEGURIDAD: USER pudo aplicar (no debería)"
    } else {
        if ($userApplyResult.StatusCode -eq 403) {
            Write-Success "  ✅ Correctamente rechazada - Solo MODEL puede aplicar (Status: 403)"
        } else {
            Write-Warning "  ⚠️ Respuesta inesperada: Status $($userApplyResult.StatusCode)"
        }
    }
} else {
    Write-Info "  ℹ️ No hay token de USER para probar esta validación"
}

# ============================================
# RESUMEN
# ============================================

Write-Header "RESUMEN DE PRUEBAS"

Write-Info "`n✅ Pruebas completadas!"
Write-Info "`n📝 Detalles:"
Write-Info "  - Model ID: $script:modelId"
Write-Info "  - Model Email: $ModelEmail"
Write-Info "  - Agency ID: $script:agencyId"
Write-Info "  - Agency Email: $AgencyEmail"
Write-Info "`n📌 Notas:"
Write-Info "  - La postulación se crea en la tabla model_agency_relations con status 'pending'"
Write-Info "  - La agencia debería recibir una notificación"
Write-Info "  - La agencia puede aprobar o rechazar la postulación desde otro endpoint"
Write-Info "`n"
