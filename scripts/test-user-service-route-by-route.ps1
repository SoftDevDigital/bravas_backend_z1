# Script de Prueba: User Service - Ruta por Ruta
# Prueba cada endpoint del User Service mostrando descripción y respuesta completa
# 
# Uso: .\scripts\test-user-service-route-by-route.ps1 [routeNumber]
#   Si no se especifica routeNumber, empieza desde la primera
#   routeNumber puede ser un número específico o "all" para todas

param(
    [string]$RouteNumber = "1",
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host "Prueba: User Service - Ruta por Ruta" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# URLs de servicios
$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales
$creds = @{
    MODEL = @{
        email = "estanislaovaldez78@gmail.com"
        password = "Quelindouba2015@"
    }
    AGENCY = @{
        email = "devtech.notification@gmail.com"
        password = "Quelindouba2015@"
    }
    USER = @{
        email = "alexis.correa026@gmail.com"
        password = "Password123!"
    }
}

# Variables globales
$script:tokens = @{}
$script:modelId = $null
$script:agencyId = $null
$script:userId = $null

# Colores para output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n$('='*70)`n$msg`n$('='*70)" -ForegroundColor Magenta }
function Write-Description { param($msg) Write-Host "`n[DESC] $msg" -ForegroundColor Yellow }

# Función para obtener token
function Get-AuthToken {
    param($email, $password)
    
    try {
        $loginBody = @{
            email = $email
            password = $password
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $loginBody `
            -ErrorAction Stop
        
        if ($response.success -and $response.data.accessToken) {
            return $response.data.accessToken
        }
        return $null
    } catch {
        return $null
    }
}

# Función para hacer request
function Invoke-TestRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Role = "MODEL",
        [object]$Body = $null,
        [hashtable]$QueryParams = @{},
        [string]$Description
    )
    
    Write-Header "RUTA: $Method $Endpoint"
    
    if ($Description) {
        Write-Description $Description
    }
    
    $token = $script:tokens[$Role]
    if (-not $token) {
        Write-ErrorMsg "  [ERROR] No hay token disponible para rol $Role"
        return $null
    }
    
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $url = "$userServiceUrl$Endpoint"
    
    # Agregar query params
    if ($QueryParams.Count -gt 0) {
        $ampersand = "&"
        $queryString = ($QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join $ampersand
        $url += "?$queryString"
    }
    
    try {
        Write-Info "`n  → $Method $url"
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json -Depth 10
            Write-Info "  Body: $bodyJson"
        }
        
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        
        Write-Success "`n  [OK] EXITO (Status: 200)"
        Write-Info "`n  [RESPONSE] RESPUESTA COMPLETA:"
        Write-Host "`n$($response | ConvertTo-Json -Depth 10)" -ForegroundColor White
        
        return @{
            Success = $true
            Data = $response
        }
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
        
        if ($statusCode) {
            Write-ErrorMsg "`n  [ERROR] ERROR (Status: $statusCode)"
        } else {
            Write-ErrorMsg "`n  [ERROR] ERROR (Sin Status Code)"
        }
        Write-Info "`n  [ERROR RESPONSE] RESPUESTA DE ERROR:"
        Write-Host "`n$($errorBody | ConvertTo-Json -Depth 10)" -ForegroundColor Red
        
        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $errorBody
        }
    }
}

