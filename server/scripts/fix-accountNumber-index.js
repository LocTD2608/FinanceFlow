/**
 * Migration script: Fix E11000 duplicate key on accountNumber: null
 *
 * Vấn đề: Index cũ dùng { unique: true, sparse: true } — sparse chỉ bỏ qua field
 * MISSING (undefined), không bỏ qua null. Mỗi ví mới tạo lưu accountNumber: null
 * → index gom tất cả null vào cùng 1 slot → E11000 từ user thứ 2 trở đi.
 *
 * Fix: Dùng partialFilterExpression: { accountNumber: { $type: 'string' } }
 * → chỉ index các document có accountNumber là string thực sự.
 *
 * Cách chạy:
 *   node server/scripts/fix-accountNumber-index.js
 *
 * Hoặc set biến môi trường:
 *   MONGO_URI=<your-uri> node server/scripts/fix-accountNumber-index.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌  Không tìm thấy MONGO_URI / MONGODB_URI trong .env');
  process.exit(1);
}

(async () => {
  try {
    console.log('🔌  Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected');

    const db = mongoose.connection.db;
    const col = db.collection('wallets');

    // Liệt kê index hiện tại
    const before = await col.indexes();
    console.log('\n📋  Indexes before:');
    before.forEach(i => console.log('   -', JSON.stringify(i)));

    // Drop index cũ (có thể là "accountNumber_1" hoặc tên khác)
    const oldIndex = before.find(i => i.key && i.key.accountNumber !== undefined && i.name !== '_id_');
    if (oldIndex) {
      console.log(`\n🗑   Dropping old index: ${oldIndex.name}`);
      await col.dropIndex(oldIndex.name);
      console.log('✅  Dropped');
    } else {
      console.log('\nℹ️   Không tìm thấy index accountNumber nào để drop (có thể đã được fix rồi)');
    }

    // Tạo index mới với partialFilterExpression
    console.log('\n🔨  Creating new partialFilterExpression index...');
    await col.createIndex(
      { accountNumber: 1 },
      {
        unique: true,
        partialFilterExpression: { accountNumber: { $type: 'string' } },
        name: 'accountNumber_1_partial',
      }
    );
    console.log('✅  New index created');

    // Liệt kê index sau khi fix
    const after = await col.indexes();
    console.log('\n📋  Indexes after:');
    after.forEach(i => console.log('   -', JSON.stringify(i)));

    console.log('\n🎉  Migration complete! Restart server để Mongoose sync.');
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
