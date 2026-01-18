# Script de Prueba: Ruta 2 con debugging
# Prueba PUT /users/me para ver el error real

$ErrorActionPreference = "Continue"

$userServiceUrl = "http://localhost:3001/api/v1"
$authServiceUrl = "http://localhost:3000/api/v1"

# Obtener token MODEL
$loginBody = @{
    email = "estanislaovaldez78@gmail.com"
    password = "Quelindouba2015@"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$authServiceUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginResponse.data.accessToken

Write-Host "[TEST] Probando PUT /users/me" -ForegroundColor Cyan
Write-Host "[TOKEN] Obtenido correctamente`n" -ForegroundColor Green

# Probar con body simple
$updateBody = @{
    fullName = "Test Model"
    bio = "Test bio"
} | ConvertTo-Json

Write-Host "[BODY] $updateBody`n" -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-WebRequest -Uri "$userServiceUrl/users/me" `
        -Method PUT `
        -Headers $headers `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($updateBody)) `
        -ErrorAction Stop
    
    Write-Host "[OK] SUCCESS: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
    
} catch {
    $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "None" }
    
    Write-Host "`n[ERROR] Status: $statusCode" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorText = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        Write-Host "[ERROR BODY]:" -ForegroundColor Yellow
        Write-Host $errorText
        
        # Intentar parsear
        if ($errorText -and $errorText.Trim() -ne "") {
            try {
                $errorObj = $errorText | ConvertFrom-Json
                Write-Host "`n[ERROR PARSED]:" -ForegroundColor Yellow
                Write-Host ($errorObj | ConvertTo-Json -Depth 10)
            } catch {
                Write-Host "[NOT JSON] $errorText"
            }
        }
    }
    
    Write-Host "`n[EXCEPTION] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.InnerException) {
        Write-Host "[INNER] $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
}
