# Script de Prueba: Todas las rutas del User Service para rol AGENCY
# Prueba todas las rutas que puede usar un usuario con rol AGENCY

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PRUEBA COMPLETA: RUTAS PARA ROL AGENCY" -ForegroundColor Cyan
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
$script:testAgencyId = $null

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
        $headers = @{ "Authorization" = "Bearer $script:agencyToken" }
        
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
    -Description "Obtener mi perfil completo - Obtiene el perfil completo de la agencia autenticada, incluyendo informacion basica, perfil extendido, estado de verificacion y configuraciones."

# ============================================
# RUTA 2: PUT /users/me - Actualizar mi perfil
# ============================================
Test-Route `
    -Method "PUT" `
    -Endpoint "/users/me" `
    -Body @{
        bio = "Bio actualizada desde prueba completa AGENCY - $(Get-Date -Format 'HH:mm:ss')"
    } `
    -Description "Actualizar mi perfil - Permite actualizar la informacion del perfil de la agencia autenticada (nombre, bio, pais, etc.)."

# ============================================
# RUTA 3: GET /users/me/models - Mis modelos gestionados
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/models" `
    -QueryParams @{ page = "1"; limit = "20" } `
    -Description "Mis modelos gestionados - Obtiene la lista de modelos que estan bajo representacion de la agencia autenticada. Solo agencias pueden ver sus modelos."

# ============================================
# RUTA 4: GET /users/search - Buscar usuarios
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/search" `
    -QueryParams @{ q = "test"; page = "1"; limit = "10" } `
    -Description "Buscar usuarios - Busca usuarios en la plataforma por termino de busqueda. Busca en nombres, emails y biografias."

# ============================================
# RUTA 5: GET /users/models - Listar modelos del marketplace
# ============================================
$result5 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/models" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar modelos del marketplace - Lista modelos disponibles en el marketplace con paginacion. Solo muestra modelos que estan disponibles para representacion."

# Guardar modelId si lo obtuvimos
if ($result5.Success -and $result5.Data.data -and $result5.Data.data.Count -gt 0 -and -not $script:testModelId) {
    $script:testModelId = $result5.Data.data[0].userId
    Write-Info "  [INFO] Model ID capturado: $script:testModelId"
}

# ============================================
# RUTA 6: GET /users/agencies - Listar agencias del marketplace
# ============================================
$result6 = Test-Route `
    -Method "GET" `
    -Endpoint "/users/agencies" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar agencias del marketplace - Lista agencias disponibles en el marketplace con informacion publica y cantidad de modelos gestionados. AGENCY puede buscar otras agencias para contactar."

# Guardar agencyId si lo obtuvimos (otra agencia, no la autenticada)
if ($result6.Success -and $result6.Data.data -and $result6.Data.data.Count -gt 0) {
    foreach ($agency in $result6.Data.data) {
        if ($agency.userId -ne $script:agencyId) {
            $script:testAgencyId = $agency.userId
            Write-Info "  [INFO] Test Agency ID capturado: $script:testAgencyId"
            break
        }
    }
}

# ============================================
# RUTA 7: GET /users/models/:id - Ver perfil publico de un modelo
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/models/$script:testModelId" `
        -Description "Ver perfil publico de un modelo - Obtiene el perfil publico de un modelo especifico por su ID. Muestra informacion visible publicamente."
}

# ============================================
# RUTA 8: GET /users/agencies/:id - Ver perfil publico de una agencia
# ============================================
if ($script:testAgencyId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/agencies/$script:testAgencyId" `
        -Description "Ver perfil publico de una agencia - Obtiene el perfil publico de una agencia especifica por su ID. AGENCY puede ver otras agencias para contactar."
}

