# Script para iniciar todos los servicios en background
# Usa este script para iniciar todos los servicios de una vez

Write-Host "🚀 Iniciando todos los servicios BRAVAS Backend" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

$services = @(
    @{ Name = "Auth Service"; Script = "start:auth:dev"; Port = 3000 },
    @{ Name = "User Service"; Script = "start:user:dev"; Port = 3001 },
    @{ Name = "Payment Service"; Script = "start:payment:dev"; Port = 3002 },
    @{ Name = "Messages Service"; Script = "start:messages:dev"; Port = 3003 },
    @{ Name = "Contracts Service"; Script = "start:contracts:dev"; Port = 3004 },
    @{ Name = "Content Service"; Script = "start:content:dev"; Port = 3005 },
    @{ Name = "Notification Service"; Script = "start:notification:dev"; Port = 3006 },
    @{ Name = "Admin Service"; Script = "start:admin:dev"; Port = 3007 }
)

Write-Host "⚠️  NOTA: Este script inicia los servicios en background." -ForegroundColor Yellow
Write-Host "   Para ver los logs, inicia cada servicio en una terminal separada.`n" -ForegroundColor Yellow

$startServices = Read-Host "¿Deseas iniciar todos los servicios? (S/N)"

if ($startServices -ne "S" -and $startServices -ne "s") {
    Write-Host "Operación cancelada." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nIniciando servicios...`n" -ForegroundColor Yellow

foreach ($service in $services) {
    Write-Host "Iniciando $($service.Name) (Puerto $($service.Port))..." -ForegroundColor Gray
    
    # Iniciar en background usando Start-Process
    $process = Start-Process -FilePath "npm" -ArgumentList "run", $service.Script -PassThru -WindowStyle Minimized
    
    if ($process) {
        Write-Host "  ✅ $($service.Name) iniciado (PID: $($process.Id))" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "  ❌ Error al iniciar $($service.Name)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Servicios iniciados" -ForegroundColor Green
Write-Host "`n💡 Espera unos segundos para que los servicios se inicialicen completamente." -ForegroundColor Yellow
Write-Host "   Luego ejecuta: .\scripts\verify-services.ps1" -ForegroundColor Yellow
Write-Host "`n"

