import { KubeConfig, AppsV1Api, CoreV1Api, NetworkingV1Api } from '@kubernetes/client-node';
import config from '../config';

class KubernetesService {
  private kubeConfig: KubeConfig;
  private appsApi: AppsV1Api;
  private coreApi: CoreV1Api;
  private networkingApi: NetworkingV1Api;

  constructor() {
    this.kubeConfig = new KubeConfig();

    if (config.kubernetesConfigPath) {
      this.kubeConfig.loadFromFile(config.kubernetesConfigPath);
    } else {
      this.kubeConfig.loadFromDefault();
    }

    this.appsApi = this.kubeConfig.makeApiClient(AppsV1Api);
    this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.networkingApi = this.kubeConfig.makeApiClient(NetworkingV1Api);
  }

  async createNamespace(namespaceName: string, tenantId: string): Promise<void> {
    try {
      await this.coreApi.readNamespace(namespaceName);
      console.log(`Namespace ${namespaceName} already exists`);
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        const namespaceSpec = {
          metadata: {
            name: namespaceName,
            labels: {
              'tenant-id': tenantId,
              'cloudlane.io/managed': 'true',
            },
          },
        };

        await this.coreApi.createNamespace(namespaceSpec);
        console.log(`Created namespace ${namespaceName} for tenant ${tenantId}`);
      } else {
        throw error;
      }
    }
  }

  async createDeployment(
    namespace: string,
    deploymentName: string,
    image: string,
    port: number,
    minReplicas: number,
    maxReplicas: number,
    envVars?: Record<string, string>
  ): Promise<void> {
    const env = envVars
      ? Object.entries(envVars).map(([name, value]) => ({ name, value }))
      : [];

    const deploymentSpec = {
      metadata: {
        name: deploymentName,
        namespace,
        labels: {
          app: deploymentName,
          'cloudlane.io/deployment': 'true',
        },
      },
      spec: {
        replicas: minReplicas > 0 ? minReplicas : 0,
        selector: {
          matchLabels: {
            app: deploymentName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: deploymentName,
            },
          },
          spec: {
            containers: [
              {
                name: deploymentName,
                image,
                ports: [
                  {
                    containerPort: port,
                    protocol: 'TCP',
                  },
                ],
                env,
                resources: {
                  requests: {
                    memory: '128Mi',
                    cpu: '100m',
                  },
                  limits: {
                    memory: '512Mi',
                    cpu: '500m',
                  },
                },
              },
            ],
          },
        },
      },
    };

    await this.appsApi.createNamespacedDeployment(namespace, deploymentSpec);
    console.log(`Created deployment ${deploymentName} in namespace ${namespace}`);
  }

  async createService(
    namespace: string,
    serviceName: string,
    port: number,
    targetPort: number
  ): Promise<void> {
    const serviceSpec = {
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          app: serviceName,
        },
      },
      spec: {
        type: 'ClusterIP',
        ports: [
          {
            port,
            targetPort,
            protocol: 'TCP',
          },
        ],
        selector: {
          app: serviceName,
        },
      },
    };

    await this.coreApi.createNamespacedService(namespace, serviceSpec);
    console.log(`Created service ${serviceName} in namespace ${namespace}`);
  }

  async createIngress(
    namespace: string,
    ingressName: string,
    serviceName: string,
    subdomain: string,
    port: number
  ): Promise<void> {
    const ingressSpec = {
      metadata: {
        name: ingressName,
        namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        },
      },
      spec: {
        rules: [
          {
            host: `${subdomain}.${config.baseDomain}`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: port,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
        tls: [
          {
            hosts: [`${subdomain}.${config.baseDomain}`],
            secretName: `${ingressName}-tls`,
          },
        ],
      },
    };

    await this.networkingApi.createNamespacedIngress(namespace, ingressSpec);
    console.log(`Created ingress ${ingressName} for ${subdomain}.${config.baseDomain}`);
  }

  async scaleDeployment(
    namespace: string,
    deploymentName: string,
    replicas: number
  ): Promise<void> {
    const patch = {
      spec: {
        replicas,
      },
    };

    await this.appsApi.patchNamespacedDeploymentScale(
      deploymentName,
      namespace,
      patch
    );
    console.log(`Scaled deployment ${deploymentName} to ${replicas} replicas`);
  }

  async getDeploymentLogs(
    namespace: string,
    deploymentName: string,
    tailLines?: number
  ): Promise<string> {
    const pods = await this.coreApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      `app=${deploymentName}`
    );

    let logs = '';
    for (const pod of pods.body.items) {
      const podLogs = await this.coreApi.readNamespacedPodLog(
        pod.metadata!.name!,
        namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        tailLines || 100
      );
      logs += `[${pod.metadata!.name}]\n${podLogs.body}\n`;
    }

    return logs;
  }

  async deleteDeployment(namespace: string, deploymentName: string): Promise<void> {
    try {
      await this.appsApi.deleteNamespacedDeployment(deploymentName, namespace);
      console.log(`Deleted deployment ${deploymentName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }

  async deleteService(namespace: string, serviceName: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespacedService(serviceName, namespace);
      console.log(`Deleted service ${serviceName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }

  async deleteIngress(namespace: string, ingressName: string): Promise<void> {
    try {
      await this.networkingApi.deleteNamespacedIngress(ingressName, namespace);
      console.log(`Deleted ingress ${ingressName} in namespace ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
    }
  }
}

export default new KubernetesService();
