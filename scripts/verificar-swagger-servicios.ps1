# Script para verificar que todos los servicios tienen Swagger configurado correctamente
# Uso: .\scripts\verificar-swagger-servicios.ps1

Write-Host "`n🔍 VERIFICACIÓN DE SWAGGER EN TODOS LOS SERVICIOS`n" -ForegroundColor Cyan

$services = @(
    @{ Name = "Auth"; Port = 3000; Path = "/auth/register"; ExpectedServer = "http://localhost:3000/api/v1" },
    @{ Name = "User"; Port = 3001; Path = "/users"; ExpectedServer = "http://localhost:3001/api/v1" },
    @{ Name = "Payment"; Port = 3002; Path = "/payments"; ExpectedServer = "http://localhost:3002/api/v1" },
    @{ Name = "Messages"; Port = 3003; Path = "/chats"; ExpectedServer = "http://localhost:3003/api/v1" },
    @{ Name = "Contracts"; Port = 3004; Path = "/contracts"; ExpectedServer = "http://localhost:3004/api/v1" },
    @{ Name = "Content"; Port = 3005; Path = "/posts"; ExpectedServer = "http://localhost:3005/api/v1" },
    @{ Name = "Notification"; Port = 3006; Path = "/notifications"; ExpectedServer = "http://localhost:3006/api/v1" },
    @{ Name = "Admin"; Port = 3007; Path = "/admin/users"; ExpectedServer = "http://localhost:3007/api/v1" }
)

$results = @()

foreach ($service in $services) {
    Write-Host "🔍 Verificando $($service.Name) Service (Puerto $($service.Port))..." -ForegroundColor Yellow
    
    $result = @{
        Name = $service.Name
        Port = $service.Port
        Running = $false
        SwaggerAccessible = $false
        ServerUrlCorrect = $false
        ServerUrl = ""
        Errors = @()
    }
    
    try {
        # Verificar health check
        $health = Invoke-RestMethod -Uri "http://localhost:$($service.Port)/api/v1/health" -TimeoutSec 3 -ErrorAction Stop
        $result.Running = $true
        Write-Host "   ✅ Servicio corriendo" -ForegroundColor Green
    } catch {
        $result.Errors += "Servicio no está corriendo: $($_.Exception.Message)"
        Write-Host "   ❌ Servicio no está corriendo" -ForegroundColor Red
        $results += $result
        continue
    }
    
    try {
        # Verificar Swagger UI
        $swagger = Invoke-WebRequest -Uri "http://localhost:$($service.Port)/api-docs" -TimeoutSec 3 -ErrorAction Stop
        $result.SwaggerAccessible = $true
        Write-Host "   ✅ Swagger UI accesible en /api-docs" -ForegroundColor Green
    } catch {
        $result.Errors += "Swagger UI no accesible: $($_.Exception.Message)"
        Write-Host "   ❌ Swagger UI no accesible" -ForegroundColor Red
    }
    
    try {
        # Verificar OpenAPI JSON
        $openapi = Invoke-RestMethod -Uri "http://localhost:$($service.Port)/openapi.json" -TimeoutSec 3 -ErrorAction Stop
        
        if ($openapi.servers -and $openapi.servers.Count -gt 0) {
            $serverUrl = $openapi.servers[0].url
            $result.ServerUrl = $serverUrl
            
            if ($serverUrl -eq $service.ExpectedServer) {
                $result.ServerUrlCorrect = $true
                Write-Host "   ✅ Servidor en Swagger: $serverUrl" -ForegroundColor Green
                Write-Host "      ✅ URL del servidor es correcta" -ForegroundColor Green
            } else {
                $result.Errors += "URL del servidor incorrecta. Esperado: $($service.ExpectedServer), Actual: $serverUrl"
                Write-Host "   ⚠️  URL del servidor incorrecta" -ForegroundColor Yellow
                Write-Host "      Esperado: $($service.ExpectedServer)" -ForegroundColor Gray
                Write-Host "      Actual: $serverUrl" -ForegroundColor Gray
            }
        } else {
            $result.Errors += "No se encontraron servidores en el documento OpenAPI"
            Write-Host "   ⚠️  No se encontraron servidores en OpenAPI" -ForegroundColor Yellow
        }
    } catch {
        $result.Errors += "No se pudo obtener OpenAPI JSON: $($_.Exception.Message)"
        Write-Host "   ❌ No se pudo obtener OpenAPI JSON" -ForegroundColor Red
    }
    
    $results += $result
    Write-Host ""
}

# Resumen
Write-Host "`n📊 RESUMEN DE VERIFICACIÓN`n" -ForegroundColor Cyan

$totalServices = $results.Count
$runningServices = ($results | Where-Object { $_.Running }).Count
$swaggerAccessible = ($results | Where-Object { $_.SwaggerAccessible }).Count
$correctUrls = ($results | Where-Object { $_.ServerUrlCorrect }).Count

Write-Host "Total de servicios: $totalServices" -ForegroundColor White
Write-Host "Servicios corriendo: $runningServices" -ForegroundColor $(if ($runningServices -eq $totalServices) { "Green" } else { "Yellow" })
Write-Host "Swagger accesible: $swaggerAccessible" -ForegroundColor $(if ($swaggerAccessible -eq $totalServices) { "Green" } else { "Yellow" })
Write-Host "URLs correctas: $correctUrls" -ForegroundColor $(if ($correctUrls -eq $totalServices) { "Green" } else { "Yellow" })

Write-Host "`n📋 DETALLES POR SERVICIO:`n" -ForegroundColor Cyan

foreach ($result in $results) {
    $status = if ($result.Running -and $result.SwaggerAccessible -and $result.ServerUrlCorrect) {
        "✅"
    } elseif ($result.Running) {
        "⚠️"
    } else {
        "❌"
    }
    
    Write-Host "$status $($result.Name) Service (Puerto $($result.Port))" -ForegroundColor $(if ($result.Running -and $result.SwaggerAccessible -and $result.ServerUrlCorrect) { "Green" } elseif ($result.Running) { "Yellow" } else { "Red" })
    
    if ($result.ServerUrl) {
        Write-Host "   Servidor: $($result.ServerUrl)" -ForegroundColor Gray
    }
    
    if ($result.Errors.Count -gt 0) {
        foreach ($error in $result.Errors) {
            Write-Host "   ⚠️  $error" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

if ($runningServices -eq $totalServices -and $swaggerAccessible -eq $totalServices -and $correctUrls -eq $totalServices) {
    Write-Host "✅ TODOS LOS SERVICIOS ESTÁN CONFIGURADOS CORRECTAMENTE`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  ALGUNOS SERVICIOS NECESITAN ATENCIÓN`n" -ForegroundColor Yellow
    exit 1
}







