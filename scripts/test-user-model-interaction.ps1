# Script de Pruebas - Interacción USER ↔ MODEL
# Ejecuta: .\scripts\test-user-model-interaction.ps1
# Este script prueba los flujos de interacción entre USER (comprador) y MODEL (modelo)

$ErrorActionPreference = "Continue"

Write-Host "`n🧪 PRUEBAS DE INTERACCIÓN USER ↔ MODEL" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Variables globales
$script:userToken = $null
$script:userUserId = $null
$script:modelToken = $null
$script:modelUserId = $null
$script:testModelId = $null
$script:testPostId = $null

# ============================================
# PASO 0: LOGIN DE AMBOS USUARIOS
# ============================================
Write-Host "🔐 PASO 0: Login de Usuarios" -ForegroundColor Cyan
Write-Host "============================`n" -ForegroundColor Cyan

# Login como USER (Comprador)
Write-Host "0.1 Login como USER [Comprador]..." -ForegroundColor Yellow
$userLoginBody = @{
    email = "alexis.correa026@gmail.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $userLoginBody -ContentType "application/json" -ErrorAction Stop
    $script:userToken = $response.data.accessToken
    $script:userUserId = $response.data.user.userId
    Write-Host "✅ USER logueado exitosamente" -ForegroundColor Green
    Write-Host "   User ID: $($script:userUserId)" -ForegroundColor Gray
    Write-Host "   Rol: $($response.data.user.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error en login de USER: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "⚠️  Asegúrate de tener un usuario con rol 'user' creado" -ForegroundColor Yellow
}

