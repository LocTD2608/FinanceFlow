/**
 * Gửi Expo Push Notification. Cần thiết bị thật / dev build (Expo Go SDK 53+ không hỗ trợ push từ xa trên Android).
 */
const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

let expo = null;
const getExpo = () => {
  if (!expo) expo = new Expo(process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {});
  return expo;
};

/**
 * Gửi thông báo tới tất cả thiết bị của user. Tự xóa token không còn hợp lệ.
 * @returns {Promise<number>} số thông báo đã gửi thành công (được Expo nhận)
 */
const sendToUser = async (userId, { title, body, data = {} }) => {
  const user = await User.findById(userId);
  if (!user || !user.pushTokens || !user.pushTokens.length) return 0;

  const client = getExpo();
  const tokens = user.pushTokens.map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  if (!tokens.length) return 0;

  const messages = tokens.map((to) => ({ to, sound: 'default', title, body, data }));
  const invalid = [];
  let ok = 0;

  for (const chunk of client.chunkPushNotifications(messages)) {
    try {
      const tickets = await client.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') ok += 1;
        else if (ticket.details && ticket.details.error === 'DeviceNotRegistered') invalid.push(chunk[i].to);
      });
    } catch (e) {
      console.error('[push] gửi lỗi:', e.message);
    }
  }

  if (invalid.length) {
    await User.updateOne({ _id: userId }, { $pull: { pushTokens: { token: { $in: invalid } } } });
  }
  return ok;
};

module.exports = { sendToUser };
