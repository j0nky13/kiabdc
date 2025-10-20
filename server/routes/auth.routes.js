import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireManager } from '../middleware/roles.js';
import Worker from '../models/Worker.js';

const router = Router();

router.post('/workers', auth, requireManager, async (req, res) => {
  const { name, userId } = req.body;
  const w = await Worker.create({ name, user: userId });
  res.json({ worker: w });
});

export default router;