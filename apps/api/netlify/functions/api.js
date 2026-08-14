try {
  require('node:dns').setDefaultResultOrder('ipv4first');
} catch (_) { /* ignore */ }

const { handler } = require('../../dist/serverless');

exports.handler = handler;
