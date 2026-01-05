# Script para iniciar servicios en background usando Start-Job
# Esto permite iniciar múltiples servicios y monitorearlos

$ErrorActionPreference = "Continue"

Write-Host "🚀 Iniciando servicios BRAVAS Backend en background" -ForegroundColor Cyan
Write-Host "==================================================`n" -ForegroundColor Cyan

$services = @(
    @{ Name = "Auth"; Script = "start:auth:dev"; Port = 3000 },
    @{ Name = "User"; Script = "start:user:dev"; Port = 3001 },
    @{ Name = "Payment"; Script = "start:payment:dev"; Port = 3002 },
    @{ Name = "Messages"; Script = "start:messages:dev"; Port = 3003 },
    @{ Name = "Contracts"; Script = "start:contracts:dev"; Port = 3004 },
    @{ Name = "Content"; Script = "start:content:dev"; Port = 3005 },
    @{ Name = "Notification"; Script = "start:notification:dev"; Port = 3006 },
    @{ Name = "Admin"; Script = "start:admin:dev"; Port = 3007 }
)

$jobs = @()

foreach ($service in $services) {
    Write-Host "Iniciando $($service.Name) Service (Puerto $($service.Port))..." -ForegroundColor Yellow
    
    $job = Start-Job -ScriptBlock {
        param($scriptName, $serviceName)
        Set-Location $using:PWD
        npm run $scriptName 2>&1
    } -ArgumentList $service.Script, $service.Name
    
    $jobs += @{
        Job = $job
        Service = $service
    }
    
    Write-Host "  ✅ $($service.Name) Service iniciado (Job ID: $($job.Id))" -ForegroundColor Green
    Start-Sleep -Milliseconds 500
}

Write-Host "`n✅ Todos los servicios iniciados`n" -ForegroundColor Green
Write-Host "Esperando 10 segundos para que los servicios se inicialicen..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`nVerificando servicios..." -ForegroundColor Cyan
$healthy = 0
$unhealthy = 0

foreach ($item in $jobs) {
    $service = $item.Service
    $url = "http://localhost:$($service.Port)/api/v1/health"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ $($service.Name) Service: OK" -ForegroundColor Green
            $healthy++
        } else {
            Write-Host "  ⚠️  $($service.Name) Service: Status $($response.StatusCode)" -ForegroundColor Yellow
            $unhealthy++
        }
    } catch {
        Write-Host "  ❌ $($service.Name) Service: No responde aún" -ForegroundColor Red
        $unhealthy++
    }
}

Write-Host "`n📊 Resumen:" -ForegroundColor Cyan
Write-Host "  ✅ Servicios saludables: $healthy" -ForegroundColor Green
Write-Host "  ⚠️  Servicios no responden: $unhealthy" -ForegroundColor $(if ($unhealthy -gt 0) { "Yellow" } else { "Green" })

Write-Host "`n💡 Para ver los logs de un servicio:" -ForegroundColor Yellow
Write-Host "   Receive-Job -Id <JobId> -Keep" -ForegroundColor Gray
Write-Host "`n💡 Para detener todos los servicios:" -ForegroundColor Yellow
Write-Host "   Stop-Job -Id $($jobs.Job.Id -join ',')" -ForegroundColor Gray
Write-Host "   Remove-Job -Id $($jobs.Job.Id -join ',')" -ForegroundColor Gray
Write-Host "`n💡 Jobs activos:" -ForegroundColor Yellow
foreach ($item in $jobs) {
    Write-Host "   $($item.Service.Name): Job ID $($item.Job.Id)" -ForegroundColor Gray
}
Write-Host "`n"

