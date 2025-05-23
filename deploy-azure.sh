#!/bin/bash

# Variables de configuración (usando recursos existentes)
RESOURCE_GROUP="Agents"  # ⚠️ CAMBIAR por tu Resource Group real
LOCATION="eastus"  # Ajustar si tu región es diferente
APP_NAME="caagentsbackend"  # Tu Container App existente
CONTAINER_REGISTRY="ACRAgentsGraphs"  # Tu ACR existente

echo "🚀 Desplegando en Azure Container Apps existente..."
echo "📱 Container App: $APP_NAME"
echo "🏗️ Registry: $CONTAINER_REGISTRY"
echo "📁 Resource Group: $RESOURCE_GROUP"
echo ""
echo "⚠️  IMPORTANTE: Asegúrate de cambiar RESOURCE_GROUP en el script"
echo ""

# 1. Obtener credenciales del ACR existente
echo "🔑 Obteniendo credenciales del registry..."
ACR_USERNAME=$(az acr credential show --name $CONTAINER_REGISTRY --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $CONTAINER_REGISTRY --query passwords[0].value --output tsv)
ACR_LOGIN_SERVER=$(az acr show --name $CONTAINER_REGISTRY --query loginServer --output tsv)

echo "🔗 Registry Server: $ACR_LOGIN_SERVER"

# 2. Build y push de la imagen al ACR existente
echo "🐳 Construyendo y subiendo imagen al ACR existente..."
az acr build --registry $CONTAINER_REGISTRY --image voice-ecommerce:latest .

# 3. Actualizar la Container App existente con la nueva imagen
echo "🔄 Actualizando Container App existente..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_LOGIN_SERVER/voice-ecommerce:latest

# 3.1. Configurar registry credentials separadamente
echo "🔐 Configurando credenciales del registry..."
az containerapp registry set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --server $ACR_LOGIN_SERVER \
  --username $ACR_USERNAME \
  --password $ACR_PASSWORD

# 3.2. Configurar variables de entorno
echo "🔧 Configurando variables de entorno..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# 3.3. Configurar recursos
echo "⚙️ Configurando recursos..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 3

# 4. Habilitar ingress externo si no está habilitado
echo "🌐 Configurando ingress externo..."
az containerapp ingress enable \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --type external \
  --target-port 3000 \
  --transport auto

# 5. Obtener la URL de la aplicación
echo "🌐 Obteniendo URL de la aplicación..."
APP_URL=$(az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv)

echo ""
echo "✅ ¡Despliegue completado!"
echo "🔗 Tu aplicación está disponible en: https://$APP_URL"
echo ""
echo "📊 Para ver logs:"
echo "az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "🔄 Para futuras actualizaciones:"
echo "az acr build --registry $CONTAINER_REGISTRY --image voice-ecommerce:latest ."
echo "az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_LOGIN_SERVER/voice-ecommerce:latest" 