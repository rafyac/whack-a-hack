@description('Short workload name used to derive resource names.')
param workloadName string

@description('Azure region for the Container Apps resources.')
param location string

@description('Full container image reference to deploy.')
param containerImage string

@description('Admin login code for /admin.')
@secure()
param adminCode string

@description('Long random secret used to sign auth cookies.')
@secure()
param cookieSecret string

@description('Application PostgreSQL connection string.')
@secure()
param databaseUrl string

@description('CPU allocated to the app container.')
param containerCpu string

@description('Memory allocated to the app container.')
param containerMemory string

@minValue(1)
param minReplicas int

@minValue(1)
param maxReplicas int

@description('Optional registry server for private images.')
param registryServer string = ''

@description('Optional registry username for private images.')
param registryUsername string = ''

@description('Optional registry password or token for private images.')
@secure()
param registryPassword string = ''

@description('Optional tags applied to provisioned resources.')
param tags object = {}

var resourceSuffix = uniqueString(resourceGroup().id, workloadName)
var logAnalyticsWorkspaceName = 'log-${workloadName}-${resourceSuffix}'
var managedEnvironmentName = 'cae-${workloadName}-${resourceSuffix}'
var containerAppName = 'ca-${workloadName}'
var usePrivateRegistry = !empty(registryServer) && !empty(registryUsername) && !empty(registryPassword)

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: concat(
        [
          {
            name: 'admin-code'
            value: adminCode
          }
          {
            name: 'cookie-secret'
            value: cookieSecret
          }
          {
            name: 'database-url'
            value: databaseUrl
          }
        ],
        usePrivateRegistry
          ? [
              {
                name: 'registry-password'
                value: registryPassword
              }
            ]
          : []
      )
      registries: usePrivateRegistry
        ? [
            {
              server: registryServer
              username: registryUsername
              passwordSecretRef: 'registry-password'
            }
          ]
        : []
    }
    template: {
      containers: [
        {
          name: 'whack-a-hack'
          image: containerImage
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'DATABASE_SSL_MODE'
              value: 'require'
            }
            {
              name: 'ADMIN_CODE'
              secretRef: 'admin-code'
            }
            {
              name: 'COOKIE_SECRET'
              secretRef: 'cookie-secret'
            }
          ]
          probes: [
            {
              type: 'startup'
              httpGet: {
                path: '/api/health'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              failureThreshold: 18
            }
            {
              type: 'liveness'
              httpGet: {
                path: '/api/health'
                port: 8080
              }
              initialDelaySeconds: 20
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'readiness'
              httpGet: {
                path: '/api/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 15
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output containerAppName string = containerApp.name
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output managedEnvironmentName string = managedEnvironment.name
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
