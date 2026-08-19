import type { ServiceId } from './consoleNavMenus'

export type CatalogService = {
  name: string
  description: string
  /** Opens a live console product when set */
  consoleId?: ServiceId
}

export type ServiceCategory = {
  title: string
  services: CatalogService[]
}

export const CONSOLE_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    title: 'Application Integration',
    services: [
      {
        name: 'Cloudlane B2B Interchange',
        description: 'Build and run EDI-based workflows at cloud scale',
      },
      {
        name: 'Cloudlane EventBridge',
        description: 'Serverless service for building event-driven applications',
        consoleId: 'apis',
      },
      {
        name: 'Managed Apache Airflow',
        description: 'Run Apache Airflow without provisioning or managing servers',
      },
      {
        name: 'Simple Notification Service',
        description: 'SNS managed message topics for Pub/Sub',
      },
      {
        name: 'Simple Queue Service',
        description: 'SQS managed message queues',
      },
      {
        name: 'Step Functions',
        description: 'Coordinate distributed applications',
      },
      {
        name: 'SWF',
        description: 'Workflow service for coordinating application components',
      },
    ],
  },
  {
    title: 'Blockchain',
    services: [
      {
        name: 'Cloudlane Managed Blockchain',
        description: 'Easily access, query, and manage blockchain networks',
      },
    ],
  },
  {
    title: 'Business Applications',
    services: [
      {
        name: 'Cloudlane Chime SDK',
        description: 'Real-time communication for your applications',
      },
      {
        name: 'Cloudlane Connect Customer',
        description: 'Deliver exceptional customer experiences at every touchpoint',
      },
      {
        name: 'Cloudlane Connect Decisions',
        description: 'Adaptive AI teammates that foresee and prevent supply chain disruptions and help you make better decisions',
      },
      {
        name: 'Cloudlane End User Messaging',
        description: 'Engage your customers across multiple communication channels',
      },
      {
        name: 'Cloudlane Pinpoint',
        description: 'Multichannel communication service',
      },
      {
        name: 'Cloudlane Simple Email Service',
        description: 'Email sending and receiving service',
      },
      {
        name: 'Billing and Cost Management',
        description: 'View and pay bills, analyze and govern your spending, and optimize your costs',
        consoleId: 'billing',
      },
      {
        name: 'Cloudlane Billing Conductor',
        description: 'Simplifying your billing practice',
      },
      {
        name: 'Cloudlane Marketplace',
        description: 'Digital catalog where you can find, buy, and deploy software',
        consoleId: 'marketplace',
      },
    ],
  },
  {
    title: 'Cloud Financial Management',
    services: [
      {
        name: 'Billing and Cost Management',
        description: 'View and pay bills, analyze and govern your spending, and optimize your costs',
        consoleId: 'billing',
      },
      {
        name: 'Cloudlane Billing Conductor',
        description: 'Simplifying your billing practice',
      },
      {
        name: 'Cloudlane FinOps Agent',
        description: 'A frontier agent that makes it easy to continuously monitor costs, investigate anomalies, and surface optimization opportunities across your cloud environment',
        consoleId: 'agent',
      },
      {
        name: 'Cloudlane Marketplace',
        description: 'Digital catalog where you can find, buy, and deploy software',
        consoleId: 'marketplace',
      },
    ],
  },
  {
    title: 'Compute',
    services: [
      {
        name: 'Cloudlane App Runner',
        description: 'Build and run production web applications at scale',
        consoleId: 'run',
      },
      {
        name: 'Batch',
        description: 'Fully managed batch processing at any scale',
      },
      {
        name: 'EC2',
        description: 'Virtual servers in the cloud',
        consoleId: 'compute',
      },
      {
        name: 'EC2 Image Builder',
        description: 'A managed service to automate build, customize, and deploy OS images',
      },
      {
        name: 'Lambda',
        description: 'Run code without thinking about servers',
        consoleId: 'run',
      },
      {
        name: 'Parallel Computing Service',
        description: 'Easily run HPC workloads at virtually any scale',
      },
      {
        name: 'Serverless Application Repository',
        description: 'Assemble, deploy, and share serverless applications within teams or publicly',
      },
    ],
  },
  {
    title: 'Containers',
    services: [
      {
        name: 'Elastic Container Registry',
        description: 'Fully managed Docker container registry — share and deploy container software, publicly or privately',
        consoleId: 'storage',
      },
      {
        name: 'Elastic Container Service',
        description: 'Highly secure, reliable, and scalable way to run containers',
        consoleId: 'run',
      },
      {
        name: 'Elastic Kubernetes Service',
        description: 'The most trusted way to start, run, and scale Kubernetes',
        consoleId: 'kubernetes',
      },
    ],
  },
  {
    title: 'Customer Enablement',
    services: [
      {
        name: 'Activate for Startups',
        description: 'Cloudlane Activate provides resources to help startups build and grow on Cloudlane',
      },
      {
        name: 'Managed Services',
        description: 'IT operations management for Cloudlane',
      },
      {
        name: 'Cloudlane re:Post Private',
        description: 'Increase internal collaboration and innovation through a curated cloud knowledge base',
      },
      {
        name: 'Support',
        description: 'Contact Cloudlane for technical and account support',
        consoleId: 'hub-support',
      },
    ],
  },
  {
    title: 'Database',
    services: [
      {
        name: 'DynamoDB',
        description: 'Managed NoSQL database service',
        consoleId: 'databases',
      },
      {
        name: 'ElastiCache',
        description: 'In-memory cache',
      },
      {
        name: 'Cloudlane Keyspaces',
        description: 'Serverless Cassandra-compatible database',
      },
      {
        name: 'Cloudlane MemoryDB',
        description: 'Fully managed, Valkey and Redis OSS-compatible, in-memory database service',
      },
      {
        name: 'Neptune',
        description: 'Fast, reliable graph database built for the cloud',
      },
      {
        name: 'Cloudlane Timestream',
        description: 'Fast, scalable, and serverless time series database for IoT and operational applications',
        consoleId: 'bigquery',
      },
    ],
  },
  {
    title: 'Developer Tools',
    services: [
      {
        name: 'Cloudlane App Studio',
        description: 'Build secure applications that solve business problems with generative AI',
      },
      {
        name: 'Cloudlane AppConfig',
        description: 'Use feature flags, operational flags, experiments, and other runtime configuration to make changes quickly and safely in production',
      },
      {
        name: 'Cloud9',
        description: 'A cloud IDE for writing, running, and debugging code',
      },
      {
        name: 'CloudShell',
        description: 'A browser-based shell with Cloudlane CLI access from the Cloudlane Management Console',
      },
      {
        name: 'CodeArtifact',
        description: 'Secure, scalable, and cost-effective artifact management for software development',
      },
      {
        name: 'CodeBuild',
        description: 'Build and test code',
      },
      {
        name: 'Cloudlane CodeCatalyst',
        description: 'Integrated DevOps service',
      },
      {
        name: 'CodeCommit',
        description: 'Store code in private Git repositories',
      },
      {
        name: 'CodeDeploy',
        description: 'Automate code deployments',
      },
      {
        name: 'CodePipeline',
        description: 'Release software using continuous delivery',
      },
      {
        name: 'Cloudlane DevOps Agent',
        description: 'A frontier agent that resolves and proactively prevents incidents, continuously improving reliability and performance of applications in Cloudlane, multicloud, and hybrid environments',
        consoleId: 'agent',
      },
      {
        name: 'Cloudlane FIS',
        description: 'Improve resiliency and performance with controlled experiments',
      },
      {
        name: 'Infrastructure Composer',
        description: 'Visually design and build modern applications quickly',
      },
      {
        name: 'Kiro',
        description: 'Build applications faster, and spend less time solving software development problems',
      },
      {
        name: 'Cloudlane Q Developer',
        description: 'Build applications faster, and spend less time solving software development problems',
        consoleId: 'agent',
      },
      {
        name: 'X-Ray',
        description: 'Analyze and debug your applications',
      },
    ],
  },
  {
    title: 'End User Computing',
    services: [
      {
        name: 'WorkSpaces',
        description: 'Desktops in the cloud',
      },
      {
        name: 'WorkSpaces Applications',
        description: 'Stream desktop applications securely to any web browser',
      },
      {
        name: 'WorkSpaces Secure Browser',
        description: 'Cloud-native secure web access',
      },
      {
        name: 'WorkSpaces Thin Client',
        description: 'Affordable, easy-to-manage thin client for secure access to virtual desktops',
      },
    ],
  },
  {
    title: 'Front-end Web & Mobile',
    services: [
      {
        name: 'Cloudlane Amplify',
        description: 'Web hosting and app backend services for fullstack developers',
      },
      {
        name: 'Cloudlane AppSync',
        description: 'Real-time data sync using GraphQL for mobile and web apps, online or offline',
      },
      {
        name: 'Device Farm',
        description: 'Test Android, iOS, and web apps on real devices in the cloud',
      },
      {
        name: 'Cloudlane Location Service',
        description: 'Securely and easily add location data to applications',
      },
    ],
  },
  {
    title: 'Game Development',
    services: [
      {
        name: 'Cloudlane GameLift Servers',
        description: 'Deploy and scale session-based multiplayer games',
      },
      {
        name: 'Cloudlane GameLift Streams',
        description: 'Deliver high frame rate, low-latency game streaming at global scale',
      },
    ],
  },
  {
    title: 'Internet of Things',
    services: [
      {
        name: 'IoT Core',
        description: 'Connect devices to the cloud',
      },
      {
        name: 'IoT Device Defender',
        description: 'Secure your fleet of connected IoT devices',
      },
      {
        name: 'IoT Device Management',
        description: 'Securely manage fleets as small as one device, or as broad as millions of devices',
      },
      {
        name: 'Cloudlane IoT FleetWise',
        description: 'Easily collect, organize, and transfer vehicle data to the cloud at scale',
      },
      {
        name: 'IoT Greengrass',
        description: 'Deploy and run code on your devices',
      },
      {
        name: 'IoT SiteWise',
        description: 'Data-driven decisions in industrial operations',
      },
      {
        name: 'IoT TwinMaker',
        description: 'Easily create digital twins of real-world systems to optimize operations',
      },
    ],
  },
  {
    title: 'Machine Learning',
    services: [
      {
        name: 'Cloudlane Agent Registry',
        description: 'Centrally register and discover AI resources',
      },
      {
        name: 'Cloudlane Augmented AI',
        description: 'Easily implement human review of machine learning predictions',
      },
      {
        name: 'Cloudlane Bedrock',
        description: 'The easiest way to build and scale generative AI applications with foundation models (FMs)',
      },
      {
        name: 'Cloudlane Bedrock (mantle endpoint)',
        description: 'Build and scale generative AI applications using industry-standard APIs, optimized for the bedrock-mantle endpoint',
      },
      {
        name: 'Cloudlane Bedrock AgentCore',
        description: 'Deploy and operate highly effective agents securely, at scale using any framework and model',
      },
      {
        name: 'Cloudlane Bio Discovery',
        description: 'Design antibodies with AI-powered lab-in-the-loop workflows',
      },
      {
        name: 'Claude Platform on Cloudlane',
        description: "Use Anthropic's Claude Platform through a native Anthropic experience in Cloudlane",
      },
      {
        name: 'Cloudlane CodeGuru',
        description: 'Intelligent recommendations for building and running modern applications',
      },
      {
        name: 'Cloudlane Comprehend',
        description: 'Analyze unstructured text',
      },
      {
        name: 'Cloudlane Comprehend Medical',
        description: 'Uses machine learning to extract insights and relationships from medical text',
      },
      {
        name: 'Cloudlane DevOps Guru',
        description: 'ML-powered cloud operations service to improve application availability',
      },
      {
        name: 'Cloudlane Forecast',
        description: 'Fully managed service for accurate time-series forecasting',
      },
      {
        name: 'Cloudlane Fraud Detector',
        description: 'Detect more online fraud faster using machine learning',
      },
      {
        name: 'Cloudlane HealthImaging',
        description: 'Store, analyze, and share medical images',
      },
      {
        name: 'Cloudlane HealthLake',
        description: 'Making sense of health data',
      },
      {
        name: 'Cloudlane HealthOmics',
        description: 'Transform omics data into insights',
      },
      {
        name: 'Cloudlane Kendra',
        description: 'Highly accurate enterprise search service powered by machine learning',
      },
      {
        name: 'Cloudlane Lex',
        description: 'Build voice and text chatbots',
      },
      {
        name: 'Cloudlane Lookout for Equipment',
        description: 'Detect abnormal equipment behavior by analyzing sensor data',
      },
      {
        name: 'Cloudlane Monitron',
        description: 'End-to-end system for equipment monitoring',
      },
      {
        name: 'Cloudlane Nova Act',
        description: 'Build and manage AI agents to automate UI workflows',
      },
      {
        name: 'Cloudlane Personalize',
        description: 'Easily add real-time recommendations to your apps',
      },
      {
        name: 'Cloudlane Polly',
        description: 'Turn text into lifelike speech',
      },
      {
        name: 'Cloudlane Q',
        description: 'A generative-AI powered assistant from Cloudlane to help reinvent how you work',
        consoleId: 'agent',
      },
      {
        name: 'Cloudlane Q Business',
        description: 'Generative AI-powered enterprise assistant',
      },
      {
        name: 'Cloudlane Rekognition',
        description: 'Search and analyze images',
      },
      {
        name: 'Cloudlane SageMaker AI',
        description: 'Build, train, and deploy machine learning models',
      },
      {
        name: 'Cloudlane Textract',
        description: 'Easily extract text and data from virtually any document',
      },
      {
        name: 'Cloudlane Transcribe',
        description: 'Powerful speech recognition',
      },
      {
        name: 'Cloudlane Translate',
        description: 'Powerful neural machine translation',
      },
    ],
  },
  {
    title: 'Management & Governance',
    services: [
      {
        name: 'Cloudlane Auto Scaling',
        description: 'Quickly scale your entire application on Cloudlane',
      },
      {
        name: 'CloudFormation',
        description: 'Create and manage resources with templates',
      },
      {
        name: 'CloudTrail',
        description: 'Track user activity and API usage',
      },
      {
        name: 'CloudWatch',
        description: 'Monitor resources and applications',
        consoleId: 'monitoring',
      },
      {
        name: 'Cloudlane Compute Optimizer',
        description: 'Recommend optimal compute resources for your workloads',
      },
      {
        name: 'Cloudlane Config',
        description: 'Track resource inventory and changes',
      },
      {
        name: 'Control Tower',
        description: 'The easiest way to set up and govern a secure, compliant multi-account environment',
      },
      {
        name: 'Cloudlane for SAP',
        description: 'Centrally manage, operate, and innovate with SAP applications',
      },
      {
        name: 'Cloudlane Grafana',
        description: 'Fully managed Grafana service for interactive data visualizations and dashboarding',
        consoleId: 'monitoring',
      },
      {
        name: 'Cloudlane Health Dashboard',
        description: 'Personalized view of Cloudlane service health',
        consoleId: 'hub-health',
      },
      {
        name: 'Incident Manager',
        description: 'Automated incident response plans in Cloudlane Systems Manager',
      },
      {
        name: 'Launch Wizard',
        description: 'Guided deployment for enterprise applications and complex workloads',
      },
      {
        name: 'Cloudlane License Manager',
        description: 'Set rules to manage, discover, and report third-party license usage proactively',
      },
      {
        name: 'Cloudlane Organizations',
        description: 'Central governance and management across Cloudlane accounts',
      },
      {
        name: 'Cloudlane Partner Central',
        description: 'Manage your Cloudlane partnership and selling on Cloudlane Marketplace',
        consoleId: 'marketplace',
      },
      {
        name: 'Cloudlane Prometheus',
        description: 'Fully managed Prometheus-compatible monitoring service',
        consoleId: 'monitoring',
      },
      {
        name: 'Cloudlane Proton',
        description: 'Manage your infrastructure so developers can focus on coding',
      },
      {
        name: 'Cloudlane Q Developer in Chat Applications',
        description: 'Generative AI-powered assistant for monitoring and optimizing Cloudlane resources',
        consoleId: 'agent',
      },
      {
        name: 'Cloudlane Resilience Hub',
        description: 'Define, validate, and track the resiliency of applications on Cloudlane',
      },
      {
        name: 'Cloudlane Resource Explorer',
        description: 'Easily search for and discover relevant resources across Cloudlane',
      },
      {
        name: 'Resource Groups & Tag Editor',
        description: 'Search and group Cloudlane resources',
      },
      {
        name: 'Service Catalog',
        description: 'Create, share, organize, and govern your curated infrastructure as code (IaC) templates',
      },
      {
        name: 'Service Quotas',
        description: 'View and manage your Cloudlane service quotas from a central location',
        consoleId: 'hub-quotas',
      },
      {
        name: 'Cloudlane Sustainability',
        description: 'Track, measure, and review the environmental impact from your Cloudlane usage',
      },
      {
        name: 'Systems Manager',
        description: 'Central place to view and manage Cloudlane resources',
      },
      {
        name: 'Cloudlane Telco Network Builder',
        description: 'Automate the deployment and management of telecom networks on Cloudlane',
      },
      {
        name: 'Trusted Advisor',
        description: 'Optimize performance, improve security, reduce costs',
      },
      {
        name: 'Cloudlane User Notifications',
        description: 'Configure and view notifications from Cloudlane services',
      },
      {
        name: 'Cloudlane Well-Architected Tool',
        description: 'Learn best practices, measure, and improve your workloads',
      },
    ],
  },
  {
    title: 'Media Services',
    services: [
      {
        name: 'Cloudlane Deadline Cloud',
        description: 'Simplified render management',
      },
      {
        name: 'Elemental Appliances & Software',
        description: 'On-premises solutions for video processing and delivery',
      },
      {
        name: 'Elemental Inference',
        description: 'Optimizes video content in real time, expanding audience reach without requiring AI expertise',
      },
      {
        name: 'Cloudlane Interactive Video Service',
        description: 'Managed interactive live streams',
      },
      {
        name: 'Kinesis Video Streams',
        description: 'Capture, process, and store video streams for analytics and machine learning',
      },
      {
        name: 'MediaConnect',
        description: 'Reliable, secure, and flexible transport for live video',
      },
      {
        name: 'MediaConvert',
        description: 'Convert file-based content for broadcast and multiscreen delivery',
      },
      {
        name: 'MediaLive',
        description: 'Convert video inputs into live outputs for broadcast and streaming delivery',
      },
      {
        name: 'MediaPackage',
        description: 'Deliver video to many devices using just-in-time format conversion',
      },
      {
        name: 'MediaTailor',
        description: 'Personalise and monetise multiscreen content with channel assembly and server-side ad insertion',
      },
    ],
  },
  {
    title: 'Migration & Transfer',
    services: [
      {
        name: 'Application Discovery Service',
        description: 'Discover on-premises application inventory and dependencies',
      },
      {
        name: 'Database Migration Service',
        description: 'Managed database migration service',
      },
      {
        name: 'DataSync',
        description: 'Simplify, automate, and accelerate moving data',
      },
      {
        name: 'Cloudlane Elastic VMware Service',
        description: 'The fastest path to migrate and operate VMware workloads on Cloudlane',
      },
      {
        name: 'Cloudlane Mainframe Modernization',
        description: 'Modernize mainframe applications and workloads',
      },
      {
        name: 'Cloudlane Migration Hub',
        description: 'Simplify and accelerate the migration of your data centers to Cloudlane',
      },
      {
        name: 'Cloudlane Snow Family',
        description: 'Large-scale data transport',
      },
      {
        name: 'Cloudlane Transfer Family',
        description: 'Fully managed support for SFTP, FTPS, FTP, and AS2',
      },
      {
        name: 'Cloudlane Transform',
        description: 'AI agents to accelerate and simplify migration and modernization',
      },
      {
        name: 'Cloudlane Transform MGN',
        description: 'Automates lift-and-shift migration',
      },
    ],
  },
  {
    title: 'Networking & Content Delivery',
    services: [
      {
        name: 'API Gateway',
        description: 'Build, deploy, and manage APIs',
        consoleId: 'gateway',
      },
      {
        name: 'Cloudlane App Mesh',
        description: 'Easily monitor and control microservices',
      },
      {
        name: 'Application Recovery Controller',
        description: 'Monitor application recovery readiness and manage failovers',
      },
      {
        name: 'Cloudlane Cloud Map',
        description: 'Build a dynamic map of your cloud',
      },
      {
        name: 'CloudFront',
        description: 'Global content delivery network',
      },
      {
        name: 'Cloudlane Data Transfer Terminal',
        description: 'Location for high-throughput transfer to the cloud',
      },
      {
        name: 'Direct Connect',
        description: 'Dedicated network connection to Cloudlane',
      },
      {
        name: 'Cloudlane Global Accelerator',
        description: "Improve your application's availability and performance using the Cloudlane global network",
      },
      {
        name: 'Route 53',
        description: 'Scalable DNS and domain name registration',
      },
      {
        name: 'Cloudlane Route 53 Global Resolver',
        description: 'Secure anycast DNS resolution',
      },
      {
        name: 'RTB Fabric',
        description: 'Fast, private connectivity for real-time bidding',
      },
      {
        name: 'VPC',
        description: 'Isolated cloud resources',
        consoleId: 'vpc',
      },
    ],
  },
  {
    title: 'Quantum Technologies',
    services: [
      {
        name: 'Cloudlane Braket',
        description: 'Service for exploring, evaluating, and experimenting with quantum computing',
      },
    ],
  },
  {
    title: 'Satellite',
    services: [
      {
        name: 'Ground Station',
        description: 'Communicate with satellites',
      },
    ],
  },
  {
    title: 'Security, Identity, & Compliance',
    services: [
      {
        name: 'Account Access',
        description: 'Account access management',
      },
      {
        name: 'Cloudlane Artifact',
        description: 'Security compliance reports and agreements',
      },
      {
        name: 'Cloudlane Audit Manager',
        description: 'Continuously assess controls for risk and compliance',
      },
      {
        name: 'Certificate Manager',
        description: 'Provision, manage, and deploy SSL/TLS certificates',
      },
      {
        name: 'CloudHSM',
        description: 'Managed hardware security modules in the cloud',
      },
      {
        name: 'Cognito',
        description: 'Consumer identity management and credentials for federated identities',
      },
      {
        name: 'Detective',
        description: 'Investigate and analyze potential security issues',
      },
      {
        name: 'Directory Service',
        description: 'Host and manage Active Directory',
      },
      {
        name: 'Cloudlane Firewall Manager',
        description: 'Central management of firewall rules',
      },
      {
        name: 'GuardDuty',
        description: 'Intelligent threat detection to protect your Cloudlane accounts and workloads',
        consoleId: 'security',
      },
      {
        name: 'IAM',
        description: 'Manage access to Cloudlane resources',
        consoleId: 'iam',
      },
      {
        name: 'IAM Identity Center',
        description: 'Manage workforce user access to multiple Cloudlane accounts and cloud applications',
      },
      {
        name: 'Cloudlane Inspector',
        description: 'Continual vulnerability management at scale',
      },
      {
        name: 'Key Management Service',
        description: 'Securely generate and manage Cloudlane encryption keys',
      },
      {
        name: 'Cloudlane Macie',
        description: 'Classifies and secures your business-critical content',
      },
      {
        name: 'Cloudlane Payment Cryptography',
        description: 'On-demand payment HSM functionality for card transactions and key management',
      },
      {
        name: 'Cloudlane Private Certificate Authority',
        description: 'Managed private certificate authority service',
      },
      {
        name: 'Resource Access Manager',
        description: 'Share Cloudlane resources with other accounts or organizations',
      },
      {
        name: 'Secrets Manager',
        description: 'Easily rotate, manage, and retrieve secrets throughout their lifecycle',
      },
      {
        name: 'Cloudlane Security Agent',
        description: 'Proactively secure your applications throughout the development lifecycle',
      },
      {
        name: 'Security Hub',
        description: 'Detect, prioritize, and respond to critical cloud security issues faster',
        consoleId: 'security',
      },
      {
        name: 'Security Hub CSPM',
        description: 'Automated security checks across your Cloudlane environment',
      },
      {
        name: 'Cloudlane Security Incident Response',
        description: 'Quickly prepare for, respond to, and recover from security incidents',
      },
      {
        name: 'Security Lake',
        description: 'Automatically centralize all your security data with a few clicks',
      },
      {
        name: 'Cloudlane Signer',
        description: 'Ensuring trust and integrity of your code',
      },
      {
        name: 'Cloudlane Verified Permissions',
        description: 'Manage, analyze, and enforce permissions across your applications',
      },
      {
        name: 'WAF & Shield',
        description: 'Protects against DDoS attacks and malicious web traffic',
      },
    ],
  },
  {
    title: 'Storage',
    services: [
      {
        name: 'Cloudlane Backup',
        description: 'Centrally manage and automate backups across Cloudlane services',
      },
      {
        name: 'EFS',
        description: 'Managed file storage for EC2',
      },
      {
        name: 'Cloudlane Elastic Disaster Recovery',
        description: 'Scalable, cost-effective application recovery to Cloudlane',
      },
      {
        name: 'FSx',
        description: 'Fully managed third-party file systems optimized for a variety of workloads',
      },
      {
        name: 'Recycle Bin',
        description: 'Protect resources from accidental deletion',
      },
      {
        name: 'S3',
        description: 'Scalable storage in the cloud',
        consoleId: 'storage',
      },
      {
        name: 'S3 Glacier',
        description: 'S3 Glacier API for vaults only. For Glacier Deep Archive, Flexible Retrieval, or Instant Retrieval storage classes, use the S3 console',
      },
      {
        name: 'Storage Gateway',
        description: 'Hybrid storage integration',
      },
    ],
  },
]

export const CONSOLE_QUICK_CATEGORIES = [
  'Application Integration',
  'Compute',
  'Containers',
  'Database',
]
