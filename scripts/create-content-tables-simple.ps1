# Script simple para crear tablas de DynamoDB para content-service
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CREAR TABLAS DYNAMODB - CONTENT SERVICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cargar credenciales desde .env.dev
$envPath = Join-Path $PSScriptRoot "..\.env.dev"
if (Test-Path $envPath) {
    Write-Host "Cargando credenciales desde .env.dev..." -ForegroundColor Yellow
    $envContent = Get-Content $envPath -Raw
    $envContent -split "`n" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($key -eq "AWS_ACCESS_KEY_ID" -or $key -eq "AWS_SECRET_ACCESS_KEY" -or $key -eq "AWS_REGION") {
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
                Write-Host "  Configurado: $key" -ForegroundColor Gray
            }
        }
    }
} else {
    Write-Host "⚠️  Archivo .env.dev no encontrado. Usando credenciales de AWS CLI." -ForegroundColor Yellow
}

$region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$environment = "dev"
$projectName = "bravas"

Write-Host "Region: $region" -ForegroundColor Cyan
Write-Host ""

# Tabla 1: Posts
Write-Host "1. Verificando/Creando tabla: bravas-posts-dev" -ForegroundColor Yellow
$postsTableDef = @{
    TableName = "bravas-posts-dev"
    KeySchema = @(
        @{AttributeName="postId"; KeyType="HASH"}
    )
    AttributeDefinitions = @(
        @{AttributeName="postId"; AttributeType="S"}
        @{AttributeName="userId"; AttributeType="S"}
        @{AttributeName="createdAt"; AttributeType="S"}
    )
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "userId-createdAt-index"
            KeySchema = @(
                @{AttributeName="userId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        }
    )
    BillingMode = "PAY_PER_REQUEST"
} | ConvertTo-Json -Depth 10

$postsTableDef | Out-File -FilePath "temp-posts-table.json" -Encoding UTF8
aws dynamodb create-table --cli-input-json "file://temp-posts-table.json" --region $region 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tabla creada: bravas-posts-dev" -ForegroundColor Green
    aws dynamodb wait table-exists --table-name "bravas-posts-dev" --region $region
} else {
    Write-Host "  ℹ Tabla ya existe o hubo un error (puede ser normal)" -ForegroundColor Yellow
}
Remove-Item "temp-posts-table.json" -ErrorAction SilentlyContinue

# Tabla 2: Packs
Write-Host "2. Verificando/Creando tabla: bravas-packs-dev" -ForegroundColor Yellow
$packsTableDef = @{
    TableName = "bravas-packs-dev"
    KeySchema = @(
        @{AttributeName="packId"; KeyType="HASH"}
    )
    AttributeDefinitions = @(
        @{AttributeName="packId"; AttributeType="S"}
        @{AttributeName="modelId"; AttributeType="S"}
        @{AttributeName="createdAt"; AttributeType="S"}
    )
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "modelId-createdAt-index"
            KeySchema = @(
                @{AttributeName="modelId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        }
    )
    BillingMode = "PAY_PER_REQUEST"
} | ConvertTo-Json -Depth 10

$packsTableDef | Out-File -FilePath "temp-packs-table.json" -Encoding UTF8
aws dynamodb create-table --cli-input-json "file://temp-packs-table.json" --region $region 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tabla creada: bravas-packs-dev" -ForegroundColor Green
    aws dynamodb wait table-exists --table-name "bravas-packs-dev" --region $region
} else {
    Write-Host "  ℹ Tabla ya existe o hubo un error (puede ser normal)" -ForegroundColor Yellow
}
Remove-Item "temp-packs-table.json" -ErrorAction SilentlyContinue

