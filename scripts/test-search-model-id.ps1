# Script para buscar un modelo específico por ID
# Uso: .\test-search-model-id.ps1

$modelId = "c0b203fd-eff1-43e1-901d-f74089818246"
$baseUrl = "http://localhost:3001/api/v1"

Write-Host "🔍 Buscando modelo con ID: $modelId" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

# Verificar si el servicio está corriendo
Write-Host "`n1. Verificando conexión con el servicio..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Servicio disponible" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  No se pudo verificar el servicio (continuando de todas formas)" -ForegroundColor Yellow
}

# Buscar el modelo por ID
Write-Host "`n2. Buscando modelo por ID..." -ForegroundColor Yellow
Write-Host "   Endpoint: GET $baseUrl/users/models/$modelId" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/users/models/$modelId" -Method GET -ContentType "application/json" -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "   ✅ Modelo encontrado!" -ForegroundColor Green
        Write-Host "`n   📋 Información del modelo:" -ForegroundColor Cyan
        Write-Host "      - UserId: $($response.data.userId)" -ForegroundColor Gray
        Write-Host "      - Email: $($response.data.email)" -ForegroundColor Gray
        Write-Host "      - Nombre: $($response.data.fullName)" -ForegroundColor Gray
        Write-Host "      - Rol: $($response.data.role)" -ForegroundColor Gray
        Write-Host "      - Verificado: $($response.data.verified)" -ForegroundColor Gray
        Write-Host "      - Bio: $($response.data.bio)" -ForegroundColor Gray
        Write-Host "      - País: $($response.data.country)" -ForegroundColor Gray
        Write-Host "      - Avatar: $($response.data.avatarUrl)" -ForegroundColor Gray
        
        if ($response.data.stats) {
            Write-Host "`n   📊 Estadísticas:" -ForegroundColor Cyan
            Write-Host "      - Reputación: $($response.data.stats.reputation)" -ForegroundColor Gray
            Write-Host "      - Ventas totales: $($response.data.stats.totalSales)" -ForegroundColor Gray
            Write-Host "      - Ganancias totales: $($response.data.stats.totalEarnings)" -ForegroundColor Gray
        }
        
        Write-Host "`n   📄 Respuesta completa:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor DarkGray
        
    } else {
        Write-Host "   ❌ Respuesta sin éxito: $($response.message)" -ForegroundColor Red
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host "   ❌ Error al buscar modelo" -ForegroundColor Red
    Write-Host "      Código de estado: $statusCode" -ForegroundColor Red
    
    # Intentar obtener el mensaje de error del cuerpo de la respuesta
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $errorObj = $responseBody | ConvertFrom-Json
        Write-Host "      Mensaje: $($errorObj.message)" -ForegroundColor Red
        
        if ($errorObj.error) {
            Write-Host "      Error detallado: $($errorObj.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "      Mensaje: $errorMessage" -ForegroundColor Red
    }
    
    Write-Host "`n   🔍 Diagnóstico:" -ForegroundColor Yellow
    Write-Host "      - Verifica que el ID sea correcto: $modelId" -ForegroundColor Gray
    Write-Host "      - Verifica que el modelo exista en la base de datos" -ForegroundColor Gray
    Write-Host "      - Verifica que el modelo tenga rol 'MODEL' o 'model'" -ForegroundColor Gray
    Write-Host "      - Verifica los logs del servicio para más detalles" -ForegroundColor Gray
}

Write-Host "`n" -NoNewline
