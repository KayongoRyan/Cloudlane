import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';

const config = new Conf({ projectName: 'cloudlane' });

interface DeployOptions {
  image: string;
  name?: string;
  port: string;
  scaleToZero?: boolean;
}

export async function deploy(options: DeployOptions) {
  const apiUrl = config.get('apiUrl') as string || process.env.CLOUDLANE_API_URL || 'http://localhost:3001';
  const apiKey = config.get('apiKey') as string;

  if (!apiKey) {
    console.error(chalk.red('Not logged in. Run "cloudlane login" first.'));
    process.exit(1);
  }

  const deploymentName = options.name || generateDeploymentName();

  const spinner = ora(`Deploying ${options.image}...`).start();

  try {
    const response = await axios.post(
      `${apiUrl}/api/deployments`,
      {
        name: deploymentName,
        image: options.image,
        port: parseInt(options.port, 10),
        scaleToZero: options.scaleToZero !== false,
      },
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    const { subdomain, status } = response.data.deployment;

    spinner.succeed(chalk.green('Deployment successful!'));
    console.log(`\n${chalk.blue('Name:')} ${deploymentName}`);
    console.log(`${chalk.blue('Image:')} ${options.image}`);
    console.log(`${chalk.blue('Status:')} ${status}`);
    console.log(`${chalk.green('URL:')} https://${subdomain}.cloudlane.run\n`);
  } catch (error: any) {
    spinner.fail(chalk.red('Deployment failed'));
    if (error.response?.data?.error) {
      console.error(chalk.red(error.response.data.error));
    } else {
      console.error(chalk.red('Could not connect to Cloudlane API'));
    }
    process.exit(1);
  }
}

function generateDeploymentName(): string {
  const adjectives = ['happy', 'quick', 'silent', 'bright', 'calm', 'swift'];
  const nouns = ['river', 'mountain', 'forest', 'ocean', 'valley', 'peak'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const suffix = Math.random().toString(36).substring(2, 6);
  
  return `${adj}-${noun}-${suffix}`;
}