# Definición de rutas con descripciones
$routes = @(
    @{
        Number = 1
        Method = "GET"
        Endpoint = "/users/me"
        Role = "MODEL"
        Description = "Obtener mi perfil completo - Obtiene el perfil completo del usuario autenticado, incluyendo información básica, perfil extendido, estado de verificación y configuraciones."
    },
    @{
        Number = 2
        Method = "PUT"
        Endpoint = "/users/me"
        Role = "MODEL"
        Body = @{
            fullName = "Test Model Updated"
            bio = "Bio actualizada para pruebas"
            country = "AR"
        }
        Description = "Actualizar mi perfil - Permite actualizar la información del perfil del usuario autenticado (nombre, bio, país, etc.)"
    },
    @{
        Number = 3
        Method = "PUT"
        Endpoint = "/users/me/availability"
        Role = "MODEL"
        Body = @{
            available = $true
            contractTypes = @("with_advance", "without_advance")
            advancePayment = 1000
            notes = "Solo acepto contratos con mínimo 6 meses de duración"
        }
        Description = "Configurar disponibilidad (Solo Modelos) - Permite a un modelo configurar su disponibilidad para representación de agencias, tipos de contrato aceptados y anticipo requerido."
    },
    @{
        Number = 4
        Method = "GET"
        Endpoint = "/users/me/availability"
        Role = "MODEL"
        Description = "Obtener disponibilidad (Solo Modelos) - Obtiene la configuración de disponibilidad del modelo para representación de agencias."
    },
    @{
        Number = 5
        Method = "GET"
        Endpoint = "/users/models"
        Role = "AGENCY"
        QueryParams = @{ page = "1"; limit = "10" }
        Description = "Listar modelos del marketplace - Lista modelos disponibles en el marketplace con paginación. Solo muestra modelos que están disponibles para representación."
    },
    @{
        Number = 6
        Method = "GET"
        Endpoint = "/users/search"
        Role = "AGENCY"
        QueryParams = @{ q = "test"; page = "1"; limit = "10" }
        Description = "Buscar usuarios - Busca usuarios en la plataforma por término de búsqueda. Busca en nombres, emails y biografías."
    },
    @{
        Number = 7
        Method = "GET"
        Endpoint = "/users/agencies"
        Role = "MODEL"
        QueryParams = @{ page = "1"; limit = "10" }
        Description = "Listar agencias del marketplace - Lista agencias disponibles en el marketplace con información pública y cantidad de modelos gestionados."
    },
    @{
        Number = 8
        Method = "GET"
        Endpoint = "/users/me/stats"
        Role = "MODEL"
        Description = "Obtener mis estadísticas - Obtiene estadísticas del usuario autenticado (varía según el rol: modelos ven ventas, agencias ven modelos gestionados, etc.)"
    },
    @{
        Number = 9
        Method = "POST"
        Endpoint = "/users/agencies/{agencyId}/apply"
        Role = "MODEL"
        Body = @{
            message = "Me interesa formar parte de su agencia. Tengo experiencia en modelaje profesional y estoy buscando representación seria y profesional."
        }
        Description = "Postularse a una agencia (Solo Modelos) - Permite a un modelo enviar una solicitud de postulación a una agencia para obtener representación. Crea relación con status 'pending'."
        RequiresSetup = $true
    },
    @{
        Number = 10
        Method = "POST"
        Endpoint = "/users/models/{modelId}/propose"
        Role = "AGENCY"
        Body = @{
            message = "Nos gustaría representarte. Ofrecemos marketing profesional."
            terms = "Comisión del 20%, exclusividad, marketing incluido"
        }
        Description = "Proponer representación a un modelo (Solo Agencias) - Permite a una agencia proponer representación a un modelo con términos específicos. Crea relación con status 'pending'."
        RequiresSetup = $true
    },
    @{
        Number = 11
        Method = "GET"
        Endpoint = "/users/models/{modelId}"
        Role = "AGENCY"
        Description = "Ver perfil público de un modelo - Obtiene el perfil público de un modelo específico por su ID. Muestra información visible públicamente."
        RequiresSetup = $true
    },
    @{
        Number = 12
        Method = "GET"
        Endpoint = "/users/agencies/{agencyId}"
        Role = "MODEL"
        Description = "Ver perfil público de una agencia - Obtiene el perfil público de una agencia específica por su ID. Muestra información visible públicamente."
        RequiresSetup = $true
    },
    @{
        Number = 13
        Method = "GET"
        Endpoint = "/users/me/buyers"
        Role = "MODEL"
        QueryParams = @{ page = "1"; limit = "10" }
        Description = "Listar mis compradores (Solo Modelos) - Lista los compradores (usuarios que han comprado packs) del modelo autenticado."
    },
    @{
        Number = 14
        Method = "GET"
        Endpoint = "/users/me/models"
        Role = "AGENCY"
        QueryParams = @{ page = "1"; limit = "10" }
        Description = "Listar modelos gestionados (Solo Agencias) - Lista los modelos que la agencia autenticada está gestionando (con relación 'active')."
    },
    @{
        Number = 15
        Method = "GET"
        Endpoint = "/users/me/buyer-stats"
        Role = "MODEL"
        Description = "Estadísticas de compradores (Solo Modelos) - Obtiene estadísticas agregadas sobre los compradores del modelo (total de compradores, gasto total, etc.)"
    },
    @{
        Number = 16
        Method = "GET"
        Endpoint = "/users/stats"
        Role = "MODEL"
        Description = "Estadísticas generales de la plataforma - Obtiene estadísticas generales de la plataforma (puede requerir permisos especiales según el rol)."
    },
    @{
        Number = 17
        Method = "POST"
        Endpoint = "/users/models/{modelId}/follow"
        Role = "USER"
        Description = "Seguir a un modelo - Permite a un usuario seguir a un modelo. MODEL puede seguir MODEL/USER/AGENCY. USER puede seguir USER/MODEL (NO AGENCY)."
        RequiresSetup = $true
    },
    @{
        Number = 18
        Method = "DELETE"
        Endpoint = "/users/models/{modelId}/follow"
        Role = "USER"
        Description = "Dejar de seguir a un modelo - Permite a un usuario dejar de seguir a un modelo que estaba siguiendo."
        RequiresSetup = $true
    },
    @{
        Number = 19
        Method = "GET"
        Endpoint = "/users/me/following"
        Role = "USER"
        QueryParams = @{ page = "1"; limit = "10" }
        Description = "Listar usuarios que sigo - Obtiene la lista de usuarios que el usuario autenticado está siguiendo (pueden ser MODEL, USER o AGENCY según reglas)."
    },
    @{
        Number = 20
        Method = "GET"
        Endpoint = "/users/{userId}/followers"
        Role = "USER"
        Description = "Listar seguidores de un usuario - Obtiene la lista de seguidores de un usuario específico por su ID."
        RequiresSetup = $true
    }
)

