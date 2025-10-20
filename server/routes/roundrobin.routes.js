import { Router } from 'express';
import RoundRobin from '../models/RoundRobin.js';
import Worker from '../models/Worker.js';
import { auth } from '../middleware/auth.js';
import { requireManager } from '../middleware/roles.js';

const router = Router();

async function getOrCreate() {
  let rr = await RoundRobin.findOne().populate('queue');
  if (!rr) {
    const workers = await Worker.find();
    rr = await RoundRobin.create({ queue: workers.map(w => w._id), index: 0 });
    rr = await rr.populate('queue');
  }
  return rr;
}

router.get('/peek', auth, async (_req, res) => {
  const rr = await getOrCreate();
  const next = rr.queue[rr.index] || null;
  res.json({ next, count: rr.queue.length, index: rr.index });
});

router.get('/list', auth, requireManager, async (_req, res) => {
  const rr = await getOrCreate();
  res.json({ queue: rr.queue, index: rr.index });
});

router.get('/me', auth, async (req, res) => {
  const worker = await Worker.findOne({ user: req.user.id });
  if (!worker) return res.json({ assignedToday: 0, assignedMonth: 0 });
  res.json({ assignedToday: worker.assignedToday, assignedMonth: worker.assignedMonth });
});

export default router;