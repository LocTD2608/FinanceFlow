const mongoose = require('mongoose');

/**
 * Kết nối tới MongoDB.
 * Đọc URI từ biến môi trường MONGODB_URI (xem file .env).
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/financeflow_dev';

  try {
    await mongoose.connect(uri);
    console.log(`✅ Kết nối MongoDB thành công! DB: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ Kết nối MongoDB thất bại:', error.message);
    process.exit(1); // Dừng server nếu không kết nối được DB
  }
};

module.exports = connectDB;