# ============================================
# RUTA 9: POST /users/models/:modelId/propose - Proponer representación a un modelo
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/propose" `
        -Body @{
            message = "Nos gustaria representarte. Tenemos amplia experiencia en el mercado y podemos ofrecerte oportunidades profesionales."
            terms = "Comision del 20%, exclusividad por 6 meses"
        } `
        -Description "Proponer representacion a un modelo - Permite a una agencia enviar una propuesta de representacion a un modelo. Solo agencias pueden proponer representacion."
}

# ============================================
# RUTA 10: POST /users/agencies/:agencyId/contact - Contactar otra agencia
# ============================================
if ($script:testAgencyId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/agencies/$script:testAgencyId/contact" `
        -Body @{
            message = "Estamos interesados en negociar una partnership. Nos gustaria conocer mas sobre sus servicios."
            relationType = "partnership"
        } `
        -Description "Contactar otra agencia - Permite a una agencia contactar a otra para negociaciones, partnerships o transferencias de modelos. Solo agencias pueden contactar otras agencias."
}

# ============================================
# RUTA 11: POST /users/models/:modelId/follow - Seguir a un modelo/usuario/agencia
# ============================================
# AGENCY puede seguir según reglas de negocio
# Intentar seguir a un modelo primero
if ($script:testModelId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Seguir a un modelo - Permite a una agencia seguir a un modelo/usuario/agencia. Segun reglas de negocio."
}

# Intentar seguir a otra agencia si existe
if ($script:testAgencyId) {
    Test-Route `
        -Method "POST" `
        -Endpoint "/users/models/$script:testAgencyId/follow" `
        -Description "Seguir a una agencia - Permite a una agencia seguir a otra agencia. Segun reglas de negocio."
}

# ============================================
# RUTA 12: GET /users/me/following - Listar usuarios que sigo
# ============================================
Test-Route `
    -Method "GET" `
    -Endpoint "/users/me/following" `
    -QueryParams @{ page = "1"; limit = "10" } `
    -Description "Listar usuarios que sigo - Obtiene la lista de usuarios que la agencia autenticada esta siguiendo (pueden ser MODEL, USER o AGENCY segun reglas)."

# ============================================
# RUTA 13: GET /users/:id/followers - Listar seguidores de un usuario
# ============================================
if ($script:agencyId) {
    Test-Route `
        -Method "GET" `
        -Endpoint "/users/$script:agencyId/followers" `
        -Description "Listar seguidores de un usuario - Obtiene la lista de seguidores de un usuario especifico por su ID."
}

# ============================================
# RUTA 14: DELETE /users/models/:modelId/follow - Dejar de seguir
# ============================================
if ($script:testModelId) {
    Test-Route `
        -Method "DELETE" `
        -Endpoint "/users/models/$script:testModelId/follow" `
        -Description "Dejar de seguir a un modelo - Permite a una agencia dejar de seguir a otro modelo/usuario/agencia que estaba siguiendo."
}

# ============================================
# RESUMEN
# ============================================
Write-Header "PRUEBAS COMPLETADAS"
Write-Success "`nTodas las rutas para rol AGENCY han sido probadas."
Write-Info "`nRutas probadas:"
Write-Info "  1. GET /users/me - Obtener mi perfil"
Write-Info "  2. PUT /users/me - Actualizar mi perfil"
Write-Info "  3. GET /users/me/models - Mis modelos gestionados (AGENCY)"
Write-Info "  4. GET /users/search - Buscar usuarios"
Write-Info "  5. GET /users/models - Listar modelos"
Write-Info "  6. GET /users/agencies - Listar agencias"
Write-Info "  7. GET /users/models/:id - Ver perfil de modelo"
Write-Info "  8. GET /users/agencies/:id - Ver perfil de agencia"
Write-Info "  9. POST /users/models/:modelId/propose - Proponer representacion (AGENCY)"
Write-Info "  10. POST /users/agencies/:agencyId/contact - Contactar otra agencia (AGENCY)"
Write-Info "  11. POST /users/models/:modelId/follow - Seguir modelo/usuario/agencia"
Write-Info "  12. GET /users/me/following - Listar siguiendo"
Write-Info "  13. GET /users/:id/followers - Listar seguidores"
Write-Info "  14. DELETE /users/models/:modelId/follow - Dejar de seguir"
Write-Host "`n"
