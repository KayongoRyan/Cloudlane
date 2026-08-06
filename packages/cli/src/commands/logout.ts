import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'cloudlane' });

export async function logout() {
  config.clear();
  console.log(chalk.green('Logged out successfully!'));
}
