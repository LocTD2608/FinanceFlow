import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Share2,
  Download,
  PlusCircle,
  X,
  Wallet as WalletIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { generateQRPayload, QRPayloadUser } from '../../utils/qrPayload';
import { WalletItem } from '../../api/wallet';
import { User } from '../../api/auth';
import DynamicQRModal from './DynamicQRModal';

export interface MyQRTabProps {
  user: User | null;
  wallet: WalletItem | null;
}

export default function MyQRTab({ user, wallet }: MyQRTabProps) {
  const [dynamicAmount, setDynamicAmount] = useState<number | undefined>(undefined);
  const [dynamicNote, setDynamicNote] = useState<string | undefined>(undefined);
  const [isDynamicModalVisible, setIsDynamicModalVisible] = useState<boolean>(false);

  const displayName = user?.username ? user.username : 'Người dùng FinanceFlow';
  const displayInitial = (user?.username || 'F').charAt(0).toUpperCase();

  const qrPayloadString = useMemo(() => {
    const payloadUser: QRPayloadUser = {
      id: user?.id || 'demo_user',
      _id: user?.id || 'demo_user',
      recipientId: user?.id || 'demo_user',
      username: user?.username || 'financeflow_user',
      phone: user?.phone,
    };
    return generateQRPayload(payloadUser, dynamicAmount, dynamicNote);
  }, [user, dynamicAmount, dynamicNote]);

  const handleShare = async () => {
    try {
      const amountText = dynamicAmount
        ? `Số tiền yêu cầu: ${dynamicAmount.toLocaleString('vi-VN')} đ\n`
        : '';
      const noteText = dynamicNote ? `Nội dung: ${dynamicNote}\n` : '';

      await Share.share({
        title: 'Mã QR nhận tiền FinanceFlow',
        message: `Mã nhận tiền FinanceFlow của ${displayName} (@${user?.username || ''}):\n${amountText}${noteText}${qrPayloadString}`,
      });
    } catch {
      Alert.alert('Lỗi', 'Không thể chia sẻ mã QR lúc này.');
    }
  };

  const handleSaveImage = () => {
    Alert.alert('Thành công', 'Đã lưu mã QR cá nhân vào thư viện ảnh của thiết bị.');
  };

  const handleClearDynamic = () => {
    setDynamicAmount(undefined);
    setDynamicNote(undefined);
  };

  const handleApplyDynamic = (data: { amount: number; note: string }) => {
    setDynamicAmount(data.amount);
    setDynamicNote(data.note || undefined);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Recipient Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{displayInitial}</Text>
            </View>
          )}

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{displayName}</Text>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color="#059669" />
              </View>
            </View>
            <Text style={styles.username}>@{user?.username || 'tai_khoan'}</Text>
          </View>
        </View>

        {/* Balance Preview */}
        <View style={styles.balancePreview}>
          <View style={styles.balanceIconWrapper}>
            <WalletIcon size={16} color="#059669" />
          </View>
          <View style={styles.balanceTexts}>
            <Text style={styles.balanceLabel}>Số dư ví khả dụng</Text>
            <Text style={styles.balanceValue}>
              {(wallet?.balance || 0).toLocaleString('vi-VN')} đ
            </Text>
          </View>
        </View>

        {/* QR Code Container */}
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={qrPayloadString}
              size={220}
              color="#0f172a"
              backgroundColor="#ffffff"
              quietZone={12}
            />
          </View>

          {/* Dynamic Amount Badge */}
          {dynamicAmount && dynamicAmount > 0 ? (
            <View style={styles.dynamicBadge}>
              <View style={styles.dynamicBadgeLeft}>
                <Sparkles size={16} color="#059669" />
                <View>
                  <Text style={styles.dynamicAmountTitle}>Số tiền yêu cầu</Text>
                  <Text style={styles.dynamicAmountVal}>
                    {dynamicAmount.toLocaleString('vi-VN')} đ
                  </Text>
                  {dynamicNote ? (
                    <Text style={styles.dynamicNoteText}>"{dynamicNote}"</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClearDynamic}
                style={styles.clearDynamicBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.qrSubtext}>
              Quét mã bằng camera hoặc ứng dụng FinanceFlow để chuyển tiền tức thì
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => setIsDynamicModalVisible(true)}
            activeOpacity={0.7}
          >
            <PlusCircle size={18} color="#059669" />
            <Text style={styles.actionBtnOutlineText}>
              {dynamicAmount ? 'Sửa số tiền' : 'Tạo mã QR có số tiền'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSaveImage}
            activeOpacity={0.7}
          >
            <Download size={16} color="#334155" />
            <Text style={styles.secondaryBtnText}>Lưu ảnh QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Share2 size={16} color="#334155" />
            <Text style={styles.secondaryBtnText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal tạo mã QR động */}
      <DynamicQRModal
        visible={isDynamicModalVisible}
        initialAmount={dynamicAmount}
        initialNote={dynamicNote}
        onClose={() => setIsDynamicModalVisible(false)}
        onSubmit={handleApplyDynamic}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#059669',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#059669',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  verifiedBadge: {
    padding: 2,
  },
  username: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  balancePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  balanceIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceTexts: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrSubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  dynamicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 14,
    width: '100%',
  },
  dynamicBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dynamicAmountTitle: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dynamicAmountVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065f46',
  },
  dynamicNoteText: {
    fontSize: 12,
    color: '#047857',
    fontStyle: 'italic',
    marginTop: 2,
  },
  clearDynamicBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
  },
  actionRow: {
    marginTop: 20,
    width: '100%',
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  actionBtnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
});
