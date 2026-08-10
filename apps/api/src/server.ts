import mongoose from 'mongoose';
import config from './config';
import app from './app';

async function startServer() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
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
