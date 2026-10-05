const mongoose = require('mongoose');

const stockMovementItemSchema = new mongoose.Schema({
  movementId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('StockMovementItem', stockMovementItemSchema);