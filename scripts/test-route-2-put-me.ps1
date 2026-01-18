# Script de Prueba: Ruta 2 del User Service
# Prueba PUT /users/me con los 3 roles (MODEL, AGENCY, USER)

$ErrorActionPreference = "Continue"

Write-Host "Prueba: PUT /users/me (Actualizar perfil)" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

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

# Funcion para obtener token
function Get-AuthToken {
    param($email, $password)
    
    try {
        $loginBody = @{
            email = $email
            password = $password
        } | ConvertTo-Json
        
        $loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $loginBody `
            -ErrorAction Stop
        
        return $loginResponse.data.accessToken
    } catch {
        return $null
    }
}

# Descripcion de la ruta
Write-Host "[DESC] Actualizar mi perfil" -ForegroundColor Yellow
Write-Host "Permite actualizar la informacion del perfil del usuario autenticado" -ForegroundColor Gray
Write-Host "(nombre, bio, pais, etc.). Funciona para todos los roles.`n" -ForegroundColor Gray

# Probar con cada rol
$roles = @("MODEL", "AGENCY", "USER")

foreach ($role in $roles) {
    Write-Host "`n" + ("="*70) -ForegroundColor Magenta
    Write-Host "PROBANDO CON ROL: $role" -ForegroundColor Magenta
    Write-Host ("="*70) -ForegroundColor Magenta
    
    Write-Host "`n[INIT] Autenticando como $role..." -ForegroundColor Yellow
    
    # Obtener token
    $token = Get-AuthToken -email $creds[$role].email -password $creds[$role].password
    
    if (-not $token) {
        Write-Host "[ERROR] No se pudo obtener token para $role`n" -ForegroundColor Red
        continue
    }
    
    Write-Host "[OK] Token obtenido`n" -ForegroundColor Green
    
    # Preparar body de actualizacion
    $updateBody = @{
        fullName = "Test $role Updated - $(Get-Date -Format 'HH:mm:ss')"
        bio = "Bio actualizada desde prueba con rol $role"
        country = if ($role -eq "MODEL") { "AR" } elseif ($role -eq "AGENCY") { "MX" } else { "CO" }
    }
    
    # Probar la ruta
    Write-Host "[TEST] PUT $userServiceUrl/users/me" -ForegroundColor Cyan
    Write-Host "[BODY] $($updateBody | ConvertTo-Json -Compress)" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $bodyJson = $updateBody | ConvertTo-Json -Depth 10
        
        $response = Invoke-WebRequest -Uri "$userServiceUrl/users/me" `
            -Method PUT `
            -Headers $headers `
            -Body $bodyJson `
            -ErrorAction Stop
        
        $responseBody = $response.Content | ConvertFrom-Json
        
        Write-Host "`n[OK] EXITO (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "[RESPONSE] RESPUESTA COMPLETA:" -ForegroundColor Cyan
        Write-Host "`n$($responseBody | ConvertTo-Json -Depth 10)" -ForegroundColor White
        
    } catch {
        $statusCode = $null
        $errorBody = $null
        
        $statusCode = "No Status Code"
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
                    # Intentar parsear como JSON
                    try {
                        $errorBody = $errorText | ConvertFrom-Json
                    } catch {
                        $errorBody = $errorText
                    }
                } else {
                    $errorBody = "Respuesta vacia"
                }
            } catch {
                $errorBody = "Error al leer respuesta: $($_.Exception.Message)"
            }
        }
        
        if (-not $errorBody) {
            $errorBody = $_.Exception.Message
        }
        
        Write-Host "`n[ERROR] ERROR (Status: $statusCode)" -ForegroundColor Red
        Write-Host "[ERROR RESPONSE] RESPUESTA DE ERROR:" -ForegroundColor Red
        
        if ($errorBody -is [string]) {
            Write-Host "`n$errorBody" -ForegroundColor Red
        } elseif ($errorBody) {
            Write-Host "`n$($errorBody | ConvertTo-Json -Depth 10)" -ForegroundColor Red
        } else {
            Write-Host "`nError sin detalles disponibles" -ForegroundColor Red
        }
    }
}

Write-Host "`n`n" + ("="*70) -ForegroundColor Magenta
Write-Host "[FIN] Prueba completada para todos los roles" -ForegroundColor Cyan
Write-Host ("="*70) -ForegroundColor Magenta
