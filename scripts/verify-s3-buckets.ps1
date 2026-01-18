# Script para verificar todos los buckets S3
Write-Host "=== VERIFICACIÓN DE BUCKETS S3 ===" -ForegroundColor Cyan
Write-Host ""

$buckets = @(
    @{Name="bravas-avatars-dev"; Public=$true},
    @{Name="bravas-content-dev"; Public=$true},
    @{Name="bravas-verification-docs-dev"; Public=$false},
    @{Name="bravas-payment-proofs-dev"; Public=$false},
    @{Name="bravas-courses-dev"; Public=$false}
)

$allGood = $true

foreach ($bucketInfo in $buckets) {
    $bucket = $bucketInfo.Name
    $isPublic = $bucketInfo.Public
    
    Write-Host "Bucket: $bucket" -ForegroundColor Yellow
    
    # Verificar existencia
    $exists = aws s3 ls "s3://$bucket" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Existe" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] NO EXISTE" -ForegroundColor Red
        $allGood = $false
        continue
    }
    
    # Verificar versionado
    $versioning = aws s3api get-bucket-versioning --bucket $bucket 2>&1 | ConvertFrom-Json
    if ($versioning.Status -eq "Enabled") {
        Write-Host "  [OK] Versionado: Enabled" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Versionado: $($versioning.Status)" -ForegroundColor Red
        $allGood = $false
    }
    
    # Verificar encriptación
    $encryption = aws s3api get-bucket-encryption --bucket $bucket 2>&1 | ConvertFrom-Json
    if ($encryption.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm -eq "AES256") {
        Write-Host "  [OK] Encriptación: AES256" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Encriptación no configurada correctamente" -ForegroundColor Red
        $allGood = $false
    }
    
    # Verificar Public Access Block
    $pab = aws s3api get-public-access-block --bucket $bucket 2>&1 | ConvertFrom-Json
    $pabConfig = $pab.PublicAccessBlockConfiguration
    if ($isPublic) {
        if (-not $pabConfig.BlockPublicAcls -and -not $pabConfig.BlockPublicPolicy -and -not $pabConfig.RestrictPublicBuckets) {
            Write-Host "  [OK] Public Access Block: Configurado para acceso público" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Public Access Block: Bloqueado incorrectamente" -ForegroundColor Red
            $allGood = $false
        }
        
        # Verificar política pública
        $policy = aws s3api get-bucket-policy --bucket $bucket --query Policy --output text 2>&1 | ConvertFrom-Json
        if ($policy.Statement[0].Effect -eq "Allow" -and $policy.Statement[0].Principal -eq "*") {
            Write-Host "  [OK] Política pública: Configurada" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Política pública: No configurada correctamente" -ForegroundColor Red
            $allGood = $false
        }
    } else {
        if ($pabConfig.BlockPublicAcls -and $pabConfig.BlockPublicPolicy -and $pabConfig.RestrictPublicBuckets) {
            Write-Host "  [OK] Public Access Block: Bloqueado (privado)" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Public Access Block: No bloqueado correctamente" -ForegroundColor Red
            $allGood = $false
        }
    }
    
    # Verificar tags
    $tags = aws s3api get-bucket-tagging --bucket $bucket 2>&1 | ConvertFrom-Json
    if ($tags.TagSet.Count -gt 0) {
        $tagCount = $tags.TagSet.Count
        Write-Host "  [OK] Tags: Configurados ($tagCount tags)" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Tags: No configurados" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host "=== RESUMEN ===" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "Todos los buckets están correctamente configurados!" -ForegroundColor Green
} else {
    Write-Host "Hay problemas con algunos buckets. Revisa los errores arriba." -ForegroundColor Red
}
