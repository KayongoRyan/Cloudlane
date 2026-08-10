// Vercel serverless entry that forwards requests to the compiled serverless handler
try {
    const mod = require('./apps/api/dist/serverless.js');
    // prefer named export `handler`
    const handler = mod.handler || mod.default || mod;
    module.exports = handler;
} catch (err) {
    // Fallback: return a simple handler that reports build error
    module.exports = (req, res) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Serverless handler not available', details: String(err) }));
    };
}
