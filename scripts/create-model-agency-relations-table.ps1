# Script para crear la tabla model-agency-relations en DynamoDB local
# Ejecutar con: .\scripts\create-model-agency-relations-table.ps1

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "Creando tabla DynamoDB: bravas-model-agency-relations-dev" -ForegroundColor Magenta
Write-Host "============================================================`n" -ForegroundColor Cyan

$tableDefinition = @{
    TableName = "bravas-model-agency-relations-dev"
    AttributeDefinitions = @(
        @{ AttributeName = "modelId"; AttributeType = "S" }
        @{ AttributeName = "agencyId"; AttributeType = "S" }
        @{ AttributeName = "status"; AttributeType = "S" }
    )
    KeySchema = @(
        @{ AttributeName = "modelId"; KeyType = "HASH" }
        @{ AttributeName = "agencyId"; KeyType = "RANGE" }
    )
    BillingMode = "PAY_PER_REQUEST"
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "agencyId-index"
            KeySchema = @(
                @{ AttributeName = "agencyId"; KeyType = "HASH" }
                @{ AttributeName = "modelId"; KeyType = "RANGE" }
            )
            Projection = @{ ProjectionType = "ALL" }
        },
        @{
            IndexName = "agencyId-status-index"
            KeySchema = @(
                @{ AttributeName = "agencyId"; KeyType = "HASH" }
                @{ AttributeName = "status"; KeyType = "RANGE" }
            )
            Projection = @{ ProjectionType = "ALL" }
        },
        @{
            IndexName = "status-index"
            KeySchema = @(
                @{ AttributeName = "status"; KeyType = "HASH" }
            )
            Projection = @{ ProjectionType = "ALL" }
        }
    )
}

Write-Host "Configuración de la tabla:" -ForegroundColor Yellow
Write-Host "  - TableName: $($tableDefinition.TableName)" -ForegroundColor Gray
Write-Host "  - HashKey: modelId" -ForegroundColor Gray
Write-Host "  - RangeKey: agencyId" -ForegroundColor Gray
Write-Host "  - GSI: agencyId-index, agencyId-status-index, status-index`n" -ForegroundColor Gray

# Verificar si AWS CLI está instalado
try {
    $awsVersion = aws --version 2>&1
    Write-Host "AWS CLI encontrado: $awsVersion`n" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS CLI no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "Por favor, instala AWS CLI: https://aws.amazon.com/cli/`n" -ForegroundColor Yellow
    exit 1
}

# Determinar endpoint de DynamoDB (local o AWS)
$endpoint = $env:AWS_ENDPOINT_URL
if (-not $endpoint) {
    # Por defecto, intentar DynamoDB local en el puerto estándar
    $endpoint = "http://localhost:8000"
    Write-Host "No se encontró AWS_ENDPOINT_URL, usando DynamoDB local por defecto: $endpoint" -ForegroundColor Yellow
} else {
    Write-Host "Usando endpoint: $endpoint" -ForegroundColor Green
}

Write-Host "`nCreando tabla...`n" -ForegroundColor Yellow

try {
    # Convertir a JSON
    $jsonDefinition = $tableDefinition | ConvertTo-Json -Depth 10 -Compress
    
    # Crear tabla usando AWS CLI
    $result = aws dynamodb create-table `
        --cli-input-json $jsonDefinition `
        --endpoint-url $endpoint `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "✅ Tabla creada exitosamente!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Green
        Write-Host "`nResultado:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
        
        Write-Host "`n⚠️  NOTA: Espera unos segundos hasta que la tabla esté activa antes de usarla." -ForegroundColor Yellow
        Write-Host "Puedes verificar el estado con:" -ForegroundColor Cyan
        Write-Host "  aws dynamodb describe-table --table-name $($tableDefinition.TableName) --endpoint-url $endpoint`n" -ForegroundColor Gray
    } else {
        if ($result -match "ResourceInUseException") {
            Write-Host "============================================================" -ForegroundColor Yellow
            Write-Host "⚠️  La tabla ya existe" -ForegroundColor Yellow
            Write-Host "============================================================" -ForegroundColor Yellow
            Write-Host "`nEsto está bien - la tabla ya está creada.`n" -ForegroundColor Green
        } else {
            Write-Host "============================================================" -ForegroundColor Red
            Write-Host "❌ Error al crear la tabla:" -ForegroundColor Red
            Write-Host "============================================================" -ForegroundColor Red
            Write-Host $result -ForegroundColor Yellow
            exit 1
        }
    }
} catch {
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "❌ Error al crear la tabla:" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
