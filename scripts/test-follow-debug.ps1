# Script de Debug: Probar follow/unfollow para USER
# Ver exactamente qué está pasando

$ErrorActionPreference = "Continue"

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Credenciales USER
$userEmail = "alexis.correa026@gmail.com"
$userPassword = "Password123!"

Write-Host "[INIT] Autenticando como USER..." -ForegroundColor Yellow

# Obtener token
$loginBody = @{
    email = $userEmail
    password = $userPassword
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginResponse.data.accessToken

Write-Host "[OK] Token obtenido`n" -ForegroundColor Green

# Obtener modelId
Write-Host "[INFO] Obteniendo lista de modelos..." -ForegroundColor Cyan
$modelsResponse = Invoke-RestMethod -Uri "$userServiceUrl/users/models?limit=1" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $token" }

if ($modelsResponse.data -and $modelsResponse.data.Count -gt 0) {
    $modelId = $modelsResponse.data[0].userId
    Write-Host "[OK] Model ID: $modelId`n" -ForegroundColor Green
    
    # Verificar perfil del modelo para confirmar que existe
    Write-Host "[INFO] Verificando perfil del modelo..." -ForegroundColor Cyan
    try {
        $modelProfile = Invoke-RestMethod -Uri "$userServiceUrl/users/models/$modelId" `
            -Method GET `
            -ErrorAction Stop
        Write-Host "[OK] Modelo existe, rol: $($modelProfile.data.role)`n" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] No se pudo obtener perfil del modelo: $($_.Exception.Message)`n" -ForegroundColor Red
        exit
    }
    
    # Probar FOLLOW
    Write-Host "`n===========================================" -ForegroundColor Magenta
    Write-Host "PROBANDO POST /users/models/$modelId/follow" -ForegroundColor Magenta
    Write-Host "===========================================" -ForegroundColor Magenta
    
    try {
        # Probar primero sin Content-Type ya que no hay body
        $followResponse = Invoke-WebRequest -Uri "$userServiceUrl/users/models/$modelId/follow" `
            -Method POST `
            -Headers @{ "Authorization" = "Bearer $token" } `
            -ErrorAction Stop
        
        Write-Host "[OK] EXITO (Status: $($followResponse.StatusCode))" -ForegroundColor Green
        Write-Host "[RESPONSE]:" -ForegroundColor Cyan
        Write-Host ($followResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10) -ForegroundColor White
        
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
                
                Write-Host "[ERROR] Status: $statusCode" -ForegroundColor Red
                Write-Host "[ERROR RESPONSE RAW]:" -ForegroundColor Yellow
                Write-Host $errorText -ForegroundColor Red
                
                if ($errorText -and $errorText.Trim() -ne "") {
                    try {
                        $errorBody = $errorText | ConvertFrom-Json
                        Write-Host "[ERROR RESPONSE PARSED]:" -ForegroundColor Yellow
                        Write-Host ($errorBody | ConvertTo-Json -Depth 10) -ForegroundColor Red
                    } catch {
                        Write-Host "[ERROR] No es JSON: $errorText" -ForegroundColor Red
                    }
                } else {
                    Write-Host "[ERROR] Respuesta vacia" -ForegroundColor Red
                }
            } catch {
                Write-Host "[ERROR] No se pudo leer respuesta: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "[ERROR] No hay Response en la excepcion: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host "`n[EXCEPTION] $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.InnerException) {
            Write-Host "[INNER] $($_.Exception.InnerException.Message)" -ForegroundColor Red
        }
    }
    
    # Probar UNFOLLOW (después de seguir)
    Write-Host "`n`n===========================================" -ForegroundColor Magenta
    Write-Host "PROBANDO DELETE /users/models/$modelId/follow" -ForegroundColor Magenta
    Write-Host "===========================================" -ForegroundColor Magenta
    
    Start-Sleep -Seconds 2
    
    try {
        # DELETE también sin Content-Type ya que no hay body
        $unfollowResponse = Invoke-WebRequest -Uri "$userServiceUrl/users/models/$modelId/follow" `
            -Method DELETE `
            -Headers @{ "Authorization" = "Bearer $token" } `
            -ErrorAction Stop
        
        Write-Host "[OK] EXITO (Status: $($unfollowResponse.StatusCode))" -ForegroundColor Green
        Write-Host "[RESPONSE]:" -ForegroundColor Cyan
        Write-Host ($unfollowResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10) -ForegroundColor White
        
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
                
                Write-Host "[ERROR] Status: $statusCode" -ForegroundColor Red
                Write-Host "[ERROR RESPONSE RAW]:" -ForegroundColor Yellow
                Write-Host $errorText -ForegroundColor Red
                
                if ($errorText -and $errorText.Trim() -ne "") {
                    try {
                        $errorBody = $errorText | ConvertFrom-Json
                        Write-Host "[ERROR RESPONSE PARSED]:" -ForegroundColor Yellow
                        Write-Host ($errorBody | ConvertTo-Json -Depth 10) -ForegroundColor Red
                    } catch {
                        Write-Host "[ERROR] No es JSON: $errorText" -ForegroundColor Red
                    }
                } else {
                    Write-Host "[ERROR] Respuesta vacia" -ForegroundColor Red
                }
            } catch {
                Write-Host "[ERROR] No se pudo leer respuesta: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "[ERROR] No hay Response en la excepcion: $($_.Exception.Message)" -ForegroundColor Red
        }
        
        Write-Host "`n[EXCEPTION] $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "[ERROR] No se encontraron modelos para probar" -ForegroundColor Red
}
