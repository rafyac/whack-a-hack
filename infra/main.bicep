targetScope = 'resourceGroup'

@description('Short workload name used in resource names.')
@minLength(3)
@maxLength(20)
param workloadName string = 'whack-a-hack'

@description('Container image to run in Azure Container Apps, for example ghcr.io/your-org/whack-a-hack:latest.')
param containerImage string

@description('Admin login code exposed through the /admin experience.')
@secure()
param adminCode string

@description('Long random secret used to sign auth cookies.')
@secure()
param cookieSecret string

@description('Azure Files share name that stores the SQLite database.')
@minLength(3)
@maxLength(63)
param fileShareName string = 'sqlite'

@description('CPU allocated to the app container.')
param containerCpu string = '0.5'

@description('Memory allocated to the app container.')
param containerMemory string = '1Gi'

@description('Minimum replica count for the Container App.')
@minValue(1)
param minReplicas int = 1

@description('Maximum replica count for the Container App.')
@minValue(1)
param maxReplicas int = 1

@description('Optional registry server for private images, for example ghcr.io or myregistry.azurecr.io.')
param registryServer string = ''

@description('Optional registry username for private images.')
param registryUsername string = ''

@description('Optional registry password or token for private images.')
@secure()
param registryPassword string = ''

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var location = resourceGroup().location
var commonTags = union(tags, {
  app: 'whack-a-hack'
  'managed-by': 'bicep'
})

module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    workloadName: workloadName
    location: location
    fileShareName: fileShareName
    tags: commonTags
  }
}

module containerApp './modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    workloadName: workloadName
    location: location
    containerImage: containerImage
    adminCode: adminCode
    cookieSecret: cookieSecret
    containerCpu: containerCpu
    containerMemory: containerMemory
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    registryServer: registryServer
    registryUsername: registryUsername
    registryPassword: registryPassword
    storageAccountName: storage.outputs.storageAccountName
    fileShareName: storage.outputs.fileShareName
    tags: commonTags
  }
}

output locationUsed string = location
output containerAppName string = containerApp.outputs.containerAppName
output containerAppUrl string = containerApp.outputs.containerAppUrl
output managedEnvironmentName string = containerApp.outputs.managedEnvironmentName
output logAnalyticsWorkspaceName string = containerApp.outputs.logAnalyticsWorkspaceName
output storageAccountName string = storage.outputs.storageAccountName
