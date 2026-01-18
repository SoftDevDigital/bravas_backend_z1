# Script completo para probar TODOS los endpoints del User Service
# Probará endpoint por endpoint de forma sistemática

$ErrorActionPreference = "Continue"

# Configuración
$baseUrl = "http://localhost:3001/api/v1"
$authUrl = "http://localhost:3000/api/v1"

# Colores para output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n$('='*60)`n$msg`n$('='*60)" -ForegroundColor Magenta }

# Variables globales para tokens y datos
$script:userToken = $null
$script:modelToken = $null
$script:agencyToken = $null
$script:testModelId = $null
$script:testAgencyId = $null
$script:testUserId = $null

# ============================================
# FUNCIONES AUXILIARES
# ============================================

function Get-AuthToken {
    param($email, $password)
    
    try {
        $loginBody = @{
            email = $email
            password = $password
        } | ConvertTo-Json
        
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
                Write-Success "  OK - Login exitoso"
                return $token
            }
        }
        Write-ErrorMsg "  ERROR - Token no encontrado"
        return $null
    } catch {
        Write-ErrorMsg "  ERROR - Login fallido: $($_.Exception.Message)"
        return $null
    }
}

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$Description,
        [bool]$ExpectSuccess = $true
    )
    
    Write-Info "`n  → Probando: $Method $Endpoint"
    if ($Description) {
        Write-Info "    Descripción: $Description"
    }
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            Headers = $Headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = if ($Body -is [string]) { $Body } else { ($Body | ConvertTo-Json) }
            if (-not $Headers.ContainsKey("Content-Type")) {
                $params.Headers["Content-Type"] = "application/json"
            }
        }
        
        $response = Invoke-RestMethod @params
        
        if ($ExpectSuccess -and $response.success) {
            Write-Success "    ✅ ÉXITO - Status: OK"
            if ($response.message) {
                Write-Info "    Mensaje: $($response.message)"
            }
            return @{ success = $true; data = $response }
        } elseif (-not $ExpectSuccess) {
            Write-Warning "    ⚠️ Respuesta recibida (esperado fallo): $($response.message)"
            return @{ success = $false; data = $response }
        } else {
            Write-ErrorMsg "    ❌ FALLO - Respuesta sin éxito"
            return @{ success = $false; data = $response }
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        if ($_.ErrorDetails.Message) {
            try {
                $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorDetails.error -and $errorDetails.error.message) {
                    $errorMessage = $errorDetails.error.message
                } elseif ($errorDetails.message) {
                    $errorMessage = $errorDetails.message
                }
            } catch {
                # Ignorar error de parsing
            }
        }
        
        if (-not $ExpectSuccess -and ($statusCode -eq 403 -or $statusCode -eq 400 -or $statusCode -eq 404)) {
            Write-Success "    ✅ CORRECTO - Rechazado como se esperaba (Status: $statusCode)"
            return @{ success = $true; data = $null; statusCode = $statusCode }
        } elseif ($ExpectSuccess) {
            Write-ErrorMsg "    ❌ ERROR - Status: $statusCode, Mensaje: $errorMessage"
            return @{ success = $false; data = $null; statusCode = $statusCode; error = $errorMessage }
        } else {
            Write-Warning "    ⚠️ Error recibido: Status $statusCode"
            return @{ success = $false; data = $null; statusCode = $statusCode }
        }
    }
}

# ============================================
# INICIALIZACIÓN - OBTENER TOKENS
# ============================================

Write-Header "FASE 1: INICIALIZACIÓN - OBTENER TOKENS"

Write-Info "`n1.1 Login con cuenta USER..."
$script:userToken = Get-AuthToken -email "user@example.com" -password "Test123!"

Write-Info "`n1.2 Login con cuenta MODEL..."
$script:modelToken = Get-AuthToken -email "estanislaovaldez78@gmail.com" -password "Quelindouba2015@"

