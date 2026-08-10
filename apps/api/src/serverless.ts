import serverless from 'serverless-http';
import app from './app';

const handler = serverless(app as any);

// CommonJS export for compiled output
module.exports = { handler };
