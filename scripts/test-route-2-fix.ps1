# Script de Prueba: Ruta 2 CORREGIDA
# Prueba PUT /users/me usando Invoke-RestMethod que maneja mejor JSON

$ErrorActionPreference = "Continue"

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Obtener token MODEL
Write-Host "[INIT] Autenticando como MODEL..." -ForegroundColor Yellow

$loginBody = @{
    email = "estanislaovaldez78@gmail.com"
    password = "Quelindouba2015@"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginResponse.data.accessToken

Write-Host "[OK] Token obtenido`n" -ForegroundColor Green

# Descripcion
Write-Host "[DESC] Actualizar mi perfil" -ForegroundColor Yellow
Write-Host "Permite actualizar la informacion del perfil del usuario autenticado`n" -ForegroundColor Gray

# Body de actualizacion - solo campos simples sin validaciones complejas
$updateBody = @{
    bio = "Bio actualizada desde PowerShell test $(Get-Date -Format 'HH:mm:ss')"
}

Write-Host "[TEST] PUT $userServiceUrl/users/me" -ForegroundColor Cyan
Write-Host "[BODY] $($updateBody | ConvertTo-Json -Compress)`n" -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    # Usar Invoke-RestMethod que maneja JSON mejor
    $response = Invoke-RestMethod -Uri "$userServiceUrl/users/me" `
        -Method PUT `
        -Headers $headers `
        -ContentType "application/json" `
        -Body ($updateBody | ConvertTo-Json) `
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
}
