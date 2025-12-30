#!/bin/bash

# ============================================
# 🎵 KikoBingo - Script de Despliegue
# ============================================

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🎵 KikoBingo - Iniciando Despliegue${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${YELLOW}📂 Directorio: ${PROJECT_DIR}${NC}"
echo ""

# 1. Detener PM2 si está corriendo
echo -e "${YELLOW}⏹️  Deteniendo servidor...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 stop kikobingo 2>/dev/null || true
    echo -e "${GREEN}✅ Servidor detenido${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 no encontrado, saltando...${NC}"
fi
echo ""

# 2. Limpiar caché de npm
echo -e "${YELLOW}🧹 Limpiando caché de npm...${NC}"
npm cache clean --force
echo -e "${GREEN}✅ Caché de npm limpiada${NC}"
echo ""

# 3. Actualizar desde GitHub
echo -e "${YELLOW}📥 Actualizando desde GitHub...${NC}"
git fetch origin
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
echo -e "${GREEN}✅ Código actualizado desde GitHub${NC}"
echo ""

# 4. Mostrar últimos commits
echo -e "${YELLOW}📋 Últimos cambios:${NC}"
git log --oneline -3
echo ""

# 5. Instalar/actualizar dependencias
echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
rm -rf node_modules
npm install --production
echo -e "${GREEN}✅ Dependencias instaladas${NC}"
echo ""

# 6. Verificar archivos críticos
echo -e "${YELLOW}🔍 Verificando archivos críticos...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ ERROR: Falta archivo .env${NC}"
    exit 1
fi
if [ ! -f "serviceAccountKey.json" ]; then
    echo -e "${RED}❌ ERROR: Falta archivo serviceAccountKey.json${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Archivos críticos verificados${NC}"
echo ""

# 7. Reiniciar servidor con PM2
echo -e "${YELLOW}🚀 Iniciando servidor...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 start server.js --name kikobingo --update-env
    pm2 save
    echo -e "${GREEN}✅ Servidor iniciado con PM2${NC}"
    echo ""
    pm2 status kikobingo
else
    echo -e "${YELLOW}⚠️  PM2 no encontrado. Iniciando con node...${NC}"
    echo -e "${YELLOW}   (Usa 'npm install -g pm2' para instalar PM2)${NC}"
    node server.js &
fi
echo ""

# 8. Verificar que el servidor responde
echo -e "${YELLOW}🔗 Verificando servidor...${NC}"
sleep 3
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
    echo -e "${GREEN}✅ Servidor respondiendo correctamente${NC}"
else
    echo -e "${YELLOW}⚠️  El servidor puede tardar unos segundos en estar listo${NC}"
fi
echo ""

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}🎉 ¡Despliegue completado!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "📍 URL: ${GREEN}https://kikobingo.com${NC}"
echo -e "📍 Local: ${GREEN}http://localhost:3001${NC}"
echo ""
