@description('Short workload name used to derive resource names.')
param workloadName string

@description('Azure region for the storage account.')
param location string

@description('Azure Files share name used by the application.')
param fileShareName string

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var resourceSuffix = uniqueString(resourceGroup().id, workloadName)
var storageAccountName = 'st${resourceSuffix}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  name: '${storageAccount.name}/default/${fileShareName}'
  properties: {
    accessTier: 'TransactionOptimized'
  }
}

output storageAccountName string = storageAccount.name
output fileShareName string = fileShareName
