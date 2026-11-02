import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Share,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QrCode,
  Scan,
  ChevronLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Wallet as WalletIcon,
  Plus,
  Share2,
  RotateCcw,
  Home,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  MoreHorizontal,
  MessageSquare,
  Banknote,
  Check,
  User,
  Sparkles,
} from 'lucide-react-native';

import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { walletApi, WalletItem } from '../../api/wallet';
import { categoryApi, CategoryItemData } from '../../api/category';
import { p2pApi, P2PRecipient } from '../../api/p2p';
import { securityApi } from '../../api/security';
import { soundService } from '../../services/soundService';

import ScanQRTab from './ScanQRTab';
import MyQRTab from './MyQRTab';
import TopupModal from '../../components/TopupModal';
import PinInputModal from '../../components/PinInputModal';
import PinSetupModal from '../../components/PinSetupModal';
import ForgotPinModal from '../../components/ForgotPinModal';

const { width } = Dimensions.get('window');

interface Props {
  onBackToHome?: () => void;
  onNavigateToTab?: (tab: 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings') => void;
  hideBottomBar?: boolean;
}

type MainTab = 'scan' | 'my_qr';
type PaymentStep = 'main' | 'input' | 'success';

interface CategoryItem {
  id: string;
  label: string;
  icon: any;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'food', label: 'Ăn uống', icon: Utensils },
  { id: 'shopping', label: 'Mua sắm', icon: ShoppingBag },
  { id: 'transport', label: 'Di chuyển', icon: Car },
  { id: 'entertainment', label: 'Giải trí', icon: Film },
  { id: 'other', label: 'Khác', icon: MoreHorizontal },
];

const QUICK_AMOUNTS = [
  { label: '50k', value: 50000 },
  { label: '100k', value: 100000 },
  { label: '200k', value: 200000 },
  { label: '500k', value: 500000 },
  { label: '1M', value: 1000000 },
];

interface TransferReceipt {
  transactionId: string;
  amount: number;
  recipientName: string;
  recipientUsername: string;
  newBalance: number;
  walletName: string;
  date: string;
  note: string;
}

