# 🚀 Guía de Despliegue en Azure Container Apps (Recursos Existentes)

## 📋 Prerequisitos

1. **Azure CLI instalado**
   ```bash
   # Instalar Azure CLI
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   
   # O en Windows con PowerShell
   Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi; Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'
   ```

2. **Extensión de Container Apps**
   ```bash
   az extension add --name containerapp
   ```

3. **Login en Azure**
   ```bash
   az login
   ```

## 🏗️ Recursos Existentes

- **Container App**: `caagentsbackend`
- **Azure Container Registry**: `ACRAgentsGraphs`

## 🎯 Opción 1: Despliegue Automático

**⚠️ Importante**: Ajusta las variables en `deploy-azure.sh` si tu Resource Group es diferente.

```bash
# Dar permisos de ejecución y ejecutar
chmod +x deploy-azure.sh
./deploy-azure.sh
```

## 🎯 Opción 2: Despliegue Manual

### 1. Build y Push de la imagen al ACR existente
```bash
az acr build --registry ACRAgentsGraphs --image voice-ecommerce:latest .
```

### 2. Actualizar tu Container App existente
```bash
# Obtener credenciales del ACR
ACR_USERNAME=$(az acr credential show --name ACRAgentsGraphs --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name ACRAgentsGraphs --query passwords[0].value --output tsv)
ACR_LOGIN_SERVER=$(az acr show --name ACRAgentsGraphs --query loginServer --output tsv)

# Actualizar la Container App
az containerapp update \
  --name caagentsbackend \
  --resource-group {tu-resource-group} \
  --image $ACR_LOGIN_SERVER/voice-ecommerce:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3000 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
```

### 3. Habilitar ingress externo (si no está habilitado)
```bash
az containerapp ingress enable \
  --name caagentsbackend \
  --resource-group {tu-resource-group} \
  --type external \
  --target-port 3000 \
  --transport auto
```

## 📊 Comandos Útiles

### Ver logs
```bash
az containerapp logs show --name caagentsbackend --resource-group {tu-resource-group} --follow
```

### Actualizar la aplicación
```bash
# Rebuild image
az acr build --registry ACRAgentsGraphs --image voice-ecommerce:latest .

# Update container app
az containerapp update --name caagentsbackend --resource-group {tu-resource-group} --image acragentsgraphs.azurecr.io/voice-ecommerce:latest
```

### Ver información de tu Container App
```bash
az containerapp show --name caagentsbackend --resource-group {tu-resource-group}
```

### Escalar la aplicación
```bash
az containerapp update --name caagentsbackend --resource-group {tu-resource-group} --min-replicas 2 --max-replicas 5
```

## 🔧 Variables de Entorno Adicionales

Si necesitas agregar variables de entorno (como OpenAI API key):

```bash
az containerapp update \
  --name caagentsbackend \
  --resource-group {tu-resource-group} \
  --set-env-vars OPENAI_API_KEY=tu_api_key NODE_ENV=production
```

## 🔍 Verificar el despliegue

1. **Obtener URL de tu app:**
   ```bash
   az containerapp show --name caagentsbackend --resource-group {tu-resource-group} --query properties.configuration.ingress.fqdn --output tsv
   ```

2. **Verificar estado:**
   ```bash
   az containerapp show --name caagentsbackend --resource-group {tu-resource-group} --query properties.runningStatus
   ```

## 🚀 Comandos de Una Línea

### Despliegue rápido completo:
```bash
az acr build --registry ACRAgentsGraphs --image voice-ecommerce:latest . && az containerapp update --name caagentsbackend --resource-group {tu-resource-group} --image acragentsgraphs.azurecr.io/voice-ecommerce:latest
```

### Ver URL directamente:
```bash
echo "https://$(az containerapp show --name caagentsbackend --resource-group {tu-resource-group} --query properties.configuration.ingress.fqdn --output tsv)"
```

## 💡 Notas Importantes

1. **Resource Group**: Reemplaza `{tu-resource-group}` con el nombre real de tu resource group
2. **Existing Services**: No se crearán nuevos recursos, solo se actualizará tu Container App existente
3. **Zero Downtime**: Azure Container Apps hace rolling updates automáticamente
4. **Rollback**: Si algo falla, puedes hacer rollback a la versión anterior

¡Tu aplicación de e-commerce con IA de voz estará corriendo en tu infraestructura existente! 🎉 