Write-Info "`n1.3 Login con cuenta AGENCY..."
$script:agencyToken = Get-AuthToken -email "devtech.notification@gmail.com" -password "Quelindouba2015@"

if (-not $script:modelToken -or -not $script:agencyToken) {
    Write-ErrorMsg "`nERROR CRÍTICO: No se pudieron obtener los tokens necesarios. Abortando pruebas."
    exit 1
}

# ============================================
# FASE 2: ENDPOINTS BÁSICOS DE PERFIL
# ============================================

Write-Header "FASE 2: ENDPOINTS BÁSICOS DE PERFIL"

# 2.1 GET /users/me - Obtener mi perfil (MODEL)
Write-Info "`n2.1 GET /users/me (MODEL)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Obtener perfil del usuario MODEL autenticado"
$script:testModelId = $result.data.data.userId

# 2.2 GET /users/me - Obtener mi perfil (AGENCY)
Write-Info "`n2.2 GET /users/me (AGENCY)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me" `
    -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
    -Description "Obtener perfil del usuario AGENCY autenticado"
$script:testAgencyId = $result.data.data.userId

# 2.3 PUT /users/me - Actualizar mi perfil (MODEL)
Write-Info "`n2.3 PUT /users/me (MODEL) - Actualizar perfil básico"
$updateBody = @{
    fullName = "Test Model Updated"
    bio = "Bio actualizada para pruebas"
    country = "AR"
    preferences = @{
        notifications = $true
        publicProfile = $true
    }
}
$result = Test-Endpoint `
    -Method "PUT" `
    -Endpoint "/users/me" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Body $updateBody `
    -Description "Actualizar perfil del usuario MODEL"

# 2.4 PUT /users/me - Actualizar mi perfil (AGENCY)
Write-Info "`n2.4 PUT /users/me (AGENCY) - Actualizar perfil básico"
$updateBodyAgency = @{
    fullName = "Test Agency Updated"
    bio = "Agencia actualizada para pruebas"
    country = "MX"
}
$result = Test-Endpoint `
    -Method "PUT" `
    -Endpoint "/users/me" `
    -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
    -Body $updateBodyAgency `
    -Description "Actualizar perfil del usuario AGENCY"

# ============================================
# FASE 3: ENDPOINTS DE DISPONIBILIDAD
# ============================================

Write-Header "FASE 3: ENDPOINTS DE DISPONIBILIDAD (Solo MODEL)"

# 3.1 PUT /users/me/availability - Actualizar disponibilidad
Write-Info "`n3.1 PUT /users/me/availability"
$availabilityBody = @{
    available = $true
    contractTypes = @("with_advance", "without_advance")
    advancePayment = 1000
    notes = "Solo acepto contratos con mínimo 6 meses de duración"
}
$result = Test-Endpoint `
    -Method "PUT" `
    -Endpoint "/users/me/availability" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Body $availabilityBody `
    -Description "Actualizar disponibilidad del MODEL"

# 3.2 GET /users/me/availability - Obtener disponibilidad
Write-Info "`n3.2 GET /users/me/availability"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me/availability" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Obtener disponibilidad del MODEL"

# ============================================
# FASE 4: MARKETPLACE Y BÚSQUEDAS
# ============================================

Write-Header "FASE 4: MARKETPLACE Y BÚSQUEDAS"

# 4.1 GET /users/models - Listar modelos
Write-Info "`n4.1 GET /users/models - Listar modelos del marketplace"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/models?page=1$([char]38)limit=10" `
    -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
    -Description "Listar modelos disponibles en el marketplace"

if ($result.success -and $result.data.data.items -and $result.data.data.items.Count -gt 0) {
    $firstModel = $result.data.data.items[0]
    if ($firstModel.userId) {
        $script:testModelId = $firstModel.userId
        Write-Info "    Modelo encontrado para pruebas: $script:testModelId"
    }
}

# 4.2 GET /users/search - Buscar usuarios
Write-Info "`n4.2 GET /users/search - Buscar usuarios"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/search?q=test$([char]38)page=1$([char]38)limit=10" `
    -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
    -Description "Buscar usuarios por término de búsqueda"

# 4.3 GET /users/agencies - Listar agencias
Write-Info "`n4.3 GET /users/agencies - Listar agencias del marketplace"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/agencies?page=1$([char]38)limit=10" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Listar agencias disponibles en el marketplace"

if ($result.success -and $result.data.data.items -and $result.data.data.items.Count -gt 0) {
    $firstAgency = $result.data.data.items[0]
    if ($firstAgency.userId) {
        $script:testAgencyId = $firstAgency.userId
        Write-Info "    Agencia encontrada para pruebas: $script:testAgencyId"
    }
}

# ============================================
# FASE 5: PERFILES ESPECÍFICOS
# ============================================

Write-Header "FASE 5: PERFILES ESPECÍFICOS"

if ($script:testModelId) {
    # 5.1 GET /users/models/:id - Ver perfil de modelo
    Write-Info "`n5.1 GET /users/models/$script:testModelId"
    $result = Test-Endpoint `
        -Method "GET" `
        -Endpoint "/users/models/$script:testModelId" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Description "Ver perfil público de un modelo"
}

if ($script:testAgencyId) {
    # 5.2 GET /users/agencies/:id - Ver perfil de agencia
    Write-Info "`n5.2 GET /users/agencies/$script:testAgencyId"
    $result = Test-Endpoint `
        -Method "GET" `
        -Endpoint "/users/agencies/$script:testAgencyId" `
        -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
        -Description "Ver perfil público de una agencia"
}

# ============================================
# FASE 6: RELACIONES MODEL-AGENCY
# ============================================

Write-Header "FASE 6: RELACIONES MODEL-AGENCY"

if ($script:testModelId -and $script:testAgencyId) {
    # 6.1 POST /users/models/:modelId/propose - AGENCY propone representación a MODEL
    Write-Info "`n6.1 POST /users/models/$script:testModelId/propose (AGENCY)"
    $proposeBody = @{
        message = "Nos gustaría representarte. Ofrecemos marketing profesional."
        terms = "Comisión del 20%, exclusividad, marketing incluido"
    }
    $result = Test-Endpoint `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/propose" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Body $proposeBody `
        -Description "AGENCY propone representación a MODEL"

    # 6.2 POST /users/agencies/:agencyId/apply - MODEL se postula a AGENCY
    Write-Info "`n6.2 POST /users/agencies/$script:testAgencyId/apply (MODEL)"
    $applyBody = @{
        message = "Me gustaria ser representado por su agencia. Tengo experiencia en modelaje profesional."
    }
    $result = Test-Endpoint `
        -Method "POST" `
        -Endpoint "/users/agencies/$script:testAgencyId/apply" `
        -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
        -Body $applyBody `
        -Description "MODEL se postula a AGENCY"

    # 6.3 POST /users/agencies/:agencyId/contact - USER/MODEL contacta AGENCY
    Write-Info "`n6.3 POST /users/agencies/$script:testAgencyId/contact (MODEL)"
    $contactBody = @{
        message = "Me gustaria conocer mas sobre sus servicios de representacion y agencias."
        relationType = "negotiation"
    }
    $result = Test-Endpoint `
        -Method "POST" `
        -Endpoint "/users/agencies/$script:testAgencyId/contact" `
        -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
        -Body $contactBody `
        -Description "MODEL contacta AGENCY"
}

# ============================================
# FASE 7: ESTADÍSTICAS
# ============================================

Write-Header "FASE 7: ESTADÍSTICAS"

# 7.1 GET /users/me/stats - Estadísticas del usuario (MODEL)
Write-Info "`n7.1 GET /users/me/stats (MODEL)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me/stats" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Obtener estadísticas del MODEL"

# 7.2 GET /users/me/buyers - Listar compradores (MODEL)
Write-Info "`n7.2 GET /users/me/buyers (MODEL)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me/buyers?page=1$([char]38)limit=10" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Listar compradores del MODEL"

# 7.3 GET /users/me/buyer-stats - Estadísticas de compradores (MODEL)
Write-Info "`n7.3 GET /users/me/buyer-stats (MODEL)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me/buyer-stats" `
    -Headers @{ "Authorization" = "Bearer $script:modelToken" } `
    -Description "Estadísticas de compradores del MODEL"

# 7.4 GET /users/me/models - Listar modelos gestionados (AGENCY)
Write-Info "`n7.4 GET /users/me/models (AGENCY)"
$result = Test-Endpoint `
    -Method "GET" `
    -Endpoint "/users/me/models?page=1$([char]38)limit=10" `
    -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
    -Description "Listar modelos gestionados por AGENCY"

# ============================================
# FASE 8: SISTEMA DE SEGUIMIENTO (FOLLOW)
# ============================================

Write-Header "FASE 8: SISTEMA DE SEGUIMIENTO (FOLLOW)"

if ($script:testModelId) {
    # 8.1 POST /users/models/:modelId/follow - Seguir modelo (AGENCY puede seguir)
    Write-Info "`n8.1 POST /users/models/$script:testModelId/follow (AGENCY)"
    $result = Test-Endpoint `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Description "AGENCY sigue a MODEL"

    # 8.2 GET /users/me/following - Ver siguiendo
    Write-Info "`n8.2 GET /users/me/following (AGENCY)"
    $result = Test-Endpoint `
        -Method "GET" `
        -Endpoint "/users/me/following?page=1$([char]38)limit=10" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Description "Ver usuarios que estoy siguiendo"

    # 8.3 GET /users/:id/followers - Ver seguidores
    Write-Info "`n8.3 GET /users/$script:testModelId/followers"
    $result = Test-Endpoint `
        -Method "GET" `
        -Endpoint "/users/$script:testModelId/followers?page=1$([char]38)limit=10" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Description "Ver seguidores de un usuario"

    # 8.4 DELETE /users/models/:modelId/follow - Dejar de seguir
    Write-Info "`n8.4 DELETE /users/models/$script:testModelId/follow (AGENCY)"
    $result = Test-Endpoint `
        -Method "DELETE" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Headers @{ "Authorization" = "Bearer $script:agencyToken" } `
        -Description "AGENCY deja de seguir a MODEL"
}

# ============================================
# RESUMEN FINAL
# ============================================

Write-Header "RESUMEN FINAL DE PRUEBAS"

Write-Success "`n✅ Pruebas completadas"
Write-Info "`nEndpoints probados:"
Write-Info "  - GET /users/me (MODEL y AGENCY)"
Write-Info "  - PUT /users/me (MODEL y AGENCY)"
Write-Info "  - PUT /users/me/availability (MODEL)"
Write-Info "  - GET /users/me/availability (MODEL)"
Write-Info "  - GET /users/models (Marketplace)"
Write-Info "  - GET /users/search"
Write-Info "  - GET /users/agencies (Marketplace)"
Write-Info "  - GET /users/models/:id"
Write-Info "  - GET /users/agencies/:id"
Write-Info "  - POST /users/models/:modelId/propose"
Write-Info "  - POST /users/agencies/:agencyId/apply"
Write-Info "  - POST /users/agencies/:agencyId/contact"
Write-Info "  - GET /users/me/stats"
Write-Info "  - GET /users/me/buyers"
Write-Info "  - GET /users/me/buyer-stats"
Write-Info "  - GET /users/me/models"
Write-Info "  - POST /users/models/:modelId/follow"
Write-Info "  - GET /users/me/following"
Write-Info "  - GET /users/:id/followers"
Write-Info "  - DELETE /users/models/:modelId/follow"

Write-Info ""
Write-Info "Proximos pasos para probar:"
Write-Info "  - Endpoints de administracion (requieren ADMIN)"
Write-Info "  - Endpoints de avatar"
Write-Info "  - Endpoints de verificacion de identidad"
Write-Info ""


