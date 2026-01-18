# Script de Prueba: Todas las rutas del User Service para rol USER
# Prueba todas las rutas que puede usar un usuario con rol USER

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA COMPLETA: RUTAS PARA ROL USER" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales USER
$userEmail = "alexis.correa026@gmail.com"
$userPassword = "Password123!"

# Variables globales
$script:userToken = $null
$script:userId = $null
$script:testModelId = $null

# Funciones de output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Description { param($msg) Write-Host "`n[DESC] $msg" -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n"; Write-Host ("="*70) -ForegroundColor Magenta; Write-Host $msg -ForegroundColor Magenta; Write-Host ("="*70) -ForegroundColor Magenta }

# Función para probar endpoint
function Test-Route {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [hashtable]$QueryParams = @{},
        [string]$Description
    )
    
    Write-Header "RUTA: $Method $Endpoint"
    
    if ($Description) {
        Write-Description $Description
    }
    
    $url = "$userServiceUrl$Endpoint"
    
    # Agregar query params
    if ($QueryParams.Count -gt 0) {
        $ampersand = "&"
        $queryString = ($QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join $ampersand
        $url += "?$queryString"
    }
    
    Write-Info "`n  -> $Method $url"
    if ($Body) {
        Write-Info "  Body: $($Body | ConvertTo-Json -Compress)"
    }
    
    try {
        $headers = @{ "Authorization" = "Bearer $script:userToken" }
        
        # Preparar body
        $bodyJson = $null
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
        }
        
        $response = Invoke-RestMethod -Uri $url `
            -Method $Method `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $bodyJson `
            -ErrorAction Stop
        
        Write-Success "`n  [OK] EXITO (Status: 200)"
        Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
        Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
        
        return @{ Success = $true; Data = $response }
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
        
        return @{ Success = $false; StatusCode = $statusCode; Error = $errorBody }
    }
}

# ============================================
# INICIALIZACIÓN
# ============================================
Write-Header "INICIALIZACIÓN: AUTENTICACIÓN"

Write-Info "Autenticando como USER..."

try {
    $loginBody = @{
        email = $userEmail
        password = $userPassword
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    $script:userToken = $loginResponse.data.accessToken
    
    if ($script:userToken) {
        Write-Success "  Token obtenido correctamente"
        
        # Obtener ID del usuario
        $profile = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
            -Method GET `
            -Headers @{ "Authorization" = "Bearer $script:userToken" } `
            -ErrorAction Stop
        
        $script:userId = $profile.data.userId
        Write-Success "  User ID: $script:userId"
        
        # Los modelId y agencyId se obtendrán después al probar las rutas de listado
    } else {
        Write-ErrorMsg "  No se pudo obtener token"
        exit 1
    }
} catch {
    Write-ErrorMsg "  Error al autenticar: $($_.Exception.Message)"
    exit 1
}

# ============================================
# RUTA 1: GET /users/me - Obtener mi perfil
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me" `
    -Description "Obtener mi perfil completo - Obtiene el perfil completo del usuario autenticado, incluyendo informacion basica, perfil extendido, estado de verificacion y configuraciones."

# ============================================
# RUTA 2: PUT /users/me - Actualizar mi perfil
# ============================================
Test-Route `
    -Method "PUT" `
    -Endpoint "/users/me" `
    -Body @{
        bio = "Bio actualizada desde prueba completa USER - $(Get-Date -Format 'HH:mm:ss')"
    } `
    -Description "Actualizar mi perfil - Permite actualizar la informacion del perfil del usuario autenticado (nombre, bio, pais, etc.)."

# ============================================
# RUTA 3: GET /users/search - Buscar usuarios
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/search" `
    -QueryParams @{ q = "test"; page = "1"; limit = "10" } `
    -Description "Buscar usuarios - Busca usuarios en la plataforma por termino de busqueda. Busca en nombres, emails y biografias."

# ============================================
# RUTA 4: GET /users/models - Listar modelos del marketplace
# ============================================
$result4 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/models" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar modelos del marketplace - Lista modelos disponibles en el marketplace con paginacion. Solo muestra modelos que estan disponibles para representacion."

# Guardar modelId si lo obtuvimos
if ($result4.Success -and $result4.Data.data -and $result4.Data.data.Count -gt 0 -and -not $script:testModelId) {
    $script:testModelId = $result4.Data.data[0].userId
    Write-Info "  [INFO] Model ID capturado: $script:testModelId"
}

# ============================================
# RUTA 5: GET /users/agencies - Listar agencias del marketplace
# ============================================
$result5 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/agencies" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar agencias del marketplace - Lista agencias disponibles en el marketplace con informacion publica y cantidad de modelos gestionados."

# Guardar agencyId si lo obtuvimos
if ($result5.Success -and $result5.Data.data -and $result5.Data.data.Count -gt 0 -and -not $script:testAgencyId) {
    $script:testAgencyId = $result5.Data.data[0].userId
    Write-Info "  [INFO] Agency ID capturado: $script:testAgencyId"
}

# ============================================
# RUTA 6: GET /users/models/:id - Ver perfil publico de un modelo
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/models/$script:testModelId" `
        -Description "Ver perfil publico de un modelo - Obtiene el perfil publico de un modelo especifico por su ID. Muestra informacion visible publicamente."
} else {
    Write-Header "RUTA 6: GET /users/models/:id - SKIPPED (No hay modelId disponible)"
}

