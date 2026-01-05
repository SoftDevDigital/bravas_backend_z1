# Script de Verificación de Servicios - BRAVAS Backend
# Verifica que todos los servicios estén funcionando correctamente

Write-Host "🔍 Verificación de Servicios BRAVAS Backend" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$services = @(
    @{ Name = "Auth Service"; Port = 3000; Path = "/api/v1/health" },
    @{ Name = "User Service"; Port = 3001; Path = "/api/v1/health" },
    @{ Name = "Payment Service"; Port = 3002; Path = "/api/v1/health" },
    @{ Name = "Messages Service"; Port = 3003; Path = "/api/v1/health" },
    @{ Name = "Contracts Service"; Port = 3004; Path = "/api/v1/health" },
    @{ Name = "Content Service"; Port = 3005; Path = "/api/v1/health" },
    @{ Name = "Notification Service"; Port = 3006; Path = "/api/v1/health" },
    @{ Name = "Admin Service"; Port = 3007; Path = "/api/v1/health" }
)

$results = @()

foreach ($service in $services) {
    $url = "http://localhost:$($service.Port)$($service.Path)"
    Write-Host "Verificando $($service.Name)..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅ OK" -ForegroundColor Green
            $results += @{
                Service = $service.Name
                Status = "OK"
                Port = $service.Port
            }
        } else {
            Write-Host " ⚠️  Status: $($response.StatusCode)" -ForegroundColor Yellow
            $results += @{
                Service = $service.Name
                Status = "WARNING"
                Port = $service.Port
            }
        }
    } catch {
        Write-Host " ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{
            Service = $service.Name
            Status = "ERROR"
            Port = $service.Port
            Error = $_.Exception.Message
        }
    }
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "📊 Resumen de Verificación" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

$okCount = ($results | Where-Object { $_.Status -eq "OK" }).Count
$warningCount = ($results | Where-Object { $_.Status -eq "WARNING" }).Count
$errorCount = ($results | Where-Object { $_.Status -eq "ERROR" }).Count

Write-Host "✅ Servicios OK: $okCount" -ForegroundColor Green
Write-Host "⚠️  Servicios con Advertencias: $warningCount" -ForegroundColor Yellow
Write-Host "❌ Servicios con Errores: $errorCount`n" -ForegroundColor Red

if ($errorCount -gt 0) {
    Write-Host "Servicios con errores:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "ERROR" } | ForEach-Object {
        Write-Host "  - $($_.Service) (Puerto $($_.Port)): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "`n💡 Para iniciar los servicios, usa:" -ForegroundColor Cyan
Write-Host "  npm run start:auth:dev      # Puerto 3000" -ForegroundColor Gray
Write-Host "  npm run start:user:dev      # Puerto 3001" -ForegroundColor Gray
Write-Host "  npm run start:payment:dev    # Puerto 3002" -ForegroundColor Gray
Write-Host "  npm run start:messages:dev  # Puerto 3003" -ForegroundColor Gray
Write-Host "  npm run start:contracts:dev  # Puerto 3004" -ForegroundColor Gray
Write-Host "  npm run start:content:dev   # Puerto 3005" -ForegroundColor Gray
Write-Host "  npm run start:notification:dev # Puerto 3006" -ForegroundColor Gray
Write-Host "  npm run start:admin:dev     # Puerto 3007" -ForegroundColor Gray

