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

@description('Address space for the reusable Azure virtual network.')
param virtualNetworkAddressPrefix string = '10.42.0.0/16'

@description('CIDR prefix for the Container Apps infrastructure subnet.')
param containerAppsInfrastructureSubnetPrefix string = '10.42.0.0/27'

@description('CIDR prefix for the PostgreSQL delegated subnet.')
param postgresSubnetPrefix string = '10.42.0.32/28'

@description('Private DNS zone name for PostgreSQL private access. Must end with .postgres.database.azure.com.')
param postgresPrivateDnsZoneName string = 'private.postgres.database.azure.com'

var location = resourceGroup().location
var commonTags = union(tags, {
  app: 'whack-a-hack'
  'managed-by': 'bicep'
})
var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().id, workloadName), 18)
var postgresServerName = 'psql-${resourceSuffix}'

module network './modules/network.bicep' = {
  name: 'network'
  params: {
    workloadName: workloadName
    location: location
    virtualNetworkAddressPrefix: virtualNetworkAddressPrefix
    containerAppsInfrastructureSubnetPrefix: containerAppsInfrastructureSubnetPrefix
    postgresSubnetPrefix: postgresSubnetPrefix
    postgresPrivateDnsZoneName: postgresPrivateDnsZoneName
    tags: commonTags
  }
}

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    workloadName: workloadName
    location: location
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    databaseName: databaseName
    delegatedSubnetResourceId: network.outputs.postgresSubnetId
    privateDnsZoneArmResourceId: network.outputs.postgresPrivateDnsZoneId
    tags: commonTags
  }
}

var databaseUrl = 'postgresql://${uriComponent(postgresAdminLogin)}:${uriComponent(postgresAdminPassword)}@${postgres.outputs.postgresHost}:5432/${databaseName}'

module containerApp './modules/container-app.bicep' = {
  name: 'containerApp'
  params: {
    workloadName: workloadName
    location: location
    containerImage: containerImage
    adminCode: adminCode
    cookieSecret: cookieSecret
    databaseUrl: databaseUrl
    infrastructureSubnetId: network.outputs.containerAppsInfrastructureSubnetId
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

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-01-20-preview' existing = {
  name: postgresServerName
}

resource postgresDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'postgres-to-log-analytics'
  scope: postgresServer
  dependsOn: [
    postgres
  ]
  properties: {
    workspaceId: containerApp.outputs.logAnalyticsWorkspaceId
    logs: [
      {
        category: 'PostgreSQLLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output locationUsed string = location
output containerAppName string = containerApp.outputs.containerAppName
output containerAppUrl string = containerApp.outputs.containerAppUrl
output managedEnvironmentName string = containerApp.outputs.managedEnvironmentName
output logAnalyticsWorkspaceName string = containerApp.outputs.logAnalyticsWorkspaceName
output postgresServerName string = postgres.outputs.postgresServerName
output postgresHost string = postgres.outputs.postgresHost
output postgresDatabaseName string = postgres.outputs.databaseName
output virtualNetworkName string = network.outputs.virtualNetworkName
output postgresPrivateDnsZoneName string = network.outputs.postgresPrivateDnsZoneName
