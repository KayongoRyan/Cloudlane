import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';

const config = new Conf({ projectName: 'cloudlane' });

interface LoginOptions {
  email?: string;
  password?: string;
}

export async function login(options: LoginOptions) {
  const apiUrl = process.env.CLOUDLANE_API_URL || 'http://localhost:8001';
  
  let email = options.email;
  let password = options.password;

  if (!email) {
    email = await promptInput('Email: ');
  }

  if (!password) {
    password = await promptPassword('Password: ');
  }

  const spinner = ora('Logging in...').start();

  try {
    const response = await axios.post(`${apiUrl}/api/auth/login`, {
      email,
      password,
    });

    const { token, apiKey } = response.data;

    config.set('token', token);
    config.set('apiKey', apiKey);
    config.set('apiUrl', apiUrl);

    spinner.succeed(chalk.green('Logged in successfully!'));
    console.log(`\n${chalk.blue('API Key:')} ${apiKey}`);
    console.log(`${chalk.yellow('Store this key securely - it won\'t be shown again!')}\n`);
  } catch (error: any) {
    spinner.fail(chalk.red('Login failed'));
    if (error.response?.data?.error) {
      console.error(chalk.red(error.response.data.error));
    } else {
      console.error(chalk.red('Could not connect to Cloudlane API'));
    }
    process.exit(1);
  }
}

async function promptInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function promptPassword(prompt: string): Promise<string> {
  // Simple password input (in production, use a proper password prompt library)
  return promptInput(prompt);
}
