const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  referenceNumber: { type: String, required: true, unique: true }, // رقم إذن الصرف/الإضافة
  type: { 
    type: String, 
    enum: ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'], 
    default: 'DRAFT' 
  },
  sourceWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }, // للمخرج أو المحول منه
  destWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },   // للمستقبل أو المحول إليه
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('StockMovement', stockMovementSchema);