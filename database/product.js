const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true }, // كود فريد
  barcode: { type: String, unique: true, sparse: true },
  description: { type: String },
  unitOfMeasure: { type: String, default: 'pcs' }, // وحدة القياس
  costPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  minStockLevel: { type: Number, default: 5 } // حد إعادة الطلب للتنبيهات
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);