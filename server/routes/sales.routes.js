import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Sale from '../models/Sale.js';

const router = Router();

router.get('/mine', auth, async (req, res) => {
  const sales = await Sale.find({ user: req.user.id }).sort({ date: -1 }).limit(50);
  res.json({ sales });
});

export default router;