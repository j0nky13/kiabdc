import mongoose from 'mongoose';

const RoundRobinSchema = new mongoose.Schema({
  queue: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],
  index: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('RoundRobin', RoundRobinSchema);