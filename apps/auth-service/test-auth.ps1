# Script de prueba rápida para Auth Service (PowerShell)
# Uso: .\test-auth.ps1

$BASE_URL = "http://localhost:3000/api/v1"
$TIMESTAMP = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$TEST_EMAIL = "test-$TIMESTAMP@example.com"
$TEST_PASSWORD = "Password123!"

Write-Host "🧪 Iniciando pruebas del Auth Service..." -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL"
Write-Host ""

# Función para hacer requests
function Make-Request {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [string]$Token = $null
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    if ($Data) {
        $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" -Method $Method -Headers $headers -Body $Data
    } else {
        $response = Invoke-RestMethod -Uri "$BASE_URL$Endpoint" -Method $Method -Headers $headers
    }
    
    return $response
}

Write-Host "📝 1. Probando REGISTER..." -ForegroundColor Yellow
$registerData = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    role = "user"
    birthDate = "2000-01-01"
    country = "AR"
} | ConvertTo-Json

try {
    $registerResponse = Make-Request -Method POST -Endpoint "/auth/register" -Data $registerData
    $registerResponse | ConvertTo-Json -Depth 10
    Write-Host ""
    
    if ($registerResponse.success) {
        Write-Host "✅ Registro exitoso" -ForegroundColor Green
        Write-Host "User ID: $($registerResponse.userId)"
    } else {
        Write-Host "❌ Error en registro" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error en registro: $_" -ForegroundColor Red
    Write-Host "Continúo con las pruebas asumiendo que el usuario ya existe..."
}

Write-Host ""
Write-Host "🔐 2. Probando LOGIN..." -ForegroundColor Yellow
Write-Host "⚠️  NOTA: Si el registro fue nuevo, el usuario debe verificar su email en AWS Cognito antes de poder hacer login" -ForegroundColor Yellow
Write-Host ""

$loginData = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Make-Request -Method POST -Endpoint "/auth/login" -Data $loginData
    $loginResponse | ConvertTo-Json -Depth 10
    Write-Host ""
    
    $ACCESS_TOKEN = $loginResponse.data.accessToken
    
    if ($ACCESS_TOKEN) {
        Write-Host "✅ Login exitoso" -ForegroundColor Green
        Write-Host "Access Token obtenido: $($ACCESS_TOKEN.Substring(0, [Math]::Min(50, $ACCESS_TOKEN.Length)))..."
        Write-Host ""
        
        Write-Host "👤 3. Probando /me (endpoint protegido)..." -ForegroundColor Yellow
        try {
            $meResponse = Make-Request -Method GET -Endpoint "/auth/me" -Token $ACCESS_TOKEN
            $meResponse | ConvertTo-Json -Depth 10
            Write-Host ""
            
            if ($meResponse.success) {
                Write-Host "✅ /me exitoso" -ForegroundColor Green
            } else {
                Write-Host "❌ Error en /me" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Error en /me: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  Login falló - esto puede ser normal si:" -ForegroundColor Yellow
        Write-Host "  - El usuario no ha verificado su email"
        Write-Host "  - Las credenciales son incorrectas"
        Write-Host "  - El usuario no existe"
    }
} catch {
    Write-Host "❌ Error en login: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔄 4. Probando REFRESH TOKEN..." -ForegroundColor Yellow

try {
    if ($loginResponse.data.refreshToken) {
        $refreshData = @{
            refreshToken = $loginResponse.data.refreshToken
        } | ConvertTo-Json
        
        $refreshResponse = Make-Request -Method POST -Endpoint "/auth/refresh" -Data $refreshData
        $refreshResponse | ConvertTo-Json -Depth 10
        Write-Host ""
        Write-Host "ℹ️  Nota: Refresh token puede estar en desarrollo" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  No hay refresh token disponible" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Error al probar refresh token: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Pruebas completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "📧 Email usado para pruebas: $TEST_EMAIL"
Write-Host "🔑 Password: $TEST_PASSWORD"










