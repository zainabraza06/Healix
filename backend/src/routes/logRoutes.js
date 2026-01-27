import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLogs, getUserActivitySummary } from '../services/logService.js';

const router = express.Router();

router.use(authenticate);

// Get all logs (Admin only)
router.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 50;
    const filters = {
      userId: req.query.userId,
      level: req.query.level,
      action: req.query.action,
      entityType: req.query.entityType,
      status: req.query.status,
    };

    const result = await getLogs(filters, page, size);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get user activity (Patient/Doctor can view own activity)
router.get('/activity/my', async (req, res, next) => {
  try {
    const activity = await getUserActivitySummary(req.user._id);
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
});

// Get specific user activity (Admin only)
router.get('/user/:userId', authorize('ADMIN'), async (req, res, next) => {
  try {
    const activity = await getUserActivitySummary(req.params.userId);
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
});

export default router;
