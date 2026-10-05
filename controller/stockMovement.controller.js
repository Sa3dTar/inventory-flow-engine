const StockMovement = require('../database/stockmovement'); // مسار نموذج الحركة
const StockMovementItem = require('../database/stockmovementItem'); // مسار تفاصيل الحركات
const WarehouseStock = require('../database/warehouseStock'); // مسار رصيد المخزن اللي عملناه قبل كده

// 1. إنشاء حركة مخزون جديدة (بوضع DRAFT)
exports.createStockMovement = async (req, res) => {
  try {
    const { referenceNumber, type, sourceWarehouseId, destWarehouseId, notes, items } = req.body;
    const createdById = req.user ? req.user.id : req.body.createdById; // بالاعتماد على الـ Auth Middleware لو موجود

    // التحقق من وجود المنتجات والكميات
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Movement must contain at least one item.' });
    }

    // إنشاء الحركة الأساسية
    const movement = new StockMovement({
      referenceNumber,
      type,
      status: 'DRAFT',
      sourceWarehouseId: sourceWarehouseId || undefined,
      destWarehouseId: destWarehouseId || undefined,
      createdById,
      notes
    });

    await movement.save();

    // حفظ تفاصيل المنتجات والكميات المرتبطة بالحركة
    const movementItems = items.map(item => ({
      movementId: movement._id,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost
    }));

    await StockMovementItem.insertMany(movementItems);

    res.status(201).json({
      success: true,
      message: 'Stock movement created successfully as DRAFT',
      data: { movement, items: movementItems }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Reference number must be unique.' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. جلب كل حركات المخزون
exports.getAllStockMovements = async (req, res) => {
  try {
    const movements = await StockMovement.find({})
      .populate('sourceWarehouseId', 'name')
      .populate('destWarehouseId', 'name')
      .populate('createdById', 'name email');

    res.status(200).json({ success: true, count: movements.length, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. جلب حركة مخزون معينة بالـ ID مع تفاصيلها
exports.getStockMovementById = async (req, res) => {
  try {
    const movement = await StockMovement.findById(req.params.id)
      .populate('sourceWarehouseId', 'name')
      .populate('destWarehouseId', 'name')
      .populate('createdById', 'name email');

    if (!movement) {
      return res.status(404).json({ success: false, message: 'Stock movement not found.' });
    }

    const items = await StockMovementItem.find({ movementId: movement._id }).populate('productId', 'name sku unitOfMeasure');

    res.status(200).json({ success: true, data: { movement, items } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. تأكيد الحركة وتحديث المخزون الفعلي (CONFIRMED)
exports.confirmStockMovement = async (req, res) => {
  try {
    const movementId = req.params.id;
    const movement = await StockMovement.findById(movementId);

    if (!movement) {
      return res.status(404).json({ success: false, message: 'Stock movement not found.' });
    }

    if (movement.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: `Movement is already ${movement.status}.` });
    }

    const items = await StockMovementItem.find({ movementId });
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items found for this movement.' });
    }

    // تنفيذ تحديث الأرصدة بناءً على نوع الحركة
    for (const item of items) {
      const { productId, quantity } = item;

      if (movement.type === 'IN') {
        // إضافة للمستودع الوجهة
        if (!movement.destWarehouseId) return res.status(400).json({ success: false, message: 'Destination warehouse is required for IN movements.' });
        
        await WarehouseStock.findOneAndUpdate(
          { warehouseId: movement.destWarehouseId, productId },
          { $inc: { quantity: quantity } },
          { upsert: true, new: true }
        );
      } 
      else if (movement.type === 'OUT') {
        // خصم من المستودع المصدر
        if (!movement.sourceWarehouseId) return res.status(400).json({ success: false, message: 'Source warehouse is required for OUT movements.' });
        
        const stock = await WarehouseStock.findOne({ warehouseId: movement.sourceWarehouseId, productId });
        if (!stock || stock.quantity < quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for product ID: ${productId}` });
        }

        stock.quantity -= quantity;
        await stock.save();
      } 
      else if (movement.type === 'TRANSFER') {
        // خصم من المصدر وإضافة للوجهة
        if (!movement.sourceWarehouseId || !movement.destWarehouseId) {
          return res.status(400).json({ success: false, message: 'Both source and destination warehouses are required for transfers.' });
        }

        const sourceStock = await WarehouseStock.findOne({ warehouseId: movement.sourceWarehouseId, productId });
        if (!sourceStock || sourceStock.quantity < quantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock in source warehouse for product ID: ${productId}` });
        }

        sourceStock.quantity -= quantity;
        await sourceStock.save();

        await WarehouseStock.findOneAndUpdate(
          { warehouseId: movement.destWarehouseId, productId },
          { $inc: { quantity: quantity } },
          { upsert: true, new: true }
        );
      }
    }

    // تحديث حالة الحركة إلى مؤكدة
    movement.status = 'CONFIRMED';
    await movement.save();

    res.status(200).json({ success: true, message: 'Stock movement confirmed and inventories updated successfully.', data: movement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. إلغاء الحركة (CANCELLED)
exports.cancelStockMovement = async (req, res) => {
  try {
    const movement = await StockMovement.findById(req.params.id);
    if (!movement) {
      return res.status(404).json({ success: false, message: 'Stock movement not found.' });
    }

    if (movement.status === 'CONFIRMED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a confirmed movement directly. Reverse it instead.' });
    }

    movement.status = 'CANCELLED';
    await movement.save();

    res.status(200).json({ success: true, message: 'Stock movement cancelled successfully.', data: movement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};