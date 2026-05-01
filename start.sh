#!/bin/bash
set -e

echo "=========================================="
echo "🔧 DietoMetrics — Setup para Render"
echo "=========================================="

# 1. Instalar dependencias Python
echo ""
echo "📦 Instalando dependencias Python..."
if [ -f "requirements.txt" ]; then
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn
else
    echo "⚠️  No se encontró requirements.txt"
fi

# 2. Instalar dependencias Node.js
echo ""
echo "📦 Instalando dependencias Node.js..."
if [ -f "package.json" ]; then
    npm install --legacy-peer-deps
    
    # 3. Compilar frontend
    echo ""
    echo "📦 Compilando frontend React..."
    npm run build
else
    echo "⚠️  No se encontró package.json"
fi

# 4. Iniciar servidor
echo ""
echo "=========================================="
echo "🚀 Iniciando DietoMetrics"
echo "=========================================="
echo "Backend: http://0.0.0.0:$PORT"
echo "API Docs: http://0.0.0.0:$PORT/docs"
echo "=========================================="
echo ""

# Usar gunicorn en producción, uvicorn en desarrollo
if [ "$ENVIRONMENT" = "production" ]; then
    echo "Modo: PRODUCCIÓN (gunicorn)"
    gunicorn -w 2 -b 0.0.0.0:${PORT:-8000} --timeout 120 --access-logfile - --error-logfile - main:app
else
    echo "Modo: DESARROLLO (uvicorn)"
    uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload
fi
