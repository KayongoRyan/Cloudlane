import axios from 'axios';
import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'cloudlane' });

interface LogsOptions {
  tail?: string;
  follow?: boolean;
}

export async function viewLogs(deploymentName?: string, options: LogsOptions = {}) {
  const apiUrl = config.get('apiUrl') as string || process.env.CLOUDLANE_API_URL || 'http://localhost:3001';
  const apiKey = config.get('apiKey') as string;

  if (!apiKey) {
    console.error(chalk.red('Not logged in. Run "cloudlane login" first.'));
    process.exit(1);
  }

  if (!deploymentName) {
    console.error(chalk.red('Please specify a deployment name.'));
    console.log(chalk.yellow('Usage: cloudlane logs <deployment-name>'));
    process.exit(1);
  }

  try {
    const response = await axios.get(
      `${apiUrl}/api/deployments/${deploymentName}/logs`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
        params: {
          tail: options.tail || 100,
        },
      }
    );

    const logs = response.data.logs;

    console.log(`\n${chalk.bold(`Logs for ${deploymentName}:`)}\n`);
    console.log(chalk.gray(logs));
  } catch (error: any) {
    console.error(chalk.red('Failed to fetch logs'));
    if (error.response?.data?.error) {
      console.error(chalk.red(error.response.data.error));
    } else if (error.response?.status === 404) {
      console.error(chalk.red(`Deployment "${deploymentName}" not found.`));
    }
    process.exit(1);
  }
}