# Tabla 3: Post Likes
Write-Host "3. Verificando/Creando tabla: bravas-post-likes-dev" -ForegroundColor Yellow
$likesTableDef = @{
    TableName = "bravas-post-likes-dev"
    KeySchema = @(
        @{AttributeName="postId"; KeyType="HASH"}
        @{AttributeName="userId"; KeyType="RANGE"}
    )
    AttributeDefinitions = @(
        @{AttributeName="postId"; AttributeType="S"}
        @{AttributeName="userId"; AttributeType="S"}
        @{AttributeName="createdAt"; AttributeType="S"}
    )
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "userId-createdAt-index"
            KeySchema = @(
                @{AttributeName="userId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        }
    )
    BillingMode = "PAY_PER_REQUEST"
} | ConvertTo-Json -Depth 10

$likesTableDef | Out-File -FilePath "temp-likes-table.json" -Encoding UTF8
aws dynamodb create-table --cli-input-json "file://temp-likes-table.json" --region $region 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tabla creada: bravas-post-likes-dev" -ForegroundColor Green
    aws dynamodb wait table-exists --table-name "bravas-post-likes-dev" --region $region
} else {
    Write-Host "  ℹ Tabla ya existe o hubo un error (puede ser normal)" -ForegroundColor Yellow
}
Remove-Item "temp-likes-table.json" -ErrorAction SilentlyContinue

# Tabla 4: Post Comments
Write-Host "4. Verificando/Creando tabla: bravas-post-comments-dev" -ForegroundColor Yellow
$commentsTableDef = @{
    TableName = "bravas-post-comments-dev"
    KeySchema = @(
        @{AttributeName="commentId"; KeyType="HASH"}
    )
    AttributeDefinitions = @(
        @{AttributeName="commentId"; AttributeType="S"}
        @{AttributeName="postId"; AttributeType="S"}
        @{AttributeName="userId"; AttributeType="S"}
        @{AttributeName="createdAt"; AttributeType="S"}
    )
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "postId-createdAt-index"
            KeySchema = @(
                @{AttributeName="postId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        },
        @{
            IndexName = "userId-createdAt-index"
            KeySchema = @(
                @{AttributeName="userId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        }
    )
    BillingMode = "PAY_PER_REQUEST"
} | ConvertTo-Json -Depth 10

$commentsTableDef | Out-File -FilePath "temp-comments-table.json" -Encoding UTF8
aws dynamodb create-table --cli-input-json "file://temp-comments-table.json" --region $region 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tabla creada: bravas-post-comments-dev" -ForegroundColor Green
    aws dynamodb wait table-exists --table-name "bravas-post-comments-dev" --region $region
} else {
    Write-Host "  ℹ Tabla ya existe o hubo un error (puede ser normal)" -ForegroundColor Yellow
}
Remove-Item "temp-comments-table.json" -ErrorAction SilentlyContinue

# Tabla 5: User Follows
Write-Host "5. Verificando/Creando tabla: bravas-user-follows-dev" -ForegroundColor Yellow
$followsTableDef = @{
    TableName = "bravas-user-follows-dev"
    KeySchema = @(
        @{AttributeName="userId"; KeyType="HASH"}
        @{AttributeName="modelId"; KeyType="RANGE"}
    )
    AttributeDefinitions = @(
        @{AttributeName="userId"; AttributeType="S"}
        @{AttributeName="modelId"; AttributeType="S"}
        @{AttributeName="createdAt"; AttributeType="S"}
    )
    GlobalSecondaryIndexes = @(
        @{
            IndexName = "modelId-index"
            KeySchema = @(
                @{AttributeName="modelId"; KeyType="HASH"}
                @{AttributeName="userId"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        },
        @{
            IndexName = "modelId-createdAt-index"
            KeySchema = @(
                @{AttributeName="modelId"; KeyType="HASH"}
                @{AttributeName="createdAt"; KeyType="RANGE"}
            )
            Projection = @{ProjectionType="ALL"}
        }
    )
    BillingMode = "PAY_PER_REQUEST"
} | ConvertTo-Json -Depth 10

$followsTableDef | Out-File -FilePath "temp-follows-table.json" -Encoding UTF8
aws dynamodb create-table --cli-input-json "file://temp-follows-table.json" --region $region 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tabla creada: bravas-user-follows-dev" -ForegroundColor Green
    aws dynamodb wait table-exists --table-name "bravas-user-follows-dev" --region $region
} else {
    Write-Host "  ℹ Tabla ya existe o hubo un error (puede ser normal)" -ForegroundColor Yellow
}
Remove-Item "temp-follows-table.json" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verificando tablas creadas..." -ForegroundColor Yellow
aws dynamodb list-tables --region $region --query "TableNames[?contains(@, 'bravas') && contains(@, 'dev')]" --output table
