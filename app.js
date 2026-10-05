const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./database/connectDB');
const redis = require('./config/redis') // استدعاء ملف الاتصال
const warehouseRoutes = require('./routes/warehouse.router');
const warehouseStockRoutes = require('./routes/warehouseStock.router');
const productRoutes = require('./routes/product.router');
const authRoutes = require('./routes/auth.router');
const stockMovementRoutes = require('./routes/stockmovement.router');
const stockMovementItemRoutes = require('./routes/stockmovementItem.router');
const auditLogRoutes = require('./routes/auditlog.router');




// ربط المسار


const warehouseModel = require('./database/warehouse')

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// الاتصال بقاعدة البيانات
connectDB();

const app = express();

app.use(express.json())

// ربط الـ routes بالمسار الرئيسي
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/warehouse-stocks', warehouseStockRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/stock-movement-items', stockMovementItemRoutes);
app.use('/api/audit-logs', auditLogRoutes);


// 2. تفعيل الـ Route وتحديد مساره الأساسي تحت باقي الـ app.use
// Middleware أساسية
app.use(express.json());

// مسار تجريبي للتأكد من أن السيرفر يعمل
app.get('/', (req, res) => {
  res.json({ message: 'Warehouse API is running successfully...' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});