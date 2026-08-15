import axios from 'axios';
import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'cloudlane' });

export async function listDeployments() {
  const apiUrl = config.get('apiUrl') as string || process.env.CLOUDLANE_API_URL || 'http://localhost:3001';
  const apiKey = config.get('apiKey') as string;

  if (!apiKey) {
    console.error(chalk.red('Not logged in. Run "cloudlane login" first.'));
    process.exit(1);
  }

  try {
    const response = await axios.get(`${apiUrl}/api/deployments`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    const deployments = response.data.deployments || [];

    if (deployments.length === 0) {
      console.log(chalk.yellow('No deployments found.'));
      return;
    }

    console.log(`\n${chalk.bold('Deployments:')}\n`);
    console.log(
      chalk.cyan(
        'NAME'.padEnd(25) +
        'STATUS'.padEnd(15) +
        'URL'.padEnd(40) +
        'IMAGE'
      )
    );
    console.log('─'.repeat(90));

    deployments.forEach((d: any) => {
      const url = d.publicUrl || (d.subdomain ? `https://${d.subdomain}.cloudlane.run` : '');
      console.log(
        chalk.white(d.name.padEnd(25)) +
        chalk.green(d.status.padEnd(15)) +
        chalk.blue(url.padEnd(40)) +
        chalk.gray(d.image)
      );
    });

    console.log();
  } catch (error: any) {
    console.error(chalk.red('Failed to fetch deployments'));
    if (error.response?.data?.error) {
      console.error(chalk.red(error.response.data.error));
    }
    process.exit(1);
  }
}
