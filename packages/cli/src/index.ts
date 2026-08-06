#!/usr/bin/env node

import { Command } from 'commander';
import { login } from './commands/login.js';
import { deploy } from './commands/deploy.js';
import { listDeployments } from './commands/list.js';
import { viewLogs } from './commands/logs.js';
import { logout } from './commands/logout.js';

const program = new Command();

program
  .name('cloudlane')
  .description('Cloudlane CLI - Deploy containers, get live URLs')
  .version('0.1.0');

program
  .command('login')
  .description('Log in to Cloudlane')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --password <password>', 'Password (or enter interactively)')
  .action(login);

program
  .command('deploy')
  .description('Deploy a container image')
  .requiredOption('-i, --image <image>', 'Container image (e.g., myrepo/app:v1)')
  .option('-n, --name <name>', 'Deployment name (auto-generated if not provided)')
  .option('-p, --port <port>', 'Container port', '8080')
  .option('--no-scale-to-zero', 'Disable scale-to-zero')
  .action(deploy);

program
  .command('list')
  .description('List all deployments')
  .action(listDeployments);

program
  .command('logs [deployment]')
  .description('View logs for a deployment')
  .option('-t, --tail <lines>', 'Number of lines to show', '100')
  .option('-f, --follow', 'Follow log output (not yet implemented)')
  .action(viewLogs);

program
  .command('logout')
  .description('Log out from Cloudlane')
  .action(logout);

program.parse();
