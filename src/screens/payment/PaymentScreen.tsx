import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  Share,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Path, G } from 'react-native-svg';
import {
  ChevronLeft,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  MoreHorizontal,
  CheckCircle2,
  Share2,
  Bookmark,
  Wallet,
  Plus,
  BarChart2,
  Settings,
  Building,
  MessageSquare,
  Calendar,
  Hash,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { walletApi } from '../../api/wallet';

const { width } = Dimensions.get('window');

interface Props {
  onBackToHome?: () => void;
  onNavigateToTab?: (tab: 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings') => void;
  hideBottomBar?: boolean;
}

type PaymentStep = 'qr' | 'input' | 'confirm' | 'success';

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

export default function PaymentScreen({ onBackToHome, onNavigateToTab, hideBottomBar }: Props) {
  const { token } = useAuthStore();
  const { createTransaction, summary } = useTransactionStore();

  const [step, setStep] = useState<PaymentStep>('qr');
  const [selectedCategory, setSelectedCategory] = useState<string>('other');
  const [amount, setAmount] = useState<string>('20.000');
  const [note, setNote] = useState<string>('Thanh toán chi phí khác');
  const [noteError, setNoteError] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // OTP Modal State
  const [isOtpModalVisible, setIsOtpModalVisible] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('131106');
  const [countdown, setCountdown] = useState<number>(55);

  // Modal Lưu người nhận thành công
  const [isSavedRecipientModalVisible, setIsSavedRecipientModalVisible] = useState<boolean>(false);

  // Timer cho mã OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOtpModalVisible && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpModalVisible, countdown]);

  const handleNextFromInput = () => {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    setNoteError(false);
    setStep('confirm');
  };

  const handleOpenOtp = () => {
    setCountdown(55);
    setIsOtpModalVisible(true);
  };

  const handleConfirmOtp = async () => {
    setIsProcessing(true);
    try {
      const numericAmount = Number(amount.replace(/[^0-9]/g, ''));
      const defaultWallet = await walletApi.getDefaultWallet(token || undefined);
      const walletId = defaultWallet?._id || defaultWallet?.id || 'w_cash_default';

      await createTransaction(token || undefined, {
        amount: numericAmount > 0 ? numericAmount : 20000,
        type: 'expense',
        walletId,
        note: `Thanh toán: ${note.trim() || 'Thanh toán QR'}`,
        transactionDate: new Date().toISOString(),
      });
    } catch {
      // offline / catch
    } finally {
      setIsProcessing(false);
      setIsOtpModalVisible(false);
      setStep('success');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Đã chuyển thành công ${amount}đ cho Bủh. Mã giao dịch: BSDHIUHDW98Q0 (FinanceFlow)`,
      });
    } catch {
      // ignore
    }
  };

  const formatSeconds = (sec: number) => {
    const s = sec < 10 ? `0${sec}` : sec;
    return `0:${s}s`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ==============================================================
            BƯỚC 1: QUÉT QR THANH TOÁN
        ============================================================== */}
        {step === 'qr' && (
          <View style={styles.stepContainer}>
            <View style={styles.topHeader}>
              <Text style={styles.screenTitle}>Thanh toán</Text>
            </View>

            {/* Thẻ Số dư */}
            <View style={styles.card}>
              <Text style={styles.balanceLabel}>Số dư</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.currencySymbol}>đ</Text>
                <Text style={styles.balanceAmount}>
                  {Math.max(0, 30000 + (summary.netCashFlow || 0)).toLocaleString('vi-VN')}
                </Text>
                <View style={styles.cursorBar} />
              </View>
            </View>

            {/* Thẻ Mã QR */}
            <TouchableOpacity
              style={styles.qrCard}
              activeOpacity={0.9}
              onPress={() => setStep('input')}
            >
              <View style={styles.qrContainer}>
                {/* SVG Render mẫu mã QR với logo Figma ở giữa */}
                <Svg width={220} height={220} viewBox="0 0 100 100">
                  {/* Góc định vị trên trái */}
                  <Rect x="4" y="4" width="28" height="28" rx="5" fill="#0F172A" />
                  <Rect x="8" y="8" width="20" height="20" rx="3" fill="#FFFFFF" />
                  <Rect x="12" y="12" width="12" height="12" rx="2" fill="#0F172A" />

                  {/* Góc định vị trên phải */}
                  <Rect x="68" y="4" width="28" height="28" rx="5" fill="#0F172A" />
                  <Rect x="72" y="8" width="20" height="20" rx="3" fill="#FFFFFF" />
                  <Rect x="76" y="12" width="12" height="12" rx="2" fill="#0F172A" />

                  {/* Góc định vị dưới trái */}
                  <Rect x="4" y="68" width="28" height="28" rx="5" fill="#0F172A" />
                  <Rect x="8" y="72" width="20" height="20" rx="3" fill="#FFFFFF" />
                  <Rect x="12" y="76" width="12" height="12" rx="2" fill="#0F172A" />

                  {/* Các chấm QR code pattern */}
                  <Rect x="36" y="6" width="6" height="6" fill="#0F172A" />
                  <Rect x="46" y="6" width="6" height="6" fill="#0F172A" />
                  <Rect x="56" y="6" width="6" height="6" fill="#0F172A" />
                  <Rect x="36" y="16" width="6" height="14" fill="#0F172A" />
                  <Rect x="46" y="22" width="14" height="6" fill="#0F172A" />
                  <Rect x="6" y="36" width="24" height="6" fill="#0F172A" />
                  <Rect x="6" y="46" width="6" height="14" fill="#0F172A" />
                  <Rect x="18" y="46" width="14" height="6" fill="#0F172A" />
                  <Rect x="18" y="56" width="6" height="6" fill="#0F172A" />
                  <Rect x="70" y="36" width="12" height="6" fill="#0F172A" />
                  <Rect x="86" y="36" width="8" height="6" fill="#0F172A" />
                  <Rect x="70" y="46" width="6" height="14" fill="#0F172A" />
                  <Rect x="80" y="46" width="14" height="6" fill="#0F172A" />
                  <Rect x="80" y="56" width="6" height="18" fill="#0F172A" />
                  <Rect x="90" y="68" width="6" height="26" fill="#0F172A" />
                  <Rect x="36" y="70" width="8" height="8" fill="#0F172A" />
                  <Rect x="48" y="70" width="6" height="18" fill="#0F172A" />
                  <Rect x="58" y="70" width="8" height="6" fill="#0F172A" />
                  <Rect x="58" y="80" width="6" height="14" fill="#0F172A" />
                  <Rect x="36" y="84" width="8" height="10" fill="#0F172A" />
                  <Rect x="70" y="84" width="16" height="10" fill="#0F172A" />

                  {/* Logo tâm QR */}
                  <Rect x="42" y="42" width="16" height="16" rx="4" fill="#FFFFFF" />
                  <G transform="translate(45, 43) scale(0.4)">
                    <Path d="M0,0 C0,4.4 3.6,8 8,8 C12.4,8 16,4.4 16,0 L0,0 Z" fill="#0ACF83" />
                    <Path d="M0,8 C0,12.4 3.6,16 8,16 L8,8 L0,8 Z" fill="#A259FF" />
                    <Path d="M8,8 C12.4,8 16,12.4 16,16 C16,19.6 12.4,24 8,24 L8,8 Z" fill="#F24E1E" />
                    <Path d="M8,0 C12.4,0 16,3.6 16,8 L8,8 L8,0 Z" fill="#FF7262" />
                    <Path d="M0,16 C0,20.4 3.6,24 8,24 L8,16 L0,16 Z" fill="#1ABCFE" />
                  </G>
                </Svg>
              </View>
              <Text style={styles.qrHint}>Chạm vào mã QR để chuyển sang bước nhập số tiền</Text>
            </TouchableOpacity>

            {/* Chọn danh mục áp dụng */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Chọn danh mục áp dụng</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = selectedCategory === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.categoryBtn,
                        isSelected && styles.categoryBtnActive,
                        item.id === 'other' && styles.categoryBtnFull,
                      ]}
                      onPress={() => setSelectedCategory(item.id)}
                      activeOpacity={0.7}
                    >
                      <IconComp
                        size={18}
                        color={isSelected ? '#0284C7' : '#0F172A'}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.categoryLabel,
                          isSelected && styles.categoryLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ==============================================================
            BƯỚC 2: NHẬP SỐ TIỀN & CHỌN NGÂN SÁCH
        ============================================================== */}
        {step === 'input' && (
          <View style={styles.stepContainer}>
            <View style={styles.topHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep('qr')}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.screenTitleWithBack}>Thanh toán</Text>
            </View>

            {/* Thông tin tài khoản người nhận */}
            <View style={styles.card}>
              <Text style={styles.accountHolderText}>Tài Khoản: HOANG NGOC LIEN</Text>
              <Text style={styles.accountNumberText}>12345678899000</Text>
            </View>

            {/* Nhập số tiền */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Nhập số tiền cần thanh toán:</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="20.000"
                />
                <Text style={styles.inputSuffix}>đ</Text>
              </View>
            </View>

            {/* Chọn danh mục áp dụng */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Chọn danh mục áp dụng</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = selectedCategory === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.categoryBtn,
                        isSelected && styles.categoryBtnActive,
                        item.id === 'other' && styles.categoryBtnFull,
                      ]}
                      onPress={() => setSelectedCategory(item.id)}
                      activeOpacity={0.7}
                    >
                      <IconComp
                        size={18}
                        color={isSelected ? '#0284C7' : '#0F172A'}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.categoryLabel,
                          isSelected && styles.categoryLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Ô nhập ghi chú */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ghi chú *</Text>
              <TextInput
                style={[
                  styles.noteInputBox,
                  noteError && styles.noteInputBoxError,
                ]}
                placeholder="Nhập nội dung ghi chú"
                placeholderTextColor="#94A3B8"
                value={note}
                onChangeText={(val) => {
                  setNote(val);
                  if (val.trim()) setNoteError(false);
                }}
              />
              {noteError && (
                <Text style={styles.errorText}>Vui lòng nhập ghi chú để tiếp tục.</Text>
              )}
            </View>

            {/* Nút Tiếp tục */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                !note.trim() && styles.primaryBtnDisabled,
              ]}
              onPress={handleNextFromInput}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Tiếp tục</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ==============================================================
            BƯỚC 3: XÁC NHẬN THÔNG TIN THANH TOÁN
        ============================================================== */}
        {step === 'confirm' && (
          <View style={styles.stepContainer}>
            <View style={styles.topHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep('input')}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.screenTitleWithBack}>Thanh toán</Text>
            </View>

            {/* Thẻ Xác nhận chi tiết */}
            <View style={styles.card}>
              <Text style={styles.confirmCardTitle}>Xác nhận thông tin thanh toán</Text>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Số tiền</Text>
                <Text style={styles.confirmValueBold}>{amount}đ</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Danh mục</Text>
                <Text style={styles.confirmValue}>
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Khác'}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Ghi chú</Text>
                <Text style={styles.confirmValue}>{note}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionSubTitle}>Chi tiết giao dịch</Text>

              <View style={styles.confirmDetailItem}>
                <Text style={styles.detailLabel}>Từ</Text>
                <Text style={styles.detailValue}>012345678990</Text>
              </View>

              <View style={styles.confirmDetailItem}>
                <Text style={styles.detailLabel}>Đến</Text>
                <Text style={styles.detailValueBold}>Bủh</Text>
                <Text style={styles.detailValue}>012345678</Text>
              </View>
            </View>

            {/* Bước tiếp theo: Nút Xác nhận bằng OTP */}
            <View style={styles.card}>
              <Text style={styles.nextStepText}>Bước tiếp theo</Text>
              <TouchableOpacity
                style={styles.otpActionBtn}
                onPress={handleOpenOtp}
                activeOpacity={0.8}
              >
                <Text style={styles.otpActionBtnText}>Xác nhận bằng mã OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==============================================================
            BƯỚC 5: THANH TOÁN THÀNH CÔNG
        ============================================================== */}
        {step === 'success' && (
          <View style={styles.stepContainer}>
            {/* Header Badge Ví */}
            <View style={styles.walletBadgeRow}>
              <View style={styles.walletBadge}>
                <Wallet size={16} color="#0F172A" />
                <Text style={styles.walletBadgeText}>VÍ NHÓM 3 CÁI L</Text>
              </View>
            </View>

            {/* Checkmark Thành công */}
            <View style={styles.successIconWrapper}>
              <View style={styles.successCheckCircle}>
                <CheckCircle2 size={40} color="#0284C7" strokeWidth={2} />
              </View>
            </View>

            <Text style={styles.successTitle}>Chuyển thành công</Text>
            <Text style={styles.successSubtitle}>Giao dịch đã được ghi nhận thành công</Text>

            {/* Số tiền lớn */}
            <View style={styles.successAmountWrapper}>
              <Text style={styles.successAmountLabel}>Số tiền</Text>
              <Text style={styles.successAmountValue}>VND {amount}</Text>
            </View>

            {/* Thẻ Chi tiết giao dịch hoàn tất */}
            <View style={styles.successDetailCard}>
              <View style={styles.successDetailRow}>
                <View style={styles.successIconBox}>
                  <Building size={18} color="#64748B" />
                </View>
                <View style={styles.successDetailContent}>
                  <Text style={styles.detailItemLabel}>Tài khoản nhận</Text>
                  <Text style={styles.detailItemValue}>Ngân hàng MBBank - HOANG NGOC LIEN</Text>
                </View>
              </View>

              <View style={styles.successDetailRow}>
                <View style={styles.successIconBox}>
                  <MessageSquare size={18} color="#64748B" />
                </View>
                <View style={styles.successDetailContent}>
                  <Text style={styles.detailItemLabel}>Lời nhắn</Text>
                  <Text style={styles.detailItemValue}>{note || 'Ăn mau chóng lớn'}</Text>
                </View>
              </View>

              <View style={styles.successDetailRow}>
                <View style={styles.successIconBox}>
                  <Calendar size={18} color="#64748B" />
                </View>
                <View style={styles.successDetailContent}>
                  <Text style={styles.detailItemLabel}>Ngày thực hiện</Text>
                  <Text style={styles.detailItemValue}>22 thg 10, 2026 lúc 16:30 chiều</Text>
                </View>
              </View>

              <View style={styles.successDetailRow}>
                <View style={styles.successIconBox}>
                  <Hash size={18} color="#64748B" />
                </View>
                <View style={styles.successDetailContent}>
                  <Text style={styles.detailItemLabel}>Mã giao dịch</Text>
                  <Text style={styles.detailItemValueCode}>BSDHIUHDW98Q0</Text>
                </View>
              </View>
            </View>

            {/* 2 Nút phụ: Chia sẻ & Lưu người nhận */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionSecondaryBtn}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={16} color="#0F172A" />
                <Text style={styles.actionSecondaryBtnText}>Chia sẻ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSecondaryBtn}
                onPress={() => setIsSavedRecipientModalVisible(true)}
                activeOpacity={0.7}
              >
                <Bookmark size={16} color="#0F172A" />
                <Text style={styles.actionSecondaryBtnText}>Lưu người nhận</Text>
              </TouchableOpacity>
            </View>

            {/* Nút Quay lại màn hình chính */}
            <TouchableOpacity
              style={styles.backToHomeBtn}
              onPress={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  setStep('qr');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.backToHomeBtnText}>QUAY LẠI MÀN HÌNH CHÍNH</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ==============================================================
          BƯỚC 4: MODAL NHẬP MÃ OTP
      ============================================================== */}
      <Modal
        visible={isOtpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.otpModalBox}>
            <Text style={styles.otpModalTitle}>NHẬP MÃ OTP ĐỂ THANH TOÁN</Text>

            <View style={styles.otpInputBox}>
              <TextInput
                style={styles.otpTextInput}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>

            <Text style={styles.otpCountdownText}>
              Mã OTP còn thời hạn {formatSeconds(countdown)}
            </Text>

            <TouchableOpacity
              style={[styles.otpConfirmBtn, isProcessing && { opacity: 0.7 }]}
              onPress={handleConfirmOtp}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.otpConfirmBtnText}>Xác nhận</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==============================================================
          MODAL: THÔNG BÁO LƯU NGƯỜI NHẬN THÀNH CÔNG
      ============================================================== */}
      <Modal
        visible={isSavedRecipientModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSavedRecipientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.savedRecipientModalCard}>
            <View style={styles.savedCheckCircle}>
              <CheckCircle2 size={44} color="#0284C7" />
            </View>

            <Text style={styles.savedModalTitle}>Đã lưu người thụ hưởng</Text>
            <Text style={styles.savedModalSubtitle}>
              Thông tin người nhận đã được lưu vào danh bạ an toàn của bạn.
            </Text>

            <View style={styles.savedContactBox}>
              <Text style={styles.savedContactName}>Bủh (HOANG NGOC LIEN)</Text>
              <Text style={styles.savedContactBank}>Ngân hàng MBBank • 012345678</Text>
            </View>

            <TouchableOpacity
              style={styles.savedGotoCashBtn}
              onPress={() => {
                setIsSavedRecipientModalVisible(false);
                if (onNavigateToTab) onNavigateToTab('cash');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.savedGotoCashBtnText}>Mở Sổ quỹ Tiền mặt / Lưu ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.savedCloseBtn}
              onPress={() => setIsSavedRecipientModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.savedCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==============================================================
          BOTTOM NAVIGATION BAR (Đồng bộ chuẩn Figma)
      ============================================================== */}
      {!hideBottomBar && step !== 'success' && (
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNavBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                if (onBackToHome) onBackToHome();
                else if (onNavigateToTab) onNavigateToTab('finance');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <Wallet size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Tài chính</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab ? onNavigateToTab('cash') : setStep('qr')}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <Plus size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Thêm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab && onNavigateToTab('save')}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <Bookmark size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Lưu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab && onNavigateToTab('chart')}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <BarChart2 size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Biểu đồ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab && onNavigateToTab('settings')}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <Settings size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Cài đặt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#BAE6FD',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 4 : 0,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  stepContainer: {
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    height: 44,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  screenTitleWithBack: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginRight: 6,
  },
  balanceAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  cursorBar: {
    width: 2.5,
    height: 28,
    backgroundColor: '#0284C7',
    marginLeft: 8,
    borderRadius: 2,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  qrContainer: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  qrHint: {
    marginTop: 14,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  categoryBtn: {
    width: '48.5%', // 2 cột cân đối, không phụ thuộc Dimensions và không tràn màn hình
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  categoryBtnFull: {
    width: '100%',
  },
  categoryBtnActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  categoryLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  accountHolderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  accountNumberText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputSuffix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  noteInputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 48,
  },
  noteInputBoxError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: '#BAE6FD',
    borderRadius: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  confirmValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  confirmValueBold: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  sectionSubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  confirmDetailItem: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 1,
  },
  detailValueBold: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '800',
    marginTop: 2,
  },
  nextStepText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 10,
  },
  otpActionBtn: {
    backgroundColor: '#7DD3FC',
    borderRadius: 20,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  otpModalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  otpModalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  otpInputBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpTextInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#0F172A',
  },
  otpCountdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 18,
  },
  otpConfirmBtn: {
    width: '100%',
    backgroundColor: '#BAE6FD',
    borderRadius: 20,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpConfirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  walletBadgeRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  walletBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  successIconWrapper: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  successCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  successAmountWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successAmountLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  successAmountValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  successDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  successDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  successIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  successDetailContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  detailItemValueCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  backToHomeBtn: {
    backgroundColor: '#CBD5E1',
    borderRadius: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToHomeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: 'transparent',
  },
  bottomNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    height: 64,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconCircleActive: {
    backgroundColor: '#BAE6FD',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  savedRecipientModalCard: {
    width: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  savedCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  savedModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  savedModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  savedContactBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    alignItems: 'center',
  },
  savedContactName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  savedContactBank: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  savedGotoCashBtn: {
    width: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  savedGotoCashBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  savedCloseBtn: {
    paddingVertical: 8,
  },
  savedCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});
