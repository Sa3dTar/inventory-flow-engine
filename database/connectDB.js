const mongoose = require('mongoose');
const dotenv = require('dotenv')


const connectDB = async () => {
  try {
    // محاولة الاتصال بقاعدة البيانات
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // إنهاء العملية في حال فشل الاتصال لضمان عدم تشغيل الخرف بدون قاعدة بيانات
    process.exit(1);
  }
};

module.exports = connectDB;