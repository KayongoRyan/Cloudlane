import config from './config';
import app from './app';
import { initializeDatabase } from './database';

async function startServer() {
    try {
        await initializeDatabase();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exitCode = 1;
        return;
    }

    app.listen(config.port, () => {
        console.log(`Cloudlane API running on port ${config.port}`);
        console.log(`Environment: ${config.environment}`);
    });
}

if (require.main === module) {
    startServer();
}

export { startServer };
