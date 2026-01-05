# Script de Prueba de Flujos End-to-End - BRAVAS Backend (Version Simple)
# Prueba los flujos principales de la plataforma

$ErrorActionPreference = "Continue"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Prueba de Flujos End-to-End" -ForegroundColor Cyan
Write-Host "  BRAVAS Backend" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# URLs de servicios
$authUrl = "http://localhost:3000/api/v1"
$userUrl = "http://localhost:3001/api/v1"
$notificationUrl = "http://localhost:3006/api/v1"

# Verificar servicios
Write-Host "Verificando servicios..." -ForegroundColor Yellow
$servicesOk = @()

try {
    $r = Invoke-WebRequest -Uri "$authUrl/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] Auth Service (3000)" -ForegroundColor Green
    $servicesOk += "Auth"
} catch {
    Write-Host "  [X] Auth Service (3000) - No responde" -ForegroundColor Red
}

try {
    $r = Invoke-WebRequest -Uri "$userUrl/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] User Service (3001)" -ForegroundColor Green
    $servicesOk += "User"
} catch {
    Write-Host "  [X] User Service (3001) - No responde" -ForegroundColor Red
}

try {
    $r = Invoke-WebRequest -Uri "$notificationUrl/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] Notification Service (3006)" -ForegroundColor Green
    $servicesOk += "Notification"
} catch {
    Write-Host "  [X] Notification Service (3006) - No responde" -ForegroundColor Red
}

Write-Host ""

if ($servicesOk.Count -eq 0) {
    Write-Host "ERROR: Ningun servicio esta corriendo." -ForegroundColor Red
    Write-Host "Inicia los servicios con:" -ForegroundColor Yellow
    Write-Host "  npm run start:auth:dev" -ForegroundColor Gray
    Write-Host "  npm run start:user:dev" -ForegroundColor Gray
    Write-Host "  npm run start:notification:dev" -ForegroundColor Gray
    exit 1
}

# FLUJO 1: Registro
Write-Host "FLUJO 1: Registro de Usuario" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

if (-not ($servicesOk -contains "Auth")) {
    Write-Host "  [SKIP] Auth Service no disponible" -ForegroundColor Yellow
} else {
    $email = "test_$(Get-Random)@bravas.test"
    $password = "Test123!@#"
    
    Write-Host "  Registrando usuario: $email" -ForegroundColor Yellow
    
    $body = @{
        email = $email
        password = $password
        role = "USER"
        birthDate = "1990-01-01"
        country = "AR"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$authUrl/auth/register" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success) {
            Write-Host "  [OK] Usuario registrado exitosamente" -ForegroundColor Green
            Write-Host "    UserId: $($result.data.userId)" -ForegroundColor Gray
            
            # Intentar login
            Write-Host "  Intentando login..." -ForegroundColor Yellow
            $loginBody = @{
                email = $email
                password = $password
            } | ConvertTo-Json
            
            try {
                $loginResponse = Invoke-WebRequest -Uri "$authUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 5
                $loginResult = $loginResponse.Content | ConvertFrom-Json
                
                if ($loginResult.success) {
                    Write-Host "  [OK] Login exitoso" -ForegroundColor Green
                    $token = $loginResult.data.accessToken
                    
                    # Obtener perfil
                    if ($servicesOk -contains "User") {
                        Write-Host "  Obteniendo perfil..." -ForegroundColor Yellow
                        $headers = @{
                            "Authorization" = "Bearer $token"
                        }
                        
                        try {
                            $profileResponse = Invoke-WebRequest -Uri "$userUrl/profile" -Method GET -Headers $headers -TimeoutSec 5
                            $profileResult = $profileResponse.Content | ConvertFrom-Json
                            
                            if ($profileResult.success) {
                                Write-Host "  [OK] Perfil obtenido correctamente" -ForegroundColor Green
                            } else {
                                Write-Host "  [WARN] Perfil no disponible: $($profileResult.message)" -ForegroundColor Yellow
                            }
                        } catch {
                            Write-Host "  [WARN] No se pudo obtener perfil: $($_.Exception.Message)" -ForegroundColor Yellow
                        }
                    }
                } else {
                    Write-Host "  [WARN] Login fallo: $($loginResult.message)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "  [WARN] Login fallo: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [WARN] Registro fallo: $($result.message)" -ForegroundColor Yellow
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $errorMsg = $errorBody
        }
        Write-Host "  [ERROR] Registro fallo: $errorMsg" -ForegroundColor Red
    }
}

Write-Host ""

# FLUJO 2: Notificaciones
Write-Host "FLUJO 2: Verificar Notificaciones" -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

if (-not ($servicesOk -contains "Notification")) {
    Write-Host "  [SKIP] Notification Service no disponible" -ForegroundColor Yellow
} else {
    Write-Host "  Verificando endpoint de notificaciones..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "$notificationUrl/health" -Method GET -TimeoutSec 2
        Write-Host "  [OK] Notification Service responde correctamente" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Notification Service no responde: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Resumen
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumen de Pruebas" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Servicios verificados: $($servicesOk.Count)/3" -ForegroundColor $(if ($servicesOk.Count -eq 3) { "Green" } else { "Yellow" })
Write-Host ""
Write-Host "Para pruebas completas, asegurate de tener:" -ForegroundColor Yellow
Write-Host "  1. Todos los servicios corriendo" -ForegroundColor Gray
Write-Host "  2. DynamoDB/LocalStack configurado" -ForegroundColor Gray
Write-Host "  3. Variables de entorno configuradas" -ForegroundColor Gray
Write-Host ""

