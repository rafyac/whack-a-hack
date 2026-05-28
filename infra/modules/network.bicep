@description('Short workload name used to derive resource names.')
param workloadName string

@description('Azure region for the shared network resources.')
param location string

@description('Address space for the reusable virtual network.')
param virtualNetworkAddressPrefix string

@description('CIDR prefix for the Container Apps infrastructure subnet. Must be /27 or larger for the default workload profiles environment.')
param containerAppsInfrastructureSubnetPrefix string

@description('CIDR prefix for the PostgreSQL delegated subnet. Must be /28 or larger.')
param postgresSubnetPrefix string

@description('Private DNS zone name for PostgreSQL private access. Must end with .postgres.database.azure.com.')
param postgresPrivateDnsZoneName string

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var resourceSuffix = uniqueString(resourceGroup().id, workloadName)
var virtualNetworkName = 'vnet-${workloadName}-${resourceSuffix}'
var containerAppsSubnetName = 'aca-infra'
var postgresSubnetName = 'postgres'
var privateDnsLinkName = 'postgres-${resourceSuffix}'

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: virtualNetworkName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        virtualNetworkAddressPrefix
      ]
    }
    subnets: [
      {
        name: containerAppsSubnetName
        properties: {
          addressPrefix: containerAppsInfrastructureSubnetPrefix
          delegations: [
            {
              name: 'container-apps'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: postgresSubnetName
        properties: {
          addressPrefix: postgresSubnetPrefix
          delegations: [
            {
              name: 'postgres-flexible'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: postgresPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: privateDnsLinkName
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

output virtualNetworkName string = virtualNetwork.name
output virtualNetworkId string = virtualNetwork.id
output containerAppsInfrastructureSubnetId string = '${virtualNetwork.id}/subnets/${containerAppsSubnetName}'
output postgresSubnetId string = '${virtualNetwork.id}/subnets/${postgresSubnetName}'
output postgresPrivateDnsZoneName string = privateDnsZone.name
output postgresPrivateDnsZoneId string = privateDnsZone.id
