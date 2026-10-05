const Product = require('../database/product'); // تأكد من مسار الـ Model حسب هيكل مشروعك
const redisClient = require('../config/redis');

const CACHE_KEY_ALL = 'products:all';
const CACHE_TTL = 3600; // مدة التخزين المؤقت بالثانية (ساعة واحدة)

// 1. إضافة منتج جديد
exports.createProduct = async (req, res) => {
  try {
    const { 
      name, 
      sku, 
      barcode, 
      description, 
      unitOfMeasure, 
      costPrice, 
      salePrice, 
      minStockLevel 
    } = req.body;

    const product = new Product({
      name,
      sku,
      barcode: barcode || undefined, // لضمان عدم حدوث تكرار لو القيمة فارغة مع خاصية sparse
      description,
      unitOfMeasure,
      costPrice,
      salePrice,
      minStockLevel
    });

    await product.save();

    // مسح الكاش العام لقائمة المنتجات لضمان جلب البيانات الجديدة
    await redisClient.del(CACHE_KEY_ALL);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate value error: The ${field} must be unique.`
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. جلب كل المنتجات (مع استخدام Redis Caching)
exports.getAllProducts = async (req, res) => {
  try {
    // 1. فحص وجود البيانات في الكاش أولاً
    const cachedData = await redisClient.get(CACHE_KEY_ALL);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: JSON.parse(cachedData)
      });
    }

    // 2. جلب المنتجات من قاعدة البيانات لو لم تكن في الكاش
    const products = await Product.find({});

    // 3. تخزين البيانات في Redis بالطريقة المتوافقة مع v4
    await redisClient.set(CACHE_KEY_ALL, JSON.stringify(products), {
      EX: CACHE_TTL
    });

    res.status(200).json({
      success: true,
      source: 'database',
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. جلب منتج واحد بواسطة الـ ID
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    const cacheKey = `product:${productId}`;

    // التحقق من الكاش الفردي للمنتج
    const cachedProduct = await redisClient.get(cacheKey);
    if (cachedProduct) {
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: JSON.parse(cachedProduct)
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // حفظ المنتج في الكاش الفردي بالطريقة المتوافقة مع v4
    await redisClient.set(cacheKey, JSON.stringify(product), {
      EX: CACHE_TTL
    });

    res.status(200).json({
      success: true,
      source: 'database',
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. تحديث بيانات المنتج
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updateData = req.body;

    // لو الـ barcode فاضي أو مش موجود، نتأكد إنه مش بيبعت نص فارغ يعمل مشكلة تكرار مع sparse
    if (updateData.barcode === '') {
      updateData.barcode = undefined;
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // مسح الكاش العام والكاش الخاص بهذا المنتج لضمان تحديث البيانات
    await redisClient.del(CACHE_KEY_ALL);
    await redisClient.del(`product:${productId}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate key error: SKU or Barcode already exists.'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 5. حذف المنتج
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // مسح الكاش المرتبط
    await redisClient.del(CACHE_KEY_ALL);
    await redisClient.del(`product:${productId}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};