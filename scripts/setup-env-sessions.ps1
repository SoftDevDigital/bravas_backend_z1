# Script PowerShell para configurar DYNAMODB_USER_SESSIONS_TABLE
# Ejecuta: .\scripts\setup-env-sessions.ps1

$envFile = ".env.dev"
$requiredVar = "DYNAMODB_USER_SESSIONS_TABLE"
$requiredValue = "bravas-user-sessions-dev"

Write-Host "🔧 Configurando variable de entorno para sesiones..." -ForegroundColor Cyan
Write-Host ""

# Verificar si el archivo existe
if (Test-Path $envFile) {
    Write-Host "✅ Archivo $envFile encontrado" -ForegroundColor Green
    
    # Leer el contenido
    $content = Get-Content $envFile -Raw
    
    # Verificar si la variable ya existe
    if ($content -match "$requiredVar\s*=") {
        Write-Host "⚠️  La variable $requiredVar ya existe" -ForegroundColor Yellow
        Write-Host "   Verificando valor..." -ForegroundColor Yellow
        
        # Extraer el valor actual
        if ($content -match "$requiredVar\s*=\s*([^\s\r\n]+)") {
            $currentValue = $matches[1].Trim()
            if ($currentValue -eq $requiredValue) {
                Write-Host "✅ La variable ya tiene el valor correcto: $currentValue" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Valor actual: $currentValue" -ForegroundColor Yellow
                Write-Host "   Valor esperado: $requiredValue" -ForegroundColor Yellow
                Write-Host ""
                $update = Read-Host "¿Deseas actualizar el valor? (S/N)"
                if ($update -eq "S" -or $update -eq "s") {
                    $content = $content -replace "$requiredVar\s*=.*", "$requiredVar=$requiredValue"
                    Set-Content -Path $envFile -Value $content -NoNewline
                    Write-Host "✅ Variable actualizada" -ForegroundColor Green
                }
            }
        }
    } else {
        Write-Host "➕ Agregando variable $requiredVar..." -ForegroundColor Cyan
        Add-Content -Path $envFile -Value "`n# DynamoDB User Sessions Table`n$requiredVar=$requiredValue"
        Write-Host "✅ Variable agregada" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Archivo $envFile NO encontrado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opciones:" -ForegroundColor Yellow
    Write-Host "1. Crear archivo nuevo desde .env.dev.example" -ForegroundColor Yellow
    Write-Host "2. Crear archivo mínimo con solo esta variable" -ForegroundColor Yellow
    Write-Host ""
    $option = Read-Host "Selecciona opcion (1 o 2)"
    
    if ($option -eq "1") {
        if (Test-Path ".env.dev.example") {
            Copy-Item ".env.dev.example" $envFile
            Write-Host "✅ Archivo creado desde .env.dev.example" -ForegroundColor Green
            Write-Host "   Completa las credenciales en $envFile" -ForegroundColor Yellow
        } else {
            Write-Host "❌ .env.dev.example no encontrado" -ForegroundColor Red
        }
    } else {
        # Crear archivo mínimo
        $minimalContent = @"
# BRAVAS Backend - Variables de Entorno DEV
# Configuración mínima para sesiones

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=TU_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=TU_SECRET_ACCESS_KEY

# DynamoDB Tables
$requiredVar=$requiredValue
"@
        Set-Content -Path $envFile -Value $minimalContent
        Write-Host "✅ Archivo mínimo creado" -ForegroundColor Green
        Write-Host "   Completa las credenciales AWS en $envFile" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📝 Próximo paso:" -ForegroundColor Cyan
Write-Host "   1. Verifica que $envFile tiene todas las credenciales necesarias" -ForegroundColor White
Write-Host "   2. Ejecuta: npm run verify:sessions" -ForegroundColor White
Write-Host "   3. Si todo está bien, inicia el servicio: npm run start:auth:dev" -ForegroundColor White

