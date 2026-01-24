import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import patientRoutes from './patientRoutes.js';
import medicalRecordRoutes from './medicalRecordRoutes.js';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/doctor', doctorRoutes);
router.use('/patient', patientRoutes);
router.use('/medical-records', medicalRecordRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
