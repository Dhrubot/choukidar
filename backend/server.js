const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection (cleaned up - no deprecated options)
mongoose.connect(process.env.MONGODB_URI);

// Database connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('❌ MongoDB connection error:', err);
});

// Routes
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/admin', require('./src/routes/admin'));

// NEW SAFE ZONES ROUTES
app.use('/api/safezones', require('./src/routes/safeZones'));

// Health check
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     message: 'SafeStreets API is running!',
//     timestamp: new Date().toISOString(),
//     database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
//   });
// });

app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'SafeStreets API is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    features: {
      reports: 'active',
      admin: 'active',
      safeZones: 'active', //
      routing: 'client-side' // (handled by frontend)
    },
    version: '3B-Intelligence'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'SafeStreets Bangladesh API - Phase 3B',
    version: '3.1.0',
    features: ['Crime Reports', 'Admin Management', 'Safe Zones', 'Route Intelligence'],
    endpoints: {
      reports: {
        public: '/api/reports',
        admin: '/api/admin/reports'
      },
      safeZones: {
        public: '/api/safezones',
        admin: '/api/safezones/admin'
      },
      health: '/api/health'
    },
    documentation: 'See README.md for complete API documentation',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
// app.use('/{*catchall}', (req, res) => {
//   res.status(404).json({ message: 'Route not found' });
// });
// 404 handler
app.use('/{*catchall}', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    availableEndpoints: [
      '/api/reports',
      '/api/admin',
      '/api/safezones',
      '/api/health'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SafeStreets Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗺️  API Overview: http://localhost:${PORT}/api`);
  console.log(`🛡️  Safe Zones: http://localhost:${PORT}/api/safezones`);
  console.log(`📊 Features: Crime Reports, Admin Panel, Safe Zones, Route Intelligence`);
});