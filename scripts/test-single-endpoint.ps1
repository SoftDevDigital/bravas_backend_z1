# Script para probar UN endpoint a la vez del User Service
# Permite probar ruta por ruta de forma controlada

param(
    [Parameter(Mandatory=$true)]
    [string]$Method,
    
    [Parameter(Mandatory=$true)]
    [string]$Endpoint,
    
    [string]$Role = "MODEL",  # MODEL, AGENCY, USER
    [string]$Body = $null,
    [string]$Description = ""
)

$ErrorActionPreference = "Continue"

# Configuración
$baseUrl = "http://localhost:3001/api/v1"
$authUrl = "http://localhost:3000/api/v1"

# Credenciales
$credentials = @{
    "MODEL" = @{
        email = "estanislaovaldez78@gmail.com"
        password = "Quelindouba2015@"
    }
    "AGENCY" = @{
        email = "devtech.notification@gmail.com"
        password = "Quelindouba2015@"
    }
    "USER" = @{
        email = "Alexis.correa026@gmail.com"
        password = "Quelindouba2015@"
    }
}

# Colores
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n$('='*60)`n$msg`n$('='*60)" -ForegroundColor Magenta }

Write-Header "PRUEBA: $Method $Endpoint"

if ($Description) {
    Write-Info "Descripción: $Description"
}
Write-Info "Rol: $Role`n"

# 1. Login
Write-Info "1. Iniciando sesión con rol $Role..."
$cred = $credentials[$Role]
if (-not $cred) {
    Write-ErrorMsg "ERROR: Rol '$Role' no encontrado. Roles disponibles: MODEL, AGENCY, USER"
    exit 1
}

try {
    $loginBody = @{
        email = $cred.email
        password = $cred.password
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$authUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    
    if ($loginResponse.success) {
        $token = $null
        if ($loginResponse.data.token) {
            $token = $loginResponse.data.token
        } elseif ($loginResponse.data.accessToken) {
            $token = $loginResponse.data.accessToken
        } elseif ($loginResponse.data.access_token) {
            $token = $loginResponse.data.access_token
        }
        
        if (-not $token) {
            Write-ErrorMsg "ERROR: Token no encontrado en la respuesta de login"
            Write-Info "Respuesta completa:"
            $loginResponse | ConvertTo-Json -Depth 5 | Write-Host
            exit 1
        }
        
        Write-Success "   ✅ Login exitoso"
    } else {
        Write-ErrorMsg "ERROR: Login fallido - $($loginResponse.message)"
        exit 1
    }
} catch {
    Write-ErrorMsg "ERROR: Error al hacer login - $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) {
        Write-Info "Detalles: $($_.ErrorDetails.Message)"
    }
    exit 1
}

# 2. Probar endpoint
Write-Info "`n2. Probando endpoint: $Method $Endpoint"

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $params = @{
        Uri = "$baseUrl$Endpoint"
        Method = $Method
        Headers = $headers
        ErrorAction = "Stop"
    }
    
    if ($Body) {
        $params.Body = $Body
        if (-not $headers.ContainsKey("Content-Type")) {
            $params.Headers["Content-Type"] = "application/json"
        }
    }
    
    $response = Invoke-RestMethod @params
    
    # Mostrar resultado
    Write-Success "`n✅ ÉXITO - Status: OK"
    Write-Info "`n📋 RESPUESTA COMPLETA:"
    $responseJson = $response | ConvertTo-Json -Depth 10
    Write-Host $responseJson
    
    # Información adicional
    if ($response.success) {
        Write-Success "`n✓ La respuesta indica éxito (success: true)"
        if ($response.data) {
            $dataJson = $response.data | ConvertTo-Json -Depth 3
            Write-Info "✓ Datos recibidos: $dataJson"
        }
        if ($response.message) {
            Write-Info "✓ Mensaje: $($response.message)"
        }
    } else {
        Write-Warning "⚠ La respuesta indica fallo (success: false)"
        if ($response.message) {
            Write-Warning "Mensaje: $($response.message)"
        }
    }
    
} catch {
    $statusCode = $null
    $errorMessage = $_.Exception.Message
    $errorDetails = $null
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        } catch {
            $errorDetails = $_.ErrorDetails.Message
        }
    }
    
    Write-ErrorMsg "`n❌ ERROR"
    Write-Info "`n📋 DETALLES DEL ERROR:"
    
    if ($statusCode) {
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    }
    
    Write-Host "   Mensaje: $errorMessage" -ForegroundColor Red
    
    if ($errorDetails) {
        Write-Info "`n   Respuesta del servidor:"
        if ($errorDetails -is [PSCustomObject] -or $errorDetails -is [System.Collections.IDictionary]) {
            Write-Host ($errorDetails | ConvertTo-Json -Depth 5)
        } else {
            Write-Host $errorDetails
        }
    }
    
    Write-Info "`n   Stack Trace:"
    Write-Host $_.Exception.StackTrace -ForegroundColor DarkGray
}

$separator = "=" * 60
Write-Info "`n$separator"
Write-Info "Prueba completada. Revisa los resultados arriba."
Write-Info $separator
