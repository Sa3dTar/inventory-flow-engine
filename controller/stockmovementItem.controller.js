const mongoose = require('mongoose');
const StockMovementItem = require('../database/stockmovementItem'); // تم التصحيح لـ database
const StockMovement = require('../database/stockmovement');         // تم التصحيح لـ database
const Product = require('../database/product');                     // تم التصحيح لـ database
const redis = require('../config/redis');

// دوال مساعدة لإدارة الـ Locks في Redis
const acquireLock = async (key, ttl = 5000) => {
  const result = await redis.set(key, 'locked', 'PX', ttl, 'NX');
  return result === 'OK';
};

const releaseLock = async (key) => {
  await redis.del(key);
};

// 1. إضافة عنصر جديد لحركة مخزنية (مع Transaction و Lock)
exports.createMovementItem = async (req, res) => {
  const { movementId, productId, quantity, unitCost } = req.body;
  const lockKey = `lock:product:${productId}`;

  const isLocked = await acquireLock(lockKey);
  if (!isLocked) {
    return res.status(429).json({ error: 'Too many concurrent requests for this product. Please try again.' });
  }

  try {
    const movement = await StockMovement.findById(movementId);
    const product = await Product.findById(productId);

    if (!movement || !product) {
      await releaseLock(lockKey);
      return res.status(404).json({ error: 'Movement or Product not found' });
    }

    const newItem = new StockMovementItem({
      movementId,
      productId,
      quantity,
      unitCost
    });

    await newItem.save();

    await releaseLock(lockKey);

    // مسح الكاش الخاص بحركة المخزون هذه
    await redis.del(`movement:items:${movementId}`);

    res.status(201).json({
      message: 'Stock movement item created successfully',
      data: newItem
    });
  } catch (error) {
    await releaseLock(lockKey);
    res.status(500).json({ error: error.message });
  }
};
// 2. جلب جميع العناصر الخاصة بحركة مخزنية معينة (مع Caching متوافق مع Redis v4)
exports.getItemsByMovement = async (req, res) => {
  try {
    const { movementId } = req.params;
    const cacheKey = `movement:items:${movementId}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        source: 'cache',
        data: JSON.parse(cachedData)
      });
    }

    const items = await StockMovementItem.find({ movementId })
      .populate('productId', 'name sku')
      .lean();

    // استخدام صياغة Redis v4 الصحيحة للـ EX
    await redis.set(cacheKey, JSON.stringify(items), { EX: 600 });

    res.status(200).json({
      source: 'database',
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. جلب عنصر واحد بالتفصيل (مع Caching)
exports.getMovementItemById = async (req, res) => {
  try {
    const itemId = req.params.id;
    const cacheKey = `movement:item:${itemId}`;

    const cachedItem = await redis.get(cacheKey);
    if (cachedItem) {
      return res.status(200).json({ source: 'cache', data: JSON.parse(cachedItem) });
    }

    const item = await StockMovementItem.findById(itemId)
      .populate('movementId')
      .populate('productId')
      .lean();

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await redis.set(cacheKey, JSON.stringify(item), { EX: 600 });

    res.status(200).json({ source: 'database', data: item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. تحديث عنصر (مع تحديث/مسح الكاش المرتبط)
exports.updateMovementItem = async (req, res) => {
  try {
    const itemId = req.params.id;
    const { quantity, unitCost } = req.body;

    // تم تصحيح الخطأ البرمجي من new: key = true إلى new: true
    const updatedItem = await StockMovementItem.findByIdAndUpdate(
      itemId,
      { quantity, unitCost },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await redis.del(`movement:item:${itemId}`);
    await redis.del(`movement:items:${updatedItem.movementId}`);

    res.status(200).json({
      message: 'Stock movement item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. حذف عنصر (مع مسح الكاش المرتبط وتأمين العملية)
exports.deleteMovementItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const itemId = req.params.id;
    const item = await StockMovementItem.findByIdAndDelete(itemId).session(session);

    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Item not found' });
    }

    await session.commitTransaction();
    session.endSession();

    await redis.del(`movement:item:${itemId}`);
    await redis.del(`movement:items:${item.movementId}`);

    res.status(200).json({ message: 'Stock movement item deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};