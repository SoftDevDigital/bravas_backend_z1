# Script para probar subida de imagen para post
# Endpoint: POST /content/posts/upload

param(
    [string]$BaseUrl = "http://localhost:3001/api/v1",
    [Parameter(Mandatory=$true)]
    [string]$Token = ""
)

Write-Host "=== PRUEBA: POST /content/posts/upload ===" -ForegroundColor Cyan
Write-Host ""

# Crear imagen de prueba (1x1 pixel JPEG)
$testImagePath = "$env:TEMP\test-post-image-$(Get-Date -Format 'yyyyMMddHHmmss').jpg"
$bytes = [System.Convert]::FromBase64String("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A")
[System.IO.File]::WriteAllBytes($testImagePath, $bytes)

Write-Host "1. Preparando imagen de prueba..." -ForegroundColor Yellow
Write-Host "   Archivo: $testImagePath" -ForegroundColor Cyan

Write-Host "`n2. Enviando request a POST /content/posts/upload..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $Token"
    }
    
    $formData = @{
        image = Get-Item $testImagePath
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/content/posts/upload" -Method Post -Headers $headers -Form $formData -ErrorAction Stop
    
    Write-Host "`n[SUCCESS] Imagen subida exitosamente!" -ForegroundColor Green
    Write-Host "`nRespuesta:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
    
    Write-Host "`nURLs generadas:" -ForegroundColor Yellow
    Write-Host "  Image URL: $($response.data.imageUrl)" -ForegroundColor Green
    Write-Host "  Image Key: $($response.data.imageKey)" -ForegroundColor Green
    
} catch {
    Write-Host "`n[ERROR] Fallo al subir imagen" -ForegroundColor Red
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
