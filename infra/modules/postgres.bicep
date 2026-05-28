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

@description('Resource ID of the delegated subnet used for PostgreSQL private access.')
param delegatedSubnetResourceId string

@description('Resource ID of the private DNS zone used for PostgreSQL private access.')
param privateDnsZoneArmResourceId string

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().id, workloadName), 18)
var postgresServerName = 'psql-${resourceSuffix}'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
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
    network: {
      delegatedSubnetResourceId: delegatedSubnetResourceId
      privateDnsZoneArmResourceId: privateDnsZoneArmResourceId
    }
  }
}

resource requireSecureTransport 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2022-12-01' = {
  parent: postgresServer
  name: 'require_secure_transport'
  properties: {
    value: 'ON'
    source: 'user-override'
  }
}

resource applicationDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output postgresServerName string = postgresServer.name
output postgresHost string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = applicationDatabase.name
