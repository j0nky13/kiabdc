import mongoose from 'mongoose';

const SaleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  customer: String,
  vehicle: String,
  status: { type: String, enum: ['prospect', 'appt', 'sold', 'lost'], default: 'prospect' }
}, { timestamps: true });

export default mongoose.model('Sale', SaleSchema);