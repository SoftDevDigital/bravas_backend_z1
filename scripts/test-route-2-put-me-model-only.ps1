# Script de Prueba: Ruta 2 PUT /users/me - Solo MODEL
# Prueba la actualizacion de perfil solo con rol MODEL

$ErrorActionPreference = "Continue"

Write-Host "Prueba: PUT /users/me (Solo MODEL)" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales MODEL
$modelEmail = "estanislaovaldez78@gmail.com"
$modelPassword = "Quelindouba2015@"

Write-Host "[INIT] Autenticando como MODEL..." -ForegroundColor Yellow

# Obtener token
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
    
    $token = $loginResponse.data.accessToken
    
    if ($token) {
        Write-Host "[OK] Token obtenido para MODEL`n" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] No se pudo obtener token`n" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Error al autenticar: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Descripcion de la ruta
Write-Host "[DESC] Actualizar mi perfil" -ForegroundColor Yellow
Write-Host "Permite actualizar la informacion del perfil del usuario autenticado" -ForegroundColor Gray
Write-Host "(nombre, bio, pais, etc.). Funciona para todos los roles.`n" -ForegroundColor Gray

# Obtener perfil actual primero
Write-Host "[INFO] Obteniendo perfil actual..." -ForegroundColor Cyan
try {
    $currentProfile = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $token" } `
        -ErrorAction Stop
    
    Write-Host "[OK] Perfil actual obtenido`n" -ForegroundColor Green
    Write-Host "Nombre actual: $($currentProfile.data.fullName)" -ForegroundColor Gray
    Write-Host "Bio actual: $($currentProfile.data.bio)`n" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] No se pudo obtener perfil actual: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Body de actualizacion - probando con diferentes campos
Write-Host "[TEST] PUT $userServiceUrl/users/me" -ForegroundColor Cyan

# Probar 1: Solo bio (mas simple)
Write-Host "`n--- PRUEBA 1: Solo bio ---" -ForegroundColor Magenta
$updateBody1 = @{
    bio = "Bio actualizada desde PowerShell - MODEL - $(Get-Date -Format 'HH:mm:ss')"
}

Write-Host "[BODY] $($updateBody1 | ConvertTo-Json -Compress)" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
        -Method PUT `
        -Headers @{ "Authorization" = "Bearer $token" } `
        -ContentType "application/json" `
        -Body ($updateBody1 | ConvertTo-Json) `
        -ErrorAction Stop
    
    Write-Host "[OK] EXITO (Status: 200)`n" -ForegroundColor Green
    Write-Host "[RESPONSE] RESPUESTA COMPLETA:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    
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
    
    Write-Host "`n[ERROR] Status: $statusCode" -ForegroundColor Red
    Write-Host "[ERROR RESPONSE]:" -ForegroundColor Red
    
    if ($errorBody) {
        if ($errorBody -is [string]) {
            Write-Host $errorBody -ForegroundColor Red
        } else {
            Write-Host ($errorBody | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
    
    Write-Host "`n[EXCEPTION] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.InnerException) {
        Write-Host "[INNER] $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
}

# Probar 2: Con fullName (puede tener validacion de patron)
Write-Host "`n`n--- PRUEBA 2: Con fullName (puede tener validacion) ---" -ForegroundColor Magenta
$updateBody2 = @{
    fullName = "Test Model Updated"
    bio = "Bio con nombre actualizado - MODEL - $(Get-Date -Format 'HH:mm:ss')"
}

Write-Host "[BODY] $($updateBody2 | ConvertTo-Json -Compress)" -ForegroundColor Gray

try {
    $response2 = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
        -Method PUT `
        -Headers @{ "Authorization" = "Bearer $token" } `
        -ContentType "application/json" `
        -Body ($updateBody2 | ConvertTo-Json) `
        -ErrorAction Stop
    
    Write-Host "[OK] EXITO (Status: 200)`n" -ForegroundColor Green
    Write-Host "[RESPONSE] RESPUESTA COMPLETA:" -ForegroundColor Cyan
    Write-Host ($response2 | ConvertTo-Json -Depth 10) -ForegroundColor White
    
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
    
    Write-Host "`n[ERROR] Status: $statusCode" -ForegroundColor Red
    Write-Host "[ERROR RESPONSE]:" -ForegroundColor Red
    
    if ($errorBody) {
        if ($errorBody -is [string]) {
            Write-Host $errorBody -ForegroundColor Red
        } else {
            Write-Host ($errorBody | ConvertTo-Json -Depth 10) -ForegroundColor Red
        }
    } else {
        Write-Host "Respuesta vacia" -ForegroundColor Red
    }
}

Write-Host "`n`n[FIN] Prueba completada" -ForegroundColor Cyan
