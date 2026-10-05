const mongoose = require('mongoose');

const warehouseStockSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 0, min: 0 }
}, { timestamps: true });

// لضمان عدم تكرار نفس الصنف داخل نفس المخزن
warehouseStockSchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('WarehouseStock', warehouseStockSchema);