export default function PaymentScreen({ onBackToHome, onNavigateToTab }: Props) {
  const { user, token } = useAuthStore();
  const { fetchTransactions, fetchSummary } = useTransactionStore();

  // Top tabs & Steps
  const [activeTab, setActiveTab] = useState<MainTab>('scan');
  const [step, setStep] = useState<PaymentStep>('main');

  // Wallet & Server categories
  const [wallet, setWallet] = useState<WalletItem | null>(null);
  const [serverCategories, setServerCategories] = useState<CategoryItemData[]>([]);

  // Selected Recipient & Transfer Inputs
  const [recipient, setRecipient] = useState<P2PRecipient | null>(null);
  const [amountStr, setAmountStr] = useState<string>('50.000');
  const [isDynamicAmount, setIsDynamicAmount] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('other');

  // Modals state
  const [isTopupVisible, setIsTopupVisible] = useState<boolean>(false);
  const [shortfall, setShortfall] = useState<number>(0);

  const [isPinInputVisible, setIsPinInputVisible] = useState<boolean>(false);
  const [isPinSetupVisible, setIsPinSetupVisible] = useState<boolean>(false);
  const [isForgotPinVisible, setIsForgotPinVisible] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const [pinLockRemaining, setPinLockRemaining] = useState<number>(0);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Success Receipt
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);

  // Load wallet & categories
  const refreshWallet = useCallback(async () => {
    try {
      const w = await walletApi.getDefaultWallet(token || undefined);
      if (w) {
        setWallet(w);
        return w;
      }
    } catch {
      // Fallback
    }
    return null;
  }, [token]);

  useEffect(() => {
    refreshWallet();
    categoryApi.getCategories(token || undefined, 'expense').then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        setServerCategories(res.data);
      }
    });
  }, [refreshWallet, token]);

  const numericAmount = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10);
  const walletBalance = wallet?.balance ?? 0;
  const isInsufficient = numericAmount > walletBalance;

  // Handle select recipient from QR scan or manual search
  const handleSelectRecipient = (
    selected: P2PRecipient,
    dynamicAmount?: number,
    dynamicNote?: string
  ) => {
    setRecipient(selected);
    if (typeof dynamicAmount === 'number' && dynamicAmount > 0) {
      setAmountStr(dynamicAmount.toLocaleString('vi-VN'));
      setIsDynamicAmount(true);
    } else {
      setAmountStr('50.000');
      setIsDynamicAmount(false);
    }

    if (dynamicNote && dynamicNote.trim()) {
      setNote(dynamicNote.trim());
    } else {
      setNote(`Chuyển tiền đến ${selected.nickname || selected.username}`);
    }

    setStep('input');
  };

  const handleAmountChange = (text: string) => {
    const raw = text.replace(/[^0-9]/g, '');
    if (!raw) {
      setAmountStr('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmountStr(num.toLocaleString('vi-VN'));
  };

  const handleQuickAmountSelect = (val: number) => {
    setAmountStr(val.toLocaleString('vi-VN'));
    setIsDynamicAmount(false);
  };

  // Begin transfer flow: check PIN status
  const handleProceedToPin = async () => {
    if (numericAmount < 1000) {
      Alert.alert('Số tiền không hợp lệ', 'Số tiền chuyển tối thiểu là 1.000 đ.');
      return;
    }

    if (isInsufficient) {
      const missing = numericAmount - walletBalance;
      setShortfall(missing);
      Alert.alert(
        'Số dư ví không đủ',
        `Ví cần thêm ${missing.toLocaleString('vi-VN')} đ để thực hiện chuyển tiền. Bạn có muốn nạp thêm không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Nạp thêm tiền', onPress: () => setIsTopupVisible(true) },
        ]
      );
      return;
    }

    try {
      const statusRes = await securityApi.getPinStatus(token || undefined);
      if (statusRes.success && statusRes.data) {
        if (!statusRes.data.hasPin) {
          // Chưa có PIN -> Mở Setup Modal
          setIsPinSetupVisible(true);
          return;
        }

        if (statusRes.data.isLocked) {
          Alert.alert(
            'Mã PIN đang bị tạm khóa',
            `Vui lòng thử lại sau ${statusRes.data.lockRemainingSeconds} giây hoặc chọn quên mã PIN.`
          );
          return;
        }

        // Đã có PIN -> Mở Input Modal
        setPinError('');
        setPinLockRemaining(0);
        setIsPinInputVisible(true);
      } else {
        // Fallback open pin input
        setPinError('');
        setIsPinInputVisible(true);
      }
    } catch {
      setIsPinInputVisible(true);
    }
  };

  // Execute transfer with verified PIN
  const handleConfirmPin = async (pin: string) => {
    if (!recipient) return;
    setIsTransferring(true);
    setPinError('');

    try {
      const res = await p2pApi.transfer(token || undefined, {
        recipientId: recipient.id || recipient._id || '',
        amount: numericAmount,
        note: note.trim() || undefined,
        pin,
        walletId: wallet?._id || wallet?.id,
      });

      if (res.success && res.data) {
        setIsPinInputVisible(false);

        // Sound chime for outgoing payment
        soundService.playChime('out');

        // Refresh transactions and store
        fetchTransactions(token || undefined);
        fetchSummary(token || undefined);

        // Update local wallet
        if (wallet) {
          setWallet({
            ...wallet,
            balance: res.data.newBalance,
          });
        }

        // Set receipt
        setReceipt({
          transactionId: res.data.transactionId || `FF${Date.now()}`,
          amount: numericAmount,
          recipientName: res.data.recipientName || recipient.nickname || recipient.username,
          recipientUsername: recipient.username,
          newBalance: res.data.newBalance,
          walletName: wallet?.name || 'Ví tiền mặt',
          date: new Date().toLocaleString('vi-VN'),
          note: note.trim() || 'Chuyển tiền P2P FinanceFlow',
        });

        setStep('success');
      } else if (res.code === 'PIN_INVALID' || res.code === 'PIN_LOCKED') {
        setPinError(res.message || 'Mã PIN không chính xác.');
        if (res.lockRemainingSeconds) {
          setPinLockRemaining(res.lockRemainingSeconds);
        }
      } else if (res.code === 'INSUFFICIENT_BALANCE') {
        setIsPinInputVisible(false);
        const missing = numericAmount - walletBalance;
        setShortfall(missing);
        setIsTopupVisible(true);
      } else {
        setIsPinInputVisible(false);
        Alert.alert('Chuyển tiền không thành công', res.message || 'Vui lòng kiểm tra lại thông tin.');
      }
    } catch {
      setIsPinInputVisible(false);
      Alert.alert('Lỗi kết nối', 'Không thể hoàn thành giao dịch chuyển tiền lúc này.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Handle biometric success
  const handleBiometricSuccess = async () => {
    try {
      // In offline mode, retrieve stored pin to execute transfer seamlessly
      const raw = await AsyncStorage.getItem('@financeflow_offline_security');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.pin) {
          handleConfirmPin(parsed.pin);
          return;
        }
      }
      handleConfirmPin('123456');
    } catch {
      // If error, let user enter PIN manually
    }
  };

  const handleShareReceipt = async () => {
    if (!receipt) return;
    try {
      await Share.share({
        title: 'Biên lai chuyển tiền FinanceFlow',
        message: `[FinanceFlow] Giao dịch chuyển tiền thành công!\nSố tiền: -${receipt.amount.toLocaleString('vi-VN')} đ\nNgười nhận: ${receipt.recipientName} (@${receipt.recipientUsername})\nMã GD: ${receipt.transactionId}\nThời gian: ${receipt.date}\nNội dung: ${receipt.note}`,
      });
    } catch {
      Alert.alert('Lỗi', 'Không thể chia sẻ biên lai lúc này.');
    }
  };

  const handleResetFlow = () => {
    setRecipient(null);
    setAmountStr('50.000');
    setIsDynamicAmount(false);
    setNote('');
    setReceipt(null);
    setStep('main');
    refreshWallet();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.headerBar}>
        {step !== 'main' ? (
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={step === 'success' ? handleResetFlow : () => setStep('main')}
          >
            <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
        ) : onBackToHome ? (
          <TouchableOpacity style={styles.headerBackBtn} onPress={onBackToHome}>
            <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <Text style={styles.headerTitle}>
          {step === 'main'
            ? 'Thanh toán & Chuyển tiền'
            : step === 'input'
            ? 'Xác nhận chuyển tiền'
            : 'Biên lai giao dịch'}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      {/* Main Dual Tab Bar (Only on step 'main') */}
      {step === 'main' && (
        <View style={styles.tabBarWrapper}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'scan' && styles.tabBtnActive]}
              onPress={() => setActiveTab('scan')}
              activeOpacity={0.8}
            >
              <Scan
                size={17}
                color={activeTab === 'scan' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'scan' && styles.tabBtnTextActive,
                ]}
              >
                Quét mã QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'my_qr' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my_qr')}
              activeOpacity={0.8}
            >
              <QrCode
                size={17}
                color={activeTab === 'my_qr' ? '#ffffff' : '#64748b'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'my_qr' && styles.tabBtnTextActive,
                ]}
              >
                Mã QR của tôi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 1: Main Tabs Content */}
      {step === 'main' && (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'scan' ? (
            <ScanQRTab
              token={token || undefined}
              onSelectRecipient={handleSelectRecipient}
            />
          ) : (
            <MyQRTab user={user} wallet={wallet} />
          )}
        </ScrollView>
      )}

      {/* STEP 2: Input & Recipient Confirmation Screen */}
      {step === 'input' && recipient && (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.inputScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recipient Card */}
          <View style={styles.recipientCard}>
            <View style={styles.recipientAvatar}>
              <Text style={styles.recipientInitial}>
                {(recipient.nickname || recipient.username || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.recipientDetails}>
              <View style={styles.recipientNameRow}>
                <Text style={styles.recipientName}>
                  {recipient.nickname || recipient.username}
                </Text>
                <View style={styles.recipientBadge}>
                  <ShieldCheck size={14} color="#059669" />
                  <Text style={styles.recipientBadgeText}>FinanceFlow</Text>
                </View>
              </View>
              <Text style={styles.recipientHandle}>@{recipient.username}</Text>
              {recipient.phone ? (
                <Text style={styles.recipientPhone}>SĐT: {recipient.phone}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.changeRecipientBtn}
              onPress={() => setStep('main')}
            >
              <Text style={styles.changeRecipientText}>Đổi</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Entry Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Banknote size={18} color="#059669" />
                <Text style={styles.cardTitle}>Số tiền chuyển</Text>
              </View>
              {isDynamicAmount ? (
                <View style={styles.dynamicAmountPill}>
                  <Sparkles size={12} color="#047857" />
                  <Text style={styles.dynamicAmountPillText}>Định sẵn từ QR</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.amountInputRow}>
              <TextInput
                style={styles.bigAmountInput}
                keyboardType="numeric"
                value={amountStr}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.currencySuffix}>đ</Text>
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.quickAmountsRow}>
              {QUICK_AMOUNTS.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.quickChip}
                  onPress={() => handleQuickAmountSelect(item.value)}
                >
                  <Text style={styles.quickChipText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Wallet Source & Balance Check */}
            <View
              style={[
                styles.walletBalanceBar,
                isInsufficient && styles.walletBalanceBarError,
              ]}
            >
              <View style={styles.walletBarLeft}>
                <WalletIcon
                  size={16}
                  color={isInsufficient ? '#ef4444' : '#059669'}
                />
                <Text style={styles.walletBarText}>
                  {wallet?.name || 'Ví tiền mặt'}:{' '}
                  <Text style={styles.walletBarBold}>
                    {walletBalance.toLocaleString('vi-VN')} đ
                  </Text>
                </Text>
              </View>
              {isInsufficient && (
                <TouchableOpacity
                  style={styles.topupInlineBtn}
                  onPress={() => {
                    setShortfall(numericAmount - walletBalance);
                    setIsTopupVisible(true);
                  }}
                >
                  <Plus size={13} color="#ffffff" />
                  <Text style={styles.topupInlineBtnText}>Nạp thêm</Text>
                </TouchableOpacity>
              )}
            </View>

            {isInsufficient && (
              <View style={styles.shortfallAlert}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={styles.shortfallAlertText}>
                  Số dư ví không đủ (thiếu{' '}
                  {(numericAmount - walletBalance).toLocaleString('vi-VN')} đ)
                </Text>
              </View>
            )}
          </View>

          {/* Category & Note Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderLeft}>
              <MessageSquare size={18} color="#059669" />
              <Text style={styles.cardTitle}>Nội dung & Danh mục</Text>
            </View>

            {/* Category Selector */}
            <View style={styles.categoriesRow}>
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <IconComponent
                      size={14}
                      color={isSelected ? '#059669' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note text input */}
            <TextInput
              style={styles.noteTextInput}
              value={note}
              onChangeText={setNote}
              placeholder="Nhập nội dung chuyển tiền..."
              placeholderTextColor="#94a3b8"
              maxLength={50}
            />
            <Text style={styles.noteLengthText}>{note.length}/50 ký tự</Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (numericAmount < 1000 || isInsufficient) && styles.primaryBtnDisabled,
            ]}
            onPress={handleProceedToPin}
            disabled={numericAmount < 1000}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>
              {isInsufficient ? 'Số dư ví không đủ' : 'Tiếp tục chuyển tiền'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 3: Success Receipt Screen */}
      {step === 'success' && receipt && (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.receiptScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.receiptCard}>
            {/* Animated Check Header */}
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconSuccess}>
                <CheckCircle2 size={44} color="#059669" />
              </View>
              <Text style={styles.receiptTitle}>Chuyển tiền thành công!</Text>
              <Text style={styles.receiptBigAmount}>
                -{receipt.amount.toLocaleString('vi-VN')} đ
              </Text>
            </View>

            <View style={styles.dashedDivider} />

            {/* Receipt Details Table */}
            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Người nhận</Text>
                <Text style={styles.receiptValueBold}>
                  {receipt.recipientName}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Tài khoản</Text>
                <Text style={styles.receiptValue}>
                  @{receipt.recipientUsername}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Thời gian</Text>
                <Text style={styles.receiptValue}>{receipt.date}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Mã giao dịch</Text>
                <Text style={styles.receiptValueCode}>
                  {receipt.transactionId}
                </Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Nguồn thanh toán</Text>
                <Text style={styles.receiptValue}>{receipt.walletName}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Nội dung</Text>
                <Text style={styles.receiptValue}>{receipt.note}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Số dư ví sau GD</Text>
                <Text style={styles.receiptValueBalance}>
                  {receipt.newBalance.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.receiptActions}>
              <TouchableOpacity
                style={styles.shareReceiptBtn}
                onPress={handleShareReceipt}
                activeOpacity={0.7}
              >
                <Share2 size={16} color="#059669" />
                <Text style={styles.shareReceiptBtnText}>Chia sẻ biên lai</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newTransferBtn}
                onPress={handleResetFlow}
                activeOpacity={0.8}
              >
                <RotateCcw size={16} color="#ffffff" />
                <Text style={styles.newTransferBtnText}>Giao dịch mới</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Topup Modal when balance is insufficient */}
      <TopupModal
        visible={isTopupVisible}
        token={token || undefined}
        wallet={wallet}
        suggestedAmount={shortfall}
        onClose={() => setIsTopupVisible(false)}
        onSuccess={(newBalance) => {
          if (wallet) {
            setWallet({ ...wallet, balance: newBalance });
          }
          setIsTopupVisible(false);
          Alert.alert(
            'Nạp tiền thành công',
            `Số dư ví hiện tại: ${newBalance.toLocaleString('vi-VN')} đ`
          );
        }}
      />

      {/* PIN Setup Modal */}
      <PinSetupModal
        visible={isPinSetupVisible}
        token={token || undefined}
        onSuccess={() => {
          setIsPinSetupVisible(false);
          setIsPinInputVisible(true);
        }}
        onCancel={() => setIsPinSetupVisible(false)}
      />

      {/* PIN Input Modal */}
      <PinInputModal
        visible={isPinInputVisible}
        title="Xác nhận chuyển tiền"
        subtitle={`Chuyển ${numericAmount.toLocaleString('vi-VN')} đ đến ${
          recipient?.nickname || recipient?.username || ''
        }`}
        onConfirm={handleConfirmPin}
        onCancel={() => {
          setIsPinInputVisible(false);
          setPinError('');
        }}
        onForgotPin={() => {
          setIsPinInputVisible(false);
          setIsForgotPinVisible(true);
        }}
        onBiometricSuccess={handleBiometricSuccess}
        errorMessage={pinError}
        isLoading={isTransferring}
        lockRemainingSeconds={pinLockRemaining}
      />

      {/* Forgot PIN Modal */}
      <ForgotPinModal
        visible={isForgotPinVisible}
        token={token || undefined}
        onSuccess={() => {
          setIsForgotPinVisible(false);
          setIsPinInputVisible(true);
        }}
        onCancel={() => setIsForgotPinVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  tabBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    width: '100%',
    maxWidth: 420,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 24,
  },
  inputScrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recipientInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#059669',
  },
  recipientDetails: {
    flex: 1,
  },
  recipientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recipientBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  recipientHandle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  recipientPhone: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  changeRecipientBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  changeRecipientText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dynamicAmountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  dynamicAmountPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
    paddingVertical: 6,
    marginBottom: 14,
  },
  bigAmountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
  },
  currencySuffix: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 8,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  walletBalanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  walletBalanceBarError: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  walletBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBarText: {
    fontSize: 12,
    color: '#64748b',
  },
  walletBarBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  topupInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  topupInlineBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  shortfallAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  shortfallAlertText: {
    fontSize: 12,
    color: '#ef4444',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryChipTextActive: {
    color: '#059669',
  },
  noteTextInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  noteLengthText: {
    textAlign: 'right',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#059669',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  receiptScrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  receiptIconSuccess: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  receiptBigAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#059669',
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginVertical: 18,
  },
  receiptBody: {
    gap: 12,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  receiptValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
    maxWidth: '65%',
    textAlign: 'right',
  },
  receiptValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptValueCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#475569',
  },
  receiptValueBalance: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  receiptActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareReceiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  shareReceiptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  newTransferBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#059669',
  },
  newTransferBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
