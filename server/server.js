import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import rrRoutes from './routes/roundrobin.routes.js';
import salesRoutes from './routes/sales.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || '*', credentials: true }));
app.use(morgan('dev'));

app.get('/', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/roundrobin', rrRoutes);
app.use('/sales', salesRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => console.log(`API on :${PORT}`));
});