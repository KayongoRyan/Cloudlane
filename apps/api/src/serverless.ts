import dns from 'node:dns';
import serverless from 'serverless-http';
import app from './app';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const handler = serverless(app as any);

module.exports = { handler };
