const { createClient } = require('redis');

// إنشاء العميل، ويمكنك وضع رابط الـ Redis من متغيرات البيئة (.env)
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// دالة اتصال لتبدأ مع السيرفر
const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Redis Connected successfully...');
  }
};

connectRedis();

module.exports = redisClient;