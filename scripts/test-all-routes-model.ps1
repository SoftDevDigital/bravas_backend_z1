# Script de Prueba: Todas las rutas del User Service para rol MODEL
# Prueba todas las rutas que puede usar un usuario con rol MODEL

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA COMPLETA: RUTAS PARA ROL MODEL" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales MODEL
$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

# Variables globales
$script:modelToken = $null
$script:modelId = $null
$script:testModelId = $null
$script:testAgencyId = $null
$script:testUserId = $null

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
        $headers = @{ "Authorization" = "Bearer $script:modelToken" }
        
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

# ============================================
# RUTA 1: GET /users/me - Obtener mi perfil
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me" `
    -Description "Obtener mi perfil completo - Obtiene el perfil completo del modelo autenticado, incluyendo informacion basica, perfil extendido, estado de verificacion y configuraciones."

# ============================================
# RUTA 2: PUT /users/me - Actualizar mi perfil
# ============================================
Test-Route `
    -Method "PUT" `
    -Endpoint "/users/me" `
    -Body @{
        bio = "Bio actualizada desde prueba completa MODEL - $(Get-Date -Format 'HH:mm:ss')"
    } `
    -Description "Actualizar mi perfil - Permite actualizar la informacion del perfil del modelo autenticado (nombre, bio, pais, etc.)."

# ============================================
# RUTA 3: GET /users/me/stats - Obtener estadisticas
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/stats" `
    -Description "Obtener mis estadisticas - Obtiene estadisticas detalladas del modelo autenticado. Util para modelos que quieren ver su performance."

# ============================================
# RUTA 4: GET /users/me/buyers - Mis compradores
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/buyers" `
    -QueryParams @{ page = "1"; limit = "20" } `
    -Description "Listar mis compradores - Obtiene la lista de usuarios que han comprado contenido al modelo autenticado. Solo modelos pueden ver sus compradores."

# ============================================
# RUTA 5: GET /users/me/availability - Obtener disponibilidad
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/availability" `
    -Description "Obtener mi disponibilidad - Obtiene la configuracion actual de disponibilidad para representacion del modelo autenticado. Solo modelos pueden ver su disponibilidad."

# ============================================
# RUTA 6: PUT /users/me/availability - Configurar disponibilidad
# ============================================
Test-Route `
    -Method "PUT" `
    -Endpoint "/users/me/availability" `
    -Body @{
        available = $true
        contractTypes = @("with_advance", "without_advance")
        advancePayment = 1000
        notes = "Solo acepto contratos con minimo 6 meses de duracion"
    } `
    -Description "Configurar disponibilidad - Permite a un modelo configurar su disponibilidad para representacion de agencias, incluyendo tipos de contrato aceptados, anticipo requerido y notas para agencias."

# ============================================
# RUTA 7: GET /users/search - Buscar usuarios
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/search" `
    -QueryParams @{ q = "test"; page = "1"; limit = "10" } `
    -Description "Buscar usuarios - Busca usuarios en la plataforma por termino de busqueda. Busca en nombres, emails y biografias."

# ============================================
# RUTA 8: GET /users/models - Listar modelos del marketplace
# ============================================
$result8 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/models" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar modelos del marketplace - Lista modelos disponibles en el marketplace con paginacion. Solo muestra modelos que estan disponibles para representacion."

# Guardar modelId si lo obtuvimos (otro modelo, no el autenticado)
if ($result8.Success -and $result8.Data.data -and $result8.Data.data.Count -gt 0) {
    # Buscar un modelo diferente al autenticado
    foreach ($model in $result8.Data.data) {
        if ($model.userId -ne $script:modelId) {
            $script:testModelId = $model.userId
            Write-Info "  [INFO] Test Model ID capturado: $script:testModelId"
            break
        }
    }
}

# ============================================
# RUTA 9: GET /users/agencies - Listar agencias del marketplace
# ============================================
$result9 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/agencies" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar agencias del marketplace - Lista agencias disponibles en el marketplace con informacion publica y cantidad de modelos gestionados. Modelos pueden buscar agencias para postularse."

# Guardar agencyId si lo obtuvimos
if ($result9.Success -and $result9.Data.data -and $result9.Data.data.Count -gt 0 -and -not $script:testAgencyId) {
    $script:testAgencyId = $result9.Data.data[0].userId
    Write-Info "  [INFO] Agency ID capturado: $script:testAgencyId"
}

# ============================================
# RUTA 10: GET /users/models/:id - Ver perfil publico de un modelo
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/models/$script:testModelId" `
        -Description "Ver perfil publico de un modelo - Obtiene el perfil publico de un modelo especifico por su ID. Muestra informacion visible publicamente."
}

# ============================================
# RUTA 11: GET /users/agencies/:id - Ver perfil publico de una agencia
# ============================================
if ($script:testAgencyId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/agencies/$script:testAgencyId" `
        -Description "Ver perfil publico de una agencia - Obtiene el perfil publico de una agencia especifica por su ID. Modelos pueden ver agencias para postularse."
}

# ============================================
# RUTA 12: POST /users/agencies/:agencyId/apply - Postularse a una agencia
# ============================================
if ($script:testAgencyId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/agencies/$script:testAgencyId/apply" `
        -Body @{
            message = "Me interesa formar parte de su agencia. Tengo experiencia en modelaje profesional y estoy buscando representacion seria y profesional."
        } `
        -Description "Postularse a una agencia - Permite a un modelo enviar una solicitud de postulacion a una agencia para obtener representacion. Solo modelos pueden postularse a agencias."
}

# ============================================
# RUTA 13: POST /users/models/:modelId/follow - Seguir a un modelo/usuario/agencia
# ============================================
# MODEL puede seguir a MODEL, USER y AGENCY
# Intentar seguir a otro modelo primero
if ($script:testModelId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Seguir a un modelo - Permite a un modelo seguir a otro modelo/usuario/agencia. MODEL puede seguir MODEL, USER y AGENCY."
}

# Intentar seguir a una agencia si existe
if ($script:testAgencyId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testAgencyId/follow" `
        -Description "Seguir a una agencia - Permite a un modelo seguir a una agencia. MODEL puede seguir MODEL, USER y AGENCY."
}

# ============================================
# RUTA 14: GET /users/me/following - Listar usuarios que sigo
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/following" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar usuarios que sigo - Obtiene la lista de usuarios que el modelo autenticado esta siguiendo (pueden ser MODEL, USER o AGENCY)."

# ============================================
# RUTA 15: GET /users/:id/followers - Listar seguidores de un usuario
# ============================================
if ($script:modelId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/$script:modelId/followers" `
        -Description "Listar seguidores de un usuario - Obtiene la lista de seguidores de un usuario especifico por su ID."
}

# ============================================
# RUTA 16: DELETE /users/models/:modelId/follow - Dejar de seguir
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "DELETE" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Dejar de seguir a un modelo - Permite a un modelo dejar de seguir a otro modelo/usuario/agencia que estaba siguiendo."
}

# ============================================
# RESUMEN
# ============================================
Write-Header "PRUEBAS COMPLETADAS"
Write-Success "`nTodas las rutas para rol MODEL han sido probadas."
Write-Info "`nRutas probadas:"
Write-Info "  1. GET /users/me - Obtener mi perfil"
Write-Info "  2. PUT /users/me - Actualizar mi perfil"
Write-Info "  3. GET /users/me/stats - Obtener estadisticas (MODEL)"
Write-Info "  4. GET /users/me/buyers - Mis compradores (MODEL)"
Write-Info "  5. GET /users/me/availability - Obtener disponibilidad (MODEL)"
Write-Info "  6. PUT /users/me/availability - Configurar disponibilidad (MODEL)"
Write-Info "  7. GET /users/search - Buscar usuarios"
Write-Info "  8. GET /users/models - Listar modelos"
Write-Info "  9. GET /users/agencies - Listar agencias"
Write-Info "  10. GET /users/models/:id - Ver perfil de modelo"
Write-Info "  11. GET /users/agencies/:id - Ver perfil de agencia"
Write-Info "  12. POST /users/agencies/:agencyId/apply - Postularse a agencia (MODEL)"
Write-Info "  13. POST /users/models/:modelId/follow - Seguir modelo/usuario/agencia (MODEL puede seguir a MODEL, USER y AGENCY)"
Write-Info "  14. GET /users/me/following - Listar siguiendo"
Write-Info "  15. GET /users/:id/followers - Listar seguidores"
Write-Info "  16. DELETE /users/models/:modelId/follow - Dejar de seguir"
Write-Host "`n"
