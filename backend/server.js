// Broadloom Image Converter - Backend API Server
// Version: 1.0.0

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./db');
const patternsRouter = require('./routes/patterns');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for frontend requests
app.use(bodyParser.json({ limit: '50mb' })); // Support large base64 images
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/patterns', patternsRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Broadloom Pattern API',
        version: '1.0.0',
        endpoints: {
            patterns: '/api/patterns',
            health: '/health'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await db.testConnection();
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Please check your configuration.');
            console.error('Make sure PostgreSQL is running and .env file is configured correctly.');
            process.exit(1);
        }

        // Start listening
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log('🚀 Broadloom Pattern API Server');
            console.log('='.repeat(60));
            console.log(`✅ Server running on: http://localhost:${PORT}`);
            console.log(`✅ API endpoint: http://localhost:${PORT}/api/patterns`);
            console.log(`✅ Health check: http://localhost:${PORT}/health`);
            console.log('='.repeat(60));
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server gracefully...');
    db.pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing server gracefully...');
    db.pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});

// Start the server
startServer();


