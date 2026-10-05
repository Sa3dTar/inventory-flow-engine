const Warehouse = require('../database/warehouse');
const redisClient = require('../config/redis'); // استدعاء عميل ريديس

const CACHE_KEY = 'warehouses:all';
const CACHE_TTL = 3600; // مدة التخزين المؤقت بالثانية (ساعة واحدة)

// 1. إنشاء مخزن جديد
exports.createWarehouse = async (req, res) => {
  try {
    const { name, location, description } = req.body;

    const warehouse = new Warehouse({ name, location, description });
    await warehouse.save();

    // مسح الـ Cache القديم لكي يتم جلب البيانات المحدثة في المرة القادمة
    await redisClient.del(CACHE_KEY);

    res.status(201).json({
      success: true,
      message: 'Warehouse created successfully',
      data: warehouse
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A warehouse with this name already exists.' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. جلب كل المخازن (مع استخدام Redis Caching)
exports.getAllWarehouses = async (req, res) => {
  try {
    // 1. فحص هل البيانات موجودة في Redis أولاً؟
    const cachedData = await redisClient.get(CACHE_KEY);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache', // مؤشر لتعرف أن البيانات جاءت من الـ Redis مباشرة (سرعة فائقة)
        data: JSON.parse(cachedData)
      });
    }

    // 2. لو مش موجودة، جلبها من MongoDB
    const warehouses = await Warehouse.find({});

    // 3. تخزين البيانات في Redis للاستخدام القادم
    await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(warehouses));

    res.status(200).json({
      success: true,
      source: 'database',
      count: warehouses.length,
      data: warehouses
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. جلب مخزن واحد بواسطة الـ ID
exports.getWarehouseById = async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const cacheKey = `warehouse:${warehouseId}`;

    // فحص Cache الخاص بالمخزن الفردي
    const cachedWarehouse = await redisClient.get(cacheKey);
    if (cachedWarehouse) {
      return res.status(200).json({ success: true, source: 'cache', data: JSON.parse(cachedWarehouse) });
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // حفظه في الكاش
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(warehouse));

    res.status(200).json({ success: true, source: 'database', data: warehouse });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. تحديث بيانات المخزن
exports.updateWarehouse = async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const { name, location, description, isActive } = req.body;

    const warehouse = await Warehouse.findByIdAndUpdate(
      warehouseId,
      { name, location, description, isActive },
      { new: true, runValidators: true }
    );

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // مسح الكاش القديم للقائمة وللمخزن نفسه لتحديث البيانات
    await redisClient.del(CACHE_KEY);
    await redisClient.del(`warehouse:${warehouseId}`);

    res.status(200).json({
      success: true,
      message: 'Warehouse updated successfully',
      data: warehouse
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Warehouse name already in use.' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. حذف أو تعطيل المخزن
exports.deleteWarehouse = async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const warehouse = await Warehouse.findByIdAndUpdate(
      warehouseId,
      { isActive: false },
      { new: true }
    );

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // مسح الكاش
    await redisClient.del(CACHE_KEY);
    await redisClient.del(`warehouse:${warehouseId}`);

    res.status(200).json({
      success: true,
      message: 'Warehouse deactivated successfully',
      data: warehouse
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};