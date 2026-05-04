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

@description('Admin login name for Azure Database for PostgreSQL Flexible Server.')
param postgresAdminLogin string

@description('Admin password for Azure Database for PostgreSQL Flexible Server.')
@secure()
param postgresAdminPassword string

@description('Application database name.')
@minLength(3)
@maxLength(63)
param databaseName string = 'whack_a_hack'

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

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    workloadName: workloadName
    location: location
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    databaseName: databaseName
    tags: commonTags
  }
}

var databaseUrl = 'postgresql://${uriComponent('${postgresAdminLogin}@${postgres.outputs.postgresServerName}')}:${uriComponent(postgresAdminPassword)}@${postgres.outputs.fullyQualifiedDomainName}:5432/${databaseName}'

module containerApp './modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    workloadName: workloadName
    location: location
    containerImage: containerImage
    adminCode: adminCode
    cookieSecret: cookieSecret
    databaseUrl: databaseUrl
    containerCpu: containerCpu
    containerMemory: containerMemory
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    registryServer: registryServer
    registryUsername: registryUsername
    registryPassword: registryPassword
    tags: commonTags
  }
}

output locationUsed string = location
output containerAppName string = containerApp.outputs.containerAppName
output containerAppUrl string = containerApp.outputs.containerAppUrl
output managedEnvironmentName string = containerApp.outputs.managedEnvironmentName
output logAnalyticsWorkspaceName string = containerApp.outputs.logAnalyticsWorkspaceName
output postgresServerName string = postgres.outputs.postgresServerName
output postgresHost string = postgres.outputs.fullyQualifiedDomainName
output postgresDatabaseName string = postgres.outputs.databaseName