# ============================================
# RUTA 6B: GET /users/agencies/:id - Ver perfil publico de una agencia
# ============================================
if ($script:testAgencyId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/agencies/$script:testAgencyId" `
        -Description "Ver perfil publico de una agencia - USER puede ver perfil de agencia SOLO para conectar con modelos (ver perfiles de modelos de la agencia)."
} else {
    Write-Header "RUTA 6B: GET /users/agencies/:id - SKIPPED (No hay agencyId disponible)"
}

# ============================================
# RUTA 7: POST /users/models/:modelId/follow - Seguir a un modelo
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Seguir a un modelo - Permite a un usuario seguir a un modelo. USER puede seguir USER/MODEL (NO AGENCY)."
}

# ============================================
# RUTA 8: GET /users/me/following - Listar usuarios que sigo
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/following" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar usuarios que sigo - Obtiene la lista de usuarios que el usuario autenticado esta siguiendo (pueden ser MODEL o USER segun reglas)."

# ============================================
# RUTA 9: GET /users/:id/followers - Listar seguidores de un usuario
# ============================================
if ($script:userId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/$script:userId/followers" `
        -Description "Listar seguidores de un usuario - Obtiene la lista de seguidores de un usuario especifico por su ID."
}

# ============================================
# RUTA 10: DELETE /users/models/:modelId/follow - Dejar de seguir
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "DELETE" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Dejar de seguir a un modelo - Permite a un usuario dejar de seguir a un modelo que estaba siguiendo."
}

# NOTA: GET /users/stats es solo para ADMIN, no para USER

# ============================================
# RESUMEN
# ============================================
Write-Header "PRUEBAS COMPLETADAS"
Write-Success "`nTodas las rutas para rol USER han sido probadas."
Write-Info "`nRutas probadas:"
Write-Info "  1. GET /users/me - Obtener mi perfil"
Write-Info "  2. PUT /users/me - Actualizar mi perfil"
Write-Info "  3. GET /users/search - Buscar usuarios"
Write-Info "  4. GET /users/models - Listar modelos"
Write-Info "  5. GET /users/agencies - Listar agencias"
Write-Info "  6. GET /users/models/:id - Ver perfil de modelo"
Write-Info "  6B. GET /users/agencies/:id - Ver perfil de agencia"
Write-Info "  7. POST /users/models/:modelId/follow - Seguir modelo"
Write-Info "  8. GET /users/me/following - Listar siguiendo"
Write-Info "  9. GET /users/:id/followers - Listar seguidores"
Write-Info "  10. DELETE /users/models/:modelId/follow - Dejar de seguir"
Write-Host "`n"
