require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const BillReminder = require('../models/BillReminder');
const NetWorthSnapshot = require('../models/NetWorthSnapshot');
const Category = require('../models/Category');
const P2PTransfer = require('../models/P2PTransfer');
const Goal = require('../models/Goal');
const GoalContribution = require('../models/GoalContribution');
const ChatConversation = require('../models/ChatConversation');
const ChatAction = require('../models/ChatAction');
const ChatQuota = require('../models/ChatQuota');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financeflow_dev';

async function syncIndexes() {
  console.log('🔄 Đang kết nối tới MongoDB để đồng bộ Indexes...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB.');

  const models = [
    { name: 'User', model: User },
    { name: 'Wallet', model: Wallet },
    { name: 'Transaction', model: Transaction },
    { name: 'Budget', model: Budget },
    { name: 'BillReminder', model: BillReminder },
    { name: 'NetWorthSnapshot', model: NetWorthSnapshot },
    { name: 'Category', model: Category },
    { name: 'P2PTransfer', model: P2PTransfer },
    { name: 'Goal', model: Goal },
    { name: 'GoalContribution', model: GoalContribution },
    { name: 'ChatConversation', model: ChatConversation },
    { name: 'ChatAction', model: ChatAction },
    { name: 'ChatQuota', model: ChatQuota },
  ];

  for (const { name, model } of models) {
    try {
      await model.syncIndexes();
      console.log(`  ✓ Đồng bộ indexes thành công cho [${name}]`);
    } catch (err) {
      console.error(`  ✗ Lỗi đồng bộ indexes cho [${name}]:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('🎉 Hoàn tất đồng bộ toàn bộ indexes!');
  process.exit(0);
}

syncIndexes().catch((err) => {
  console.error('❌ Thất bại:', err.message);
  process.exit(1);
});
