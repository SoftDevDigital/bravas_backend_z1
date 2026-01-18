# Script para probar subida de avatar
# Endpoint: POST /users/me/avatar

param(
    [string]$BaseUrl = "http://localhost:3001/api/v1",
    [Parameter(Mandatory=$true)]
    [string]$Token = ""
)

Write-Host "=== PRUEBA: POST /users/me/avatar ===" -ForegroundColor Cyan
Write-Host ""

# Crear imagen de prueba (1x1 pixel JPEG)
$testImagePath = "$env:TEMP\test-avatar-$(Get-Date -Format 'yyyyMMddHHmmss').jpg"
$bytes = [System.Convert]::FromBase64String("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A")
[System.IO.File]::WriteAllBytes($testImagePath, $bytes)

Write-Host "1. Preparando imagen de prueba..." -ForegroundColor Yellow
Write-Host "   Archivo: $testImagePath" -ForegroundColor Cyan

Write-Host "`n2. Enviando request a POST /users/me/avatar..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
    
    $formData = @{
        file = Get-Item $testImagePath
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/users/me/avatar" -Method Post -Headers $headers -Form $formData -ErrorAction Stop
    
    Write-Host "`n[SUCCESS] Avatar subido exitosamente!" -ForegroundColor Green
    Write-Host "`nRespuesta:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
    
    Write-Host "`nURLs generadas:" -ForegroundColor Yellow
    Write-Host "  Avatar URL: $($response.avatarUrl)" -ForegroundColor Green
    Write-Host "  Thumbnail URL: $($response.thumbnailUrl)" -ForegroundColor Green
    if ($response.sizes) {
        Write-Host "`n  Tamaños disponibles:" -ForegroundColor Cyan
        $response.sizes.PSObject.Properties | ForEach-Object {
            Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "`n[ERROR] Fallo al subir avatar" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "  Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Mensaje: $($errorJson.message)" -ForegroundColor Yellow
        } catch {
            Write-Host "  Respuesta completa: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
    }
    if ($_.Response) {
        Write-Host "  Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    }
}

# Limpiar
Remove-Item $testImagePath -ErrorAction SilentlyContinue

Write-Host "`n=== PRUEBA COMPLETADA ===" -ForegroundColor Cyan