# ============================================
# INICIALIZACIÓN: OBTENER TOKENS
# ============================================

Write-Header "INICIALIZACIÓN: OBTENER TOKENS"

Write-Info "Obteniendo tokens de autenticación..."

foreach ($role in @("MODEL", "AGENCY", "USER")) {
    Write-Info "  Autenticando como $role..."
    $token = Get-AuthToken -email $creds[$role].email -password $creds[$role].password
    if ($token) {
        $script:tokens[$role] = $token
        Write-Success "    [OK] Token obtenido para $role"
        
        # Obtener IDs necesarios
        if ($role -eq "MODEL") {
            $profileResult = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
                -Method GET `
                -Headers @{ "Authorization" = "Bearer $token" } `
                -ErrorAction Stop
            $script:modelId = $profileResult.data.userId
        } elseif ($role -eq "AGENCY") {
            $profileResult = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
                -Method GET `
                -Headers @{ "Authorization" = "Bearer $token" } `
                -ErrorAction Stop
            $script:agencyId = $profileResult.data.userId
        } elseif ($role -eq "USER") {
            $profileResult = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
                -Method GET `
                -Headers @{ "Authorization" = "Bearer $token" } `
                -ErrorAction Stop
            $script:userId = $profileResult.data.userId
        }
    } else {
        Write-ErrorMsg "    [ERROR] No se pudo obtener token para $role"
    }
}

Write-Info "`nIDs obtenidos:"
Write-Info "  Model ID: $script:modelId"
Write-Info "  Agency ID: $script:agencyId"
Write-Info "  User ID: $script:userId"

# ============================================
# PROBAR RUTAS
# ============================================

if ($RouteNumber -eq "all") {
    Write-Header "PROBANDO TODAS LAS RUTAS"
    $routesToTest = $routes
} else {
    $routeNum = [int]$RouteNumber
    $route = $routes | Where-Object { $_.Number -eq $routeNum }
    if (-not $route) {
        Write-ErrorMsg "`n[ERROR] Ruta numero $RouteNumber no encontrada."
        Write-Info "Rutas disponibles: 1-20 o 'all' para todas las rutas"
        exit 1
    }
    $routesToTest = @($route)
}

foreach ($route in $routesToTest) {
    Write-Info "`n`n"
    Write-Info "═══════════════════════════════════════════════════════════════"
    Write-Info "RUTA #$($route.Number) de $($routes.Count)"
    Write-Info "═══════════════════════════════════════════════════════════════"
    
    $endpoint = $route.Endpoint
    
    # Reemplazar placeholders en endpoints
    if ($endpoint -match "\{modelId\}") {
        $endpoint = $endpoint -replace "\{modelId\}", $script:modelId
    }
    if ($endpoint -match "\{agencyId\}") {
        $endpoint = $endpoint -replace "\{agencyId\}", $script:agencyId
    }
    if ($endpoint -match "\{userId\}") {
        $endpoint = $endpoint -replace "\{userId\}", $script:userId
    }
    
    $result = Invoke-TestRequest `
        -Method $route.Method `
        -Endpoint $endpoint `
        -Role $route.Role `
        -Body $route.Body `
        -QueryParams $route.QueryParams `
        -Description $route.Description
    
    if (-not $result) {
        Write-Warning "`n[WARNING] La ruta requiere configuracion adicional o no se pudo ejecutar."
    }
    
    Write-Info "`n═══════════════════════════════════════════════════════════════"
}

Write-Header "PRUEBAS COMPLETADAS"