$userHeaders = @{
    "Authorization" = "Bearer $script:userToken"
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

# Login como MODEL (Modelo)
Write-Host "`n0.2 Login como MODEL (Modelo)..." -ForegroundColor Yellow
Write-Host "⚠️  NOTA: Si no tienes un usuario MODEL, crea uno primero o usa un email de modelo existente" -ForegroundColor Yellow
$modelEmail = Read-Host "Email del usuario MODEL (Enter para omitir)"

if ($modelEmail) {
    $modelPassword = Read-Host "Password del usuario MODEL" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($modelPassword))
    
    $modelLoginBody = @{
        email = $modelEmail
        password = $plainPassword
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method POST -Body $modelLoginBody -ContentType "application/json" -ErrorAction Stop
        $script:modelToken = $response.data.accessToken
        $script:modelUserId = $response.data.user.userId
        Write-Host "✅ MODEL logueado exitosamente" -ForegroundColor Green
        Write-Host "   Model ID: $($script:modelUserId)" -ForegroundColor Gray
        Write-Host "   Rol: $($response.data.user.role)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error en login de MODEL: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "⚠️  Continuando sin MODEL (se omitirán pruebas específicas de MODEL)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Omitiendo login de MODEL" -ForegroundColor Yellow
}

if ($script:modelToken) {
    $modelHeaders = @{
        "Authorization" = "Bearer $script:modelToken"
        "Accept" = "application/json"
        "Content-Type" = "application/json"
    }
}

# ============================================
# FLUJO 1: USER BUSCA Y ENCUENTRA MODEL
# ============================================
Write-Host "`n📋 FLUJO 1: USER busca y encuentra MODEL" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($script:userToken) {
    # 1.1 USER busca modelos
    Write-Host "1.1 USER busca modelos..." -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3001/api/v1/users/models?verified=true" + [char]38 + "page=1" + [char]38 + "limit=20"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $userHeaders -ErrorAction Stop
        $models = $response.data.items
        Write-Host "✅ USER encontró $($models.Count) modelos" -ForegroundColor Green
        
        if ($models.Count -gt 0) {
            # Usar el primer modelo como modelo de prueba
            $script:testModelId = $models[0].userId
            $modelName = $models[0].fullName
            Write-Host "   Modelo seleccionado: $modelName (ID: $script:testModelId)" -ForegroundColor Gray
            
            # Si tenemos login de MODEL, usar ese ID
            if ($script:modelUserId -and $models | Where-Object { $_.userId -eq $script:modelUserId }) {
                $script:testModelId = $script:modelUserId
                Write-Host "   Usando MODEL logueado: $($script:modelUserId)" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️  No hay modelos disponibles para probar" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 1.2 USER ve perfil del MODEL
    if ($script:testModelId) {
        Write-Host "`n1.2 USER ve perfil del MODEL..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)" -Method GET -Headers $userHeaders -ErrorAction Stop
            Write-Host "✅ USER puede ver perfil del MODEL" -ForegroundColor Green
            Write-Host "   Nombre: $($response.data.fullName)" -ForegroundColor Gray
            Write-Host "   Bio: $($response.data.bio)" -ForegroundColor Gray
            Write-Host "   Verificado: $($response.data.verified)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ============================================
# FLUJO 2: USER SIGUE AL MODEL
# ============================================
Write-Host "`n👥 FLUJO 2: USER sigue al MODEL" -ForegroundColor Cyan
Write-Host "===============================`n" -ForegroundColor Cyan

if ($script:userToken -and $script:testModelId) {
    # 2.1 USER sigue al MODEL
    Write-Host "2.1 USER sigue al MODEL..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/models/$($script:testModelId)/follow" -Method POST -Headers $userHeaders -ErrorAction Stop
        Write-Host "✅ USER siguió al MODEL exitosamente" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($_.Exception.Message) (puede que ya lo estés siguiendo)" -ForegroundColor Yellow
    }
    
    # 2.2 USER ve modelos que sigue
    Write-Host "`n2.2 USER ve modelos que sigue..." -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3001/api/v1/users/me/following?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $userHeaders -ErrorAction Stop
        $following = $response.data.items
        Write-Host "✅ USER está siguiendo $($following.Count) modelos" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 2.3 MODEL ve sus seguidores (si tenemos login de MODEL)
    if ($script:modelToken -and $script:modelUserId) {
        Write-Host "`n2.3 MODEL ve sus seguidores..." -ForegroundColor Yellow
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me/stats" -Method GET -Headers $modelHeaders -ErrorAction Stop
            Write-Host "✅ MODEL puede ver sus estadísticas" -ForegroundColor Green
            Write-Host "   Seguidores: $($response.data.followers)" -ForegroundColor Gray
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ============================================
# FLUJO 3: USER VE CONTENIDO DEL MODEL (FEED)
# ============================================
Write-Host "`n📱 FLUJO 3: USER ve contenido del MODEL (Feed)" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

if ($script:userToken) {
    # 3.1 USER ve su feed personalizado (posts de modelos que sigue)
    Write-Host "3.1 USER ve su feed personalizado..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/feed?limit=20" -Method GET -Headers $userHeaders -ErrorAction Stop
        $posts = $response.data.posts
        Write-Host "✅ USER puede ver su feed: $($posts.Count) posts" -ForegroundColor Green
        
        if ($posts.Count -gt 0) {
            $script:testPostId = $posts[0].postId
            $postAuthor = $posts[0].authorName
            Write-Host "   Primer post: ID $script:testPostId de $postAuthor" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  Feed vacío (no hay posts de modelos seguidos)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# FLUJO 4: USER INTERACTÚA CON CONTENIDO DEL MODEL
# ============================================
Write-Host "`n❤️  FLUJO 4: USER interactúa con contenido del MODEL" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

if ($script:userToken -and $script:testPostId) {
    # 4.1 USER da LIKE a un post del MODEL
    Write-Host "4.1 USER da LIKE a un post del MODEL..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/like" -Method POST -Headers $userHeaders -ErrorAction Stop
        Write-Host "✅ USER dio LIKE al post" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  $($_.Exception.Message) (puede que ya le hayas dado like)" -ForegroundColor Yellow
    }
    
    # 4.2 USER comenta en un post del MODEL
    Write-Host "`n4.2 USER comenta en un post del MODEL..." -ForegroundColor Yellow
    $commentBody = @{
        content = "¡Excelente post! $(Get-Date -Format 'HH:mm:ss')"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/comments" -Method POST -Headers $userHeaders -Body $commentBody -ErrorAction Stop
        Write-Host "✅ USER comentó en el post" -ForegroundColor Green
        Write-Host "   Comentario ID: $($response.data.commentId)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 4.3 MODEL ve interacciones en sus posts (si tenemos login de MODEL)
    if ($script:modelToken -and $script:testPostId) {
        Write-Host "`n4.3 MODEL ve interacciones en sus posts..." -ForegroundColor Yellow
        try {
            $uri = "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/likes?page=1" + [char]38 + "limit=10"
            $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $modelHeaders -ErrorAction Stop
            Write-Host "✅ MODEL puede ver likes en su post" -ForegroundColor Green
            
            $uri2 = "http://localhost:3005/api/v1/content/posts/$($script:testPostId)/comments?page=1" + [char]38 + "limit=10"
            $response2 = Invoke-RestMethod -Uri $uri2 -Method GET -Headers $modelHeaders -ErrorAction Stop
            Write-Host "✅ MODEL puede ver comentarios en su post: $($response2.data.items.Count)" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Error: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# ============================================
# FLUJO 5: MODEL VE ESTADÍSTICAS E INTERACCIONES
# ============================================
Write-Host "`n📊 FLUJO 5: MODEL ve estadísticas e interacciones" -ForegroundColor Cyan
Write-Host "=================================================`n" -ForegroundColor Cyan

if ($script:modelToken) {
    # 5.1 MODEL ve sus estadísticas
    Write-Host "5.1 MODEL ve sus estadísticas..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me/stats" -Method GET -Headers $modelHeaders -ErrorAction Stop
        Write-Host "✅ MODEL puede ver sus estadísticas" -ForegroundColor Green
        $stats = $response.data
        Write-Host "   Seguidores: $($stats.followers)" -ForegroundColor Gray
        Write-Host "   Posts: $($stats.posts)" -ForegroundColor Gray
        Write-Host "   Total ganancias: $($stats.totalEarnings)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 5.2 MODEL ve sus compradores
    Write-Host "`n5.2 MODEL ve sus compradores..." -ForegroundColor Yellow
    try {
        $uri = "http://localhost:3001/api/v1/users/me/buyers?page=1" + [char]38 + "limit=10"
        $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $modelHeaders -ErrorAction Stop
        $buyers = $response.data.items
        Write-Host "✅ MODEL puede ver sus compradores: $($buyers.Count)" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Error: $($_.Exception.Message) (puede que no tenga compradores aún)" -ForegroundColor Yellow
    }
}

# ============================================
# FLUJO 6: USER VE ESTADÍSTICAS DE COMPRADOR
# ============================================
Write-Host "`n💰 FLUJO 6: USER ve estadísticas de comprador" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

if ($script:userToken) {
    # 6.1 USER ve sus estadísticas de comprador
    Write-Host "6.1 USER ve sus estadísticas de comprador..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/users/me/buyer-stats" -Method GET -Headers $userHeaders -ErrorAction Stop
        Write-Host "✅ USER puede ver sus estadísticas de comprador" -ForegroundColor Green
        $stats = $response.data
        Write-Host "   Total gastado: $($stats.totalSpent)" -ForegroundColor Gray
        Write-Host "   Suscripciones activas: $($stats.activeSubscriptions)" -ForegroundColor Gray
        Write-Host "   Modelos seguidos: $($stats.followingCount)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================
# RESUMEN
# ============================================
Write-Host "`n📊 RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "✅ Flujos de interacción USER ↔ MODEL probados" -ForegroundColor Green
Write-Host "`nRevisa los resultados arriba para verificar que todas las interacciones funcionan correctamente.`n" -ForegroundColor White
