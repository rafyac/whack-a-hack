@description('Short workload name used to derive resource names.')
param workloadName string

@description('Azure region for the PostgreSQL server.')
param location string

@description('Admin login name for the PostgreSQL server. For Flexible Server connections, use this plain username without an @server suffix.')
param postgresAdminLogin string

@description('Admin password for the PostgreSQL server.')
@secure()
param postgresAdminPassword string

@description('Application database name.')
param databaseName string

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().id, workloadName), 18)
var postgresServerName = 'psql-${resourceSuffix}'
var postgresHost = '${postgresServerName}.postgres.database.azure.com'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-01-20-preview' = {
  name: postgresServerName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource applicationDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-01-20-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-01-20-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output postgresServerName string = postgresServer.name
output postgresHost string = postgresHost
output databaseName string = applicationDatabase.name
