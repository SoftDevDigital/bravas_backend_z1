# Script para crear las tablas de DynamoDB necesarias para content-service
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREAR TABLAS DYNAMODB - CONTENT SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$region = "us-east-1"
$environment = "dev"
$projectName = "bravas"

$tables = @(
    @{
        Name = "$projectName-posts-$environment"
        Key = "postId"
        GSI = @(
            @{
                Name = "userId-createdAt-index"
                HashKey = "userId"
                RangeKey = "createdAt"
            }
        )
    },
    @{
        Name = "$projectName-packs-$environment"
        Key = "packId"
        GSI = @(
            @{
                Name = "modelId-createdAt-index"
                HashKey = "modelId"
                RangeKey = "createdAt"
            }
        )
    },
    @{
        Name = "$projectName-post-likes-$environment"
        Key = "likeId"
        GSI = @(
            @{
                Name = "postId-createdAt-index"
                HashKey = "postId"
                RangeKey = "createdAt"
            },
            @{
                Name = "userId-createdAt-index"
                HashKey = "userId"
                RangeKey = "createdAt"
            }
        )
    },
    @{
        Name = "$projectName-post-comments-$environment"
        Key = "commentId"
        GSI = @(
            @{
                Name = "postId-createdAt-index"
                HashKey = "postId"
                RangeKey = "createdAt"
            },
            @{
                Name = "userId-createdAt-index"
                HashKey = "userId"
                RangeKey = "createdAt"
            }
        )
    },
    @{
        Name = "$projectName-user-follows-$environment"
        Key = "followId"
        GSI = @(
            @{
                Name = "followerId-followingId-index"
                HashKey = "followerId"
                RangeKey = "followingId"
            },
            @{
                Name = "followingId-createdAt-index"
                HashKey = "followingId"
                RangeKey = "createdAt"
            }
        )
    }
)

function Create-DynamoDBTable {
    param(
        [string]$TableName,
        [string]$KeyName,
        [array]$GSIs
    )
    
    Write-Host "Verificando tabla: $TableName" -ForegroundColor Yellow
    
    # Verificar si la tabla existe
    try {
        $existingTable = aws dynamodb describe-table --table-name $TableName --region $region 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Tabla ya existe: $TableName" -ForegroundColor Green
            return $true
        }
    } catch {
        # Tabla no existe, continuar
    }
    
    Write-Host "  Creando tabla: $TableName" -ForegroundColor Cyan
    
    # Construir el comando de creación
    $attributeDefinitions = @(
        @{AttributeName=$KeyName; AttributeType="S"}
    )
    
    # Agregar atributos para GSI
    foreach ($gsi in $GSIs) {
        $hashKeyExists = $attributeDefinitions | Where-Object { $_.AttributeName -eq $gsi.HashKey }
        if (-not $hashKeyExists) {
            $attributeDefinitions += @{AttributeName=$gsi.HashKey; AttributeType="S"}
        }
        if ($gsi.RangeKey) {
            $rangeKeyExists = $attributeDefinitions | Where-Object { $_.AttributeName -eq $gsi.RangeKey }
            if (-not $rangeKeyExists) {
                $attributeDefinitions += @{AttributeName=$gsi.RangeKey; AttributeType="S"}
            }
        }
    }
    
    # Construir JSON para attribute definitions
    $attrDefsJson = ($attributeDefinitions | ForEach-Object { 
        "{`"AttributeName`":`"$($_.AttributeName)`",`"AttributeType`":`"$($_.AttributeType)`"}"
    }) -join ","
    
    # Construir GSI definitions
    $gsiDefinitions = @()
    foreach ($gsi in $GSIs) {
        $gsiDef = @{
            IndexName = $gsi.Name
            KeySchema = @(
                @{AttributeName=$gsi.HashKey; KeyType="HASH"}
            )
            Projection = @{ProjectionType="ALL"}
        }
        if ($gsi.RangeKey) {
            $gsiDef.KeySchema += @{AttributeName=$gsi.RangeKey; KeyType="RANGE"}
        }
        $gsiDefinitions += $gsiDef
    }
    
    $gsiJson = ($gsiDefinitions | ForEach-Object {
        $keySchema = ($_.KeySchema | ForEach-Object {
            "{`"AttributeName`":`"$($_.AttributeName)`",`"KeyType`":`"$($_.KeyType)`"}"
        }) -join ","
        "{`"IndexName`":`"$($_.IndexName)`",`"KeySchema`":[$keySchema],`"Projection`":{`"ProjectionType`":`"ALL`"}}"
    }) -join ","
    
    # Crear archivo temporal con la definición
    $tableDef = @{
        TableName = $TableName
        KeySchema = @(
            @{AttributeName=$KeyName; KeyType="HASH"}
        )
        AttributeDefinitions = $attributeDefinitions
        BillingMode = "PAY_PER_REQUEST"
    }
    
    if ($gsiDefinitions.Count -gt 0) {
        $tableDef.GlobalSecondaryIndexes = $gsiDefinitions
    }
    
    $tableDefJson = $tableDef | ConvertTo-Json -Depth 10
    
    # Guardar en archivo temporal
    $tempFile = "temp-table-def-$TableName.json"
    $tableDefJson | Out-File -FilePath $tempFile -Encoding UTF8
    
    try {
        # Crear la tabla
        $result = aws dynamodb create-table --cli-input-json "file://$tempFile" --region $region 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Tabla creada exitosamente: $TableName" -ForegroundColor Green
            Write-Host "  Esperando a que la tabla esté activa..." -ForegroundColor Yellow
            aws dynamodb wait table-exists --table-name $TableName --region $region
            Write-Host "  ✓ Tabla activa: $TableName" -ForegroundColor Green
            Remove-Item $tempFile -ErrorAction SilentlyContinue
            return $true
        } else {
            Write-Host "  ✗ Error al crear tabla: $result" -ForegroundColor Red
            Remove-Item $tempFile -ErrorAction SilentlyContinue
            return $false
        }
    } catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        return $false
    }
}

# Crear cada tabla
$successCount = 0
$failCount = 0

foreach ($table in $tables) {
    Write-Host ""
    if (Create-DynamoDBTable -TableName $table.Name -KeyName $table.Key -GSIs $table.GSI) {
        $successCount++
    } else {
        $failCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMEN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tablas creadas/verificadas: $successCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "Errores: $failCount" -ForegroundColor Red
}
Write-Host ""
