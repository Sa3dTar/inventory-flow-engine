const WarehouseStock = require('../database/warehouseStock');
const redisClient = require('../config/redis');

const CACHE_KEY_ALL = 'warehouses:stock:all';
const CACHE_TTL = 3600; // مدة التخزين المؤقت بالثانية (ساعة واحدة)

// 1. إضافة مخزون جديد أو ربط صنف بمخزن
exports.createWarehouseStock = async (req, res) => {
  try {
    const { warehouseId, productId, quantity } = req.body;

    const stockItem = new WarehouseStock({
      warehouseId,
      productId,
      quantity
    });

    await stockItem.save();

    // مسح الكاش العام لأن القائمة تغيرت
    await redisClient.del(CACHE_KEY_ALL);

    res.status(201).json({
      success: true,
      message: 'Stock item added successfully to the warehouse',
      data: stockItem
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This product already exists in this warehouse. Use update instead.'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. جلب كل عناصر المخزون لكل المخازن (مع Redis Caching)
exports.getAllWarehouseStocks = async (req, res) => {
  try {
    // التحقق من وجود البيانات في الكاش أولاً
    const cachedData = await redisClient.get(CACHE_KEY_ALL);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: JSON.parse(cachedData)
      });
    }

    // جلب البيانات من قاعدة البيانات مع جلب تفاصيل المخزن والصنف
    const stocks = await WarehouseStock.find({})
      .populate('warehouseId', 'name location')
      .populate('productId', 'name sku price');

    // تخزين البيانات في Redis بالطريقة الصحيحة لإصدار v4
    await redisClient.set(CACHE_KEY_ALL, JSON.stringify(stocks), { EX: CACHE_TTL });

    res.status(200).json({
      success: true,
      source: 'database',
      count: stocks.length,
      data: stocks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. جلب مخزون صنف معين داخل مخزن معين بواسطة الـ ID الخاص بسجل الـ Stock
exports.getWarehouseStockById = async (req, res) => {
  try {
    const stockId = req.params.id;
    const cacheKey = `warehouse:stock:${stockId}`;

    const cachedStock = await redisClient.get(cacheKey);
    if (cachedStock) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: JSON.parse(cachedStock)
      });
    }

    const stockItem = await WarehouseStock.findById(stockId)
      .populate('warehouseId', 'name location')
      .populate('productId', 'name sku price');

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse stock record not found'
      });
    }

    // تخزين البيانات في Redis بالطريقة الصحيحة لإصدار v4
    await redisClient.set(cacheKey, JSON.stringify(stockItem), { EX: CACHE_TTL });

    res.status(200).json({
      success: true,
      source: 'database',
      data: stockItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. تحديث كمية المخزون (زيادة أو نقصان أو تعديل مباشر)
exports.updateWarehouseStock = async (req, res) => {
  try {
    const stockId = req.params.id;
    const { quantity } = req.body;

    const stockItem = await WarehouseStock.findByIdAndUpdate(
      stockId,
      { quantity },
      { new: true, runValidators: true }
    );

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse stock record not found'
      });
    }

    // مسح الكاش المرتبط لضمان جلب البيانات المحدثة
    await redisClient.del(CACHE_KEY_ALL);
    await redisClient.del(`warehouse:stock:${stockId}`);

    res.status(200).json({
      success: true,
      message: 'Stock quantity updated successfully',
      data: stockItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 5. حذف سجل المخزون
exports.deleteWarehouseStock = async (req, res) => {
  try {
    const stockId = req.params.id;

    const stockItem = await WarehouseStock.findByIdAndDelete(stockId);

    if (!stockItem) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse stock record not found'
      });
    }

    // مسح الكاش
    await redisClient.del(CACHE_KEY_ALL);
    await redisClient.del(`warehouse:stock:${stockId}`);

    res.status(200).json({
      success: true,
      message: 'Stock record deleted successfully',
      data: stockItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};