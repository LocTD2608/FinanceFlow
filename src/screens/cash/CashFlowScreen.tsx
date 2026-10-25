import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  Animated,
  LayoutChangeEvent,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Calendar,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  MoreHorizontal,
  Check,
  CheckCircle2,
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { walletApi } from '../../api/wallet';

const { width } = Dimensions.get('window');

interface Props {
  onBack?: () => void;
  onNavigateToBudget?: () => void;
  onNavigateToTab?: (tab: 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings') => void;
  hideBottomBar?: boolean;
}

type CashFlowMode = 'in' | 'out'; // 'in': Thêm tiền mặt, 'out': Trừ tiền mặt

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

export default function CashFlowScreen({
  onBack,
  onNavigateToBudget,
  onNavigateToTab,
  hideBottomBar,
}: Props) {
  const { token } = useAuthStore();
  const { createTransaction } = useTransactionStore();

  const [mode, setMode] = useState<CashFlowMode>('in');
  const [selectedCategory, setSelectedCategory] = useState<string>('other');
  const [amountIn, setAmountIn] = useState<string>('500.000');
  const [amountOut, setAmountOut] = useState<string>('500.000');
  const [dateStr, setDateStr] = useState<string>('18/10/2026');
  const [noteIn, setNoteIn] = useState<string>('Tiền mặt dự phòng cá nhân');
  const [noteOut, setNoteOut] = useState<string>('Thanh toán bữa trưa');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Animation trượt mượt mà cho nút Toggle (Thêm tiền mặt vs Trừ tiền mặt)
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const [toggleBarWidth, setToggleBarWidth] = useState(0);

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: mode === 'in' ? 0 : 1,
      friction: 7,
      tension: 65,
      useNativeDriver: false,
    }).start();
  }, [mode, toggleAnim]);

  const handleSubmit = async () => {
    const currentNote = mode === 'in' ? noteIn : noteOut;
    if (!currentNote.trim()) {
      setHasError(true);
      return;
    }
    setHasError(false);

    const rawAmount = mode === 'in' ? amountIn : amountOut;
    const numericAmount = Number(rawAmount.replace(/[^0-9]/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ (> 0đ).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Lấy ví tiền mặt của người dùng hoặc dùng fallback mặc định
      const defaultWallet = await walletApi.getDefaultWallet(token || undefined);
      const walletId = defaultWallet?._id || defaultWallet?.id || 'w_cash_default';

      const result = await createTransaction(token || undefined, {
        amount: numericAmount,
        type: mode === 'in' ? 'income' : 'expense',
        walletId,
        note: currentNote.trim(),
        transactionDate: new Date().toISOString(),
      });

      if (result.success) {
        const actionName = mode === 'in' ? 'Thêm tiền mặt' : 'Trừ tiền mặt';
        const amountVal = mode === 'in' ? `+${numericAmount.toLocaleString('vi-VN')}đ` : `-${numericAmount.toLocaleString('vi-VN')}đ`;
        Alert.alert(
          'Thành công',
          `${actionName} thành công: ${amountVal}\nGhi chú: ${currentNote.trim()}`,
          [{ text: 'OK', onPress: onBack }]
        );
      } else {
        Alert.alert('Thông báo', result.message || 'Không thể ghi nhận giao dịch.');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi kết nối máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.headerLinks}>
            <TouchableOpacity
              onPress={() => onNavigateToTab ? onNavigateToTab('save') : onNavigateToBudget && onNavigateToBudget()}
              activeOpacity={0.7}
              style={styles.headerLinkBtn}
            >
              <Text style={styles.headerLinkInactive}>Tạo ngân sách</Text>
            </TouchableOpacity>

            <View style={styles.headerLinkActiveBox}>
              <Text style={styles.headerLinkActive}>Thêm/Trừ tiền mặt</Text>
              <View style={styles.activeUnderline} />
            </View>
          </View>
        </View>

        {/* Toggle Switcher: Thêm tiền mặt vs Trừ tiền mặt với hiệu ứng trượt màu */}
        <View
          style={styles.toggleContainer}
          onLayout={(e: LayoutChangeEvent) => setToggleBarWidth(e.nativeEvent.layout.width)}
        >
          {toggleBarWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingTogglePill,
                {
                  width: (toggleBarWidth - 8) / 2,
                  transform: [
                    {
                      translateX: toggleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 4 + (toggleBarWidth - 8) / 2],
                      }),
                    },
                  ],
                  backgroundColor: toggleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#86EFAC', '#FCA5A5'],
                  }),
                },
              ]}
            />
          )}

          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setMode('in')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleBtnText,
                mode === 'in' && styles.toggleBtnInTextActive,
              ]}
            >
              Thêm tiền mặt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setMode('out')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleBtnText,
                mode === 'out' && styles.toggleBtnOutTextActive,
              ]}
            >
              Trừ tiền mặt
            </Text>
          </TouchableOpacity>
        </View>

        {/* CARD 1: SỐ TIỀN & NGÀY GHI NHẬN */}
        <View style={styles.card}>
          <View style={styles.amountHeaderRow}>
            <Text style={styles.cardLabel}>
              {mode === 'in' ? 'Số tiền thêm vào *' : 'Số tiền trừ đi *'}
            </Text>
            <View
              style={[
                styles.badge,
                mode === 'in' ? styles.badgeIn : styles.badgeOut,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  mode === 'in' ? styles.badgeTextIn : styles.badgeTextOut,
                ]}
              >
                {mode === 'in' ? 'TIỀN VÀO' : 'TIỀN RA'}
              </Text>
            </View>
          </View>

          {/* Amount Display / Input */}
          <View style={styles.amountInputRow}>
            <Text
              style={[
                styles.amountSign,
                mode === 'in' ? styles.amountSignIn : styles.amountSignOut,
              ]}
            >
              {mode === 'in' ? '+' : '-'}
            </Text>
            <TextInput
              style={styles.amountInput}
              value={mode === 'in' ? amountIn : amountOut}
              onChangeText={mode === 'in' ? setAmountIn : setAmountOut}
              keyboardType="numeric"
              placeholder="500.000"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.amountUnit}>đ</Text>
          </View>

          {/* Date Picker Row */}
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Ngày ghi nhận *</Text>
            <TouchableOpacity style={styles.dateBadge} activeOpacity={0.7}>
              <Text style={styles.dateText}>{dateStr}</Text>
              <Calendar size={16} color="#0284C7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* CARD 2: PHÂN BỔ VÀO DANH MỤC */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Phân bổ vào danh mục *</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((item) => {
              const IconComp = item.icon;
              const isSelected = selectedCategory === item.id;
              const isFull = item.id === 'other';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.categoryBtn,
                    isFull && styles.categoryBtnFull,
                    isSelected && styles.categoryBtnSelected,
                  ]}
                  onPress={() => setSelectedCategory(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.categoryContent}>
                    <IconComp
                      size={18}
                      color={isSelected ? '#0284C7' : '#0F172A'}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {/* Icon Checkmark khi được chọn */}
                  {isSelected && (
                    <View style={styles.selectedCheckCircle}>
                      <Check size={12} color="#0284C7" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CARD 3: GHI CHÚ */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ghi chú *</Text>
          <View style={styles.noteInputBox}>
            <TextInput
              style={styles.noteInput}
              value={mode === 'in' ? noteIn : noteOut}
              onChangeText={(t) => {
                if (mode === 'in') setNoteIn(t);
                else setNoteOut(t);
                if (t.trim()) setHasError(false);
              }}
              placeholder="Nhập ghi chú chi tiết..."
              placeholderTextColor="#94A3B8"
            />
            <Check size={18} color="#64748B" />
          </View>

          {/* Validation Error Message theo đúng mockup Figma */}
          {hasError && (
            <Text style={styles.errorText}>Vui lòng nhập ghi chú để tiếp tục.</Text>
          )}
        </View>

        {/* NÚT SUBMIT CHÍNH */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {mode === 'in' ? '+ Lưu tiền mặt' : 'Xác nhận'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      {!hideBottomBar && (
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNavBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab && onNavigateToTab('finance')}
              activeOpacity={0.7}
            >
              <View style={styles.navIconCircle}>
                <Wallet size={20} color="#64748B" />
              </View>
              <Text style={styles.navLabel}>Tài chính</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab && onNavigateToTab('cash')}
              activeOpacity={0.7}
            >
              <View style={[styles.navIconCircle, styles.navIconCircleActive]}>
                <Plus size={20} color="#0F172A" />
              </View>
              <Text style={[styles.navLabel, styles.navLabelActive]}>Thêm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => onNavigateToTab ? onNavigateToTab('save') : onNavigateToBudget && onNavigateToBudget()}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLinkBtn: {
    paddingVertical: 4,
  },
  headerLinkInactive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  headerLinkActiveBox: {
    position: 'relative',
    paddingVertical: 4,
  },
  headerLinkActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  toggleContainer: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#BAE6FD',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  slidingTogglePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnInActive: {
    backgroundColor: '#86EFAC', // Xanh lá pastel chuẩn Figma
  },
  toggleBtnOutActive: {
    backgroundColor: '#FCA5A5', // Đỏ cam pastel chuẩn Figma
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  toggleBtnInTextActive: {
    color: '#064E3B',
  },
  toggleBtnOutTextActive: {
    color: '#7F1D1D',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeIn: {
    backgroundColor: '#DCFCE7',
  },
  badgeOut: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextIn: {
    color: '#16A34A',
  },
  badgeTextOut: {
    color: '#DC2626',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountSign: {
    fontSize: 28,
    fontWeight: '900',
    marginRight: 4,
  },
  amountSignIn: {
    color: '#0F172A',
  },
  amountSignOut: {
    color: '#0F172A',
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    minWidth: 140,
    padding: 0,
  },
  amountUnit: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  categoryBtnFull: {
    width: '100%',
  },
  categoryBtnSelected: {
    borderColor: '#38BDF8',
    backgroundColor: '#F0F9FF',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  categoryLabelSelected: {
    color: '#0284C7',
  },
  selectedCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  noteInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    padding: 0,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 8,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: '#0084FF', // Nút xanh dương chuẩn Figma
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#0084FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconCircleActive: {
    backgroundColor: '#BAE6FD',
  },
  navLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
});
