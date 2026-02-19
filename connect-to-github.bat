@echo off
echo Conectando con tu repositorio GitHub...

REM Inicializar Git (si no está inicializado)
git init

REM Conectar con tu repositorio remoto
git remote add origin https://github.com/jordixavifaj/my-trades.git

REM Verificar conexión
echo Verificando conexión remota...
git remote -v

REM Configurar usuario (si es la primera vez)
echo Configurando usuario...
git config user.name "jordixavifaj"
git config user.email "jordixavifaj@gmail.com"

REM Añadir todos los cambios
echo Añadiendo cambios...
git add .

REM Hacer commit
echo Haciendo commit...
git commit -m "feat: add TradingView market data integration with user trades overlay"

REM Subir a GitHub
echo Subiendo a GitHub...
git push -u origin main

echo ¡Listo! Tus cambios están en GitHub.
pause
