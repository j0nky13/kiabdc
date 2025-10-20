import mongoose from 'mongoose';

const WorkerSchema = new mongoose.Schema({
  name: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedToday: { type: Number, default: 0 },
  assignedMonth: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Worker', WorkerSchema);