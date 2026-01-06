# Script de diagnóstico para problemas con el endpoint de registro
# Uso: .\scripts\diagnostico-register.ps1

Write-Host "`n🔍 DIAGNÓSTICO: Endpoint de Registro`n" -ForegroundColor Cyan

# 1. Verificar que el servicio esté corriendo
Write-Host "1️⃣ Verificando si el Auth Service está corriendo..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Auth Service está corriendo" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Auth Service NO está corriendo en puerto 3000" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "`n   💡 Solución: Inicia el servicio con:" -ForegroundColor Cyan
    Write-Host "   npm run start:auth:dev" -ForegroundColor White
    exit 1
}

# 2. Probar registro con datos válidos
Write-Host "`n2️⃣ Probando registro con datos válidos..." -ForegroundColor Yellow
$testEmail = "test_diagnostico_$(Get-Random)@example.com"
$body = @{
    email = $testEmail
    password = "Test123!@#"
    role = "user"
    birthDate = "1990-01-01"
    country = "AR"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction Stop
    
    if ($response.success) {
        Write-Host "   ✅ Registro exitoso" -ForegroundColor Green
        Write-Host "   Email: $($response.email)" -ForegroundColor Gray
        Write-Host "   CognitoSub: $($response.cognitoSub)" -ForegroundColor Gray
        Write-Host "   RequiresVerification: $($response.requiresVerification)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Registro falló" -ForegroundColor Yellow
        $response | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "   ❌ Error en registro" -ForegroundColor Red
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "`n   Detalles del error:" -ForegroundColor Yellow
        Write-Host "   Message: $($errorDetails.message)" -ForegroundColor Red
        if ($errorDetails.statusCode) {
            Write-Host "   Status Code: $($errorDetails.statusCode)" -ForegroundColor Red
        }
        if ($errorDetails.error) {
            Write-Host "   Error: $($errorDetails.error)" -ForegroundColor Red
        }
        
        # Diagnóstico específico por tipo de error
        if ($errorDetails.message -like "*email*" -or $errorDetails.message -like "*Email*") {
            Write-Host "`n   💡 Problema: Email inválido o ya registrado" -ForegroundColor Cyan
            Write-Host "   - Verifica que el email tenga formato válido" -ForegroundColor White
            Write-Host "   - Verifica que el email no esté ya registrado" -ForegroundColor White
        }
        
        if ($errorDetails.message -like "*password*" -or $errorDetails.message -like "*contraseña*") {
            Write-Host "`n   💡 Problema: Contraseña inválida" -ForegroundColor Cyan
            Write-Host "   - La contraseña debe tener mínimo 8 caracteres" -ForegroundColor White
        }
        
        if ($errorDetails.message -like "*edad*" -or $errorDetails.message -like "*age*" -or $errorDetails.message -like "*mayor*") {
            Write-Host "`n   💡 Problema: Usuario menor de edad" -ForegroundColor Cyan
            Write-Host "   - El usuario debe ser mayor de 18 años" -ForegroundColor White
            Write-Host "   - Verifica la fecha de nacimiento (formato: YYYY-MM-DD)" -ForegroundColor White
        }
        
        if ($errorDetails.message -like "*rol*" -or $errorDetails.message -like "*role*") {
            Write-Host "`n   💡 Problema: Rol inválido" -ForegroundColor Cyan
            Write-Host "   - Roles válidos: 'user', 'model', 'agency'" -ForegroundColor White
            Write-Host "   - Los roles administrativos no se pueden registrar públicamente" -ForegroundColor White
        }
        
        if ($errorDetails.message -like "*Cognito*" -or $errorDetails.message -like "*AWS*") {
            Write-Host "`n   💡 Problema: Error de configuración AWS Cognito" -ForegroundColor Cyan
            Write-Host "   - Verifica las credenciales de AWS en .env o credentials.json" -ForegroundColor White
            Write-Host "   - Verifica que el User Pool de Cognito esté configurado correctamente" -ForegroundColor White
        }
    } else {
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 3. Probar validaciones comunes
Write-Host "`n3️⃣ Probando validaciones comunes..." -ForegroundColor Yellow

# Email inválido
Write-Host "   a) Email inválido..." -ForegroundColor Gray
$invalidEmailBody = @{
    email = "email-invalido"
    password = "Test123!@#"
    role = "user"
    birthDate = "1990-01-01"
    country = "AR"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body $invalidEmailBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop | Out-Null
    Write-Host "      ⚠️  Debería haber fallado pero no falló" -ForegroundColor Yellow
} catch {
    Write-Host "      ✅ Validación de email funciona correctamente" -ForegroundColor Green
}

# Contraseña corta
Write-Host "   b) Contraseña corta..." -ForegroundColor Gray
$shortPasswordBody = @{
    email = "test_$(Get-Random)@example.com"
    password = "123"
    role = "user"
    birthDate = "1990-01-01"
    country = "AR"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body $shortPasswordBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop | Out-Null
    Write-Host "      ⚠️  Debería haber fallado pero no falló" -ForegroundColor Yellow
} catch {
    Write-Host "      ✅ Validación de contraseña funciona correctamente" -ForegroundColor Green
}

# Usuario menor de edad
Write-Host "   c) Usuario menor de edad..." -ForegroundColor Gray
$minorBody = @{
    email = "test_$(Get-Random)@example.com"
    password = "Test123!@#"
    role = "user"
    birthDate = "2010-01-01"
    country = "AR"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/register" -Method POST -Body $minorBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop | Out-Null
    Write-Host "      ⚠️  Debería haber fallado pero no falló" -ForegroundColor Yellow
} catch {
    Write-Host "      ✅ Validación de edad funciona correctamente" -ForegroundColor Green
}

# 4. Verificar formato de request
Write-Host "`n4️⃣ Formato correcto del request:" -ForegroundColor Yellow
Write-Host @"
   POST http://localhost:3000/api/v1/auth/register
   Content-Type: application/json
   
   {
     "email": "usuario@example.com",
     "password": "Password123!",
     "role": "user",
     "birthDate": "1990-01-01",
     "country": "AR"
   }
"@ -ForegroundColor White

Write-Host "`n✅ Diagnóstico completado`n" -ForegroundColor Green





