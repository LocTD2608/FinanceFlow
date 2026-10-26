import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import {
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  QrCode,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { transactionApi } from '../../api/transaction';
import CreateBudgetScreen from '../budget/CreateBudgetScreen';
import PaymentScreen from '../payment/PaymentScreen';
import CashFlowScreen from '../cash/CashFlowScreen';
import ExpenseAnalyticsScreen from '../analytics/ExpenseAnalyticsScreen';
import ProfileScreen from '../profile/ProfileScreen';
import AnimatedBottomBar from '../../components/navigation/AnimatedBottomBar';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

// Mascot bear image
const MASCOT_IMG = require('../../../assets/mascot.png');

interface Props {
  onLogout?: () => void;
}

export default function FinancialCenterScreen({ onLogout }: Props) {
  const { token } = useAuthStore();
  const { summary, transactions, fetchSummary, fetchTransactions } = useTransactionStore();

  const currentYear = new Date().getFullYear();
  // Khởi tạo tháng hiện tại (mặc định lấy tháng thực tế của hệ thống)
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings'>('finance');
  const [refreshing, setRefreshing] = useState(false);
  const [prevMonthExpense, setPrevMonthExpense] = useState<number>(2820000); // Mặc định 2.820.000 để chênh lệch 300.000đ

  const loadData = useCallback(async (monthIdx: number) => {
    const monthStr = `${currentYear}-${String(monthIdx).padStart(2, '0')}`;
    const prevIdx = monthIdx > 1 ? monthIdx - 1 : 12;
    const prevMonthStr = `${monthIdx > 1 ? currentYear : currentYear - 1}-${String(prevIdx).padStart(2, '0')}`;

    await Promise.all([
      fetchSummary(token || undefined, monthStr),
      fetchTransactions(token || undefined, monthStr),
    ]);

    // Lấy thêm summary tháng trước để tính so sánh chênh lệch
    try {
      const prevRes = await transactionApi.getSummary(token || undefined, prevMonthStr);
      if (prevRes.success && prevRes.data) {
        setPrevMonthExpense(prevRes.data.totalExpense);
      }
    } catch {
      // Giữ giá trị fallback
    }
  }, [token, currentYear, fetchSummary, fetchTransactions]);

  useEffect(() => {
    loadData(currentMonthIndex);
  }, [currentMonthIndex, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(currentMonthIndex);
    setRefreshing(false);
  };

  // Tính toán số dư hiển thị:
  // Số dư gốc mockup là 12.450.000đ, tự động cộng dòng tiền ròng thu-chi từ API
  const baseBalance = 12450000;
  const currentBalance = baseBalance + (summary.netCashFlow || 0);

  // Chi tiêu và thu nhập: nếu API có số liệu thì dùng, nếu chưa có thì hiển thị số mặc định mockup
  const usedAmount = summary.totalExpense > 0 ? summary.totalExpense : 3120000;
  const depositedAmount = summary.totalIncome > 0 ? summary.totalIncome : 15000000;

  // Tính mức tăng/giảm so với cùng kỳ tháng trước
  const expenseDiff = usedAmount - prevMonthExpense;
  const isIncreased = expenseDiff >= 0;
  const diffAbs = Math.abs(expenseDiff > 0 ? expenseDiff : 300000);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN');
  };

  // Phân tích tỷ lệ chi tiêu theo danh mục cho biểu đồ Donut Chart
  const { foodPercent, otherPercent, angles } = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    let foodTotal = 0;
    let otherTotal = 0;

    expenses.forEach((t) => {
      const noteLower = (t.note || '').toLowerCase();
      if (
        noteLower.includes('ăn') ||
        noteLower.includes('uống') ||
        noteLower.includes('cơm') ||
        noteLower.includes('phở') ||
        noteLower.includes('cafe') ||
        noteLower.includes('food')
      ) {
        foodTotal += t.amount;
      } else {
        otherTotal += t.amount;
      }
    });

    const total = foodTotal + otherTotal;
    let fPct = 65;
    let oPct = 35;

    if (total > 0) {
      fPct = Math.round((foodTotal / total) * 100);
      oPct = 100 - fPct;
    }

    // Góc cung tương ứng trên đường tròn 360 độ
    const a1 = Math.round((fPct / 100) * 360);
    return {
      foodPercent: fPct,
      otherPercent: oPct,
      angles: { a1 },
    };
  }, [transactions]);

  // Helper tính góc thành tọa độ cho SVG Donut
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Vẽ hình quạt Donut Arc (vành khuyên)
  const describeDonutArc = (
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number
  ) => {
    const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
    const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
    const startInner = polarToCartesian(cx, cy, innerR, endAngle);
    const endInner = polarToCartesian(cx, cy, innerR, startAngle);

    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  const cx = 150;
  const cy = 150;
  const innerR = 64;
  const outerR = 120;

  // Animation values cho chuyển trang mượt mà
  const pageOpacity = useRef(new Animated.Value(1)).current;
  const pageTranslateX = useRef(new Animated.Value(0)).current;
  const prevTabRef = useRef(activeTab);

  const tabOrder: Record<string, number> = {
    finance: 0,
    cash: 1,
    save: 2,
    chart: 3,
    settings: 4,
    payment: 5,
  };

  useEffect(() => {
    if (prevTabRef.current === activeTab) return;

    const prevIdx = tabOrder[prevTabRef.current] ?? 0;
    const currIdx = tabOrder[activeTab] ?? 0;
    prevTabRef.current = activeTab;

    // Trượt từ phải sang nếu tiến tới tab tiếp theo, trượt từ trái sang nếu lùi lại
    const enterFrom = currIdx >= prevIdx ? 24 : -24;

    pageTranslateX.setValue(enterFrom);
    pageOpacity.setValue(0.2);

    Animated.parallel([
      Animated.timing(pageOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(pageTranslateX, {
        toValue: 0,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab]);

  const renderScreenContent = () => {
    switch (activeTab) {
      case 'payment':
        return (
          <PaymentScreen
            onBackToHome={() => setActiveTab('finance')}
            onNavigateToTab={(t) => setActiveTab(t)}
            hideBottomBar
          />
        );

      case 'cash':
        return (
          <CashFlowScreen
            onBack={() => setActiveTab('finance')}
            onNavigateToBudget={() => setActiveTab('save')}
            onNavigateToTab={(t) => setActiveTab(t)}
            hideBottomBar
          />
        );

      case 'save':
        return (
          <CreateBudgetScreen
            onBackToFinance={() => setActiveTab('finance')}
            onNavigateToTab={(t) => setActiveTab(t)}
            hideBottomBar
          />
        );

      case 'chart':
        return (
          <ExpenseAnalyticsScreen
            onBack={() => setActiveTab('finance')}
            onNavigateToTab={(t) => setActiveTab(t)}
            hideBottomBar
          />
        );

      case 'settings':
        return (
          <ProfileScreen
            onBack={() => setActiveTab('finance')}
            onLogout={onLogout}
            onNavigateToTab={(t) => setActiveTab(t)}
            hideBottomBar
          />
        );

      case 'finance':
      default:
        return (
          <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#BAE6FD" />
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#0284C7']}
                  tintColor="#0284C7"
                />
              }
            >
              {/* Header với Tiêu đề & Mascot Gấu Trúc/Gấu Bông */}
              <View style={styles.headerWrapper}>
                <Text style={styles.screenTitle}>Trung tâm tài chính</Text>
                <Image source={MASCOT_IMG} style={styles.mascotImage} resizeMode="contain" />
              </View>

              {/* Card: Tổng quan dashboard */}
              <View style={styles.dashboardCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Tổng quan dashboard</Text>

                  {/* Pill Chọn Tháng */}
                  <View style={styles.monthPill}>
                    <TouchableOpacity
                      onPress={() => setCurrentMonthIndex((m) => Math.max(1, m - 1))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={16} color="#334155" />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{`Tháng ${currentMonthIndex}`}</Text>
                    <TouchableOpacity
                      onPress={() => setCurrentMonthIndex((m) => Math.min(12, m + 1))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <ChevronRight size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ô Lớn: Số tiền hiện tại */}
                <View style={styles.mainBalanceBox}>
                  <Text style={styles.mainBalanceLabel}>Số tiền hiện tại</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.currencySymbol}>đ</Text>
                    <Text style={styles.mainBalanceAmount}>{formatCurrency(currentBalance)}</Text>
                  </View>
                </View>

                {/* Hàng 2 Ô: Số tiền đã sử dụng & Tổng tiền nạp vào */}
                <View style={styles.twoColsRow}>
                  {/* Box Trái */}
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Số tiền đã sử dụng</Text>
                    <View style={styles.amountRowSmall}>
                      <Text style={styles.currencySymbolSmall}>đ</Text>
                      <Text style={styles.statAmount}>{formatCurrency(usedAmount)}</Text>
                    </View>
                  </View>

                  {/* Box Phải */}
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Tổng tiền nạp vào</Text>
                    <View style={styles.amountRowSmall}>
                      <Text style={styles.currencySymbolSmall}>đ</Text>
                      <Text style={styles.statAmount}>{formatCurrency(depositedAmount)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Thanh Pill Trạng thái so sánh */}
              <View style={styles.comparisonPill}>
                <Text style={styles.comparisonText}>
                  <Text style={isIncreased ? styles.highlightRed : styles.highlightGreen}>
                    {isIncreased ? 'Tăng ' : 'Giảm '}
                    {formatCurrency(diffAbs)}đ
                  </Text>{' '}
                  so với cùng kì tháng trước
                </Text>
              </View>

              {/* Nút hành động nhanh: Quét QR & Thanh toán */}
              <TouchableOpacity
                style={styles.quickPayBanner}
                onPress={() => setActiveTab('payment')}
                activeOpacity={0.8}
              >
                <View style={styles.quickPayIconBox}>
                  <QrCode size={20} color="#0284C7" />
                </View>
                <View style={styles.quickPayTextContainer}>
                  <Text style={styles.quickPayTitle}>Quét mã QR thanh toán</Text>
                  <Text style={styles.quickPaySubtitle}>Chuyển tiền & phân loại tự động vào ngân sách</Text>
                </View>
                <ChevronRight size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Biểu đồ Donut Chart trung tâm */}
              <View style={styles.chartSection}>
                <Svg width={300} height={300} viewBox="0 0 300 300">
                  {/* 1. Mảng Trắng (Ăn uống): 0° đến angles.a1 */}
                  <Path
                    d={describeDonutArc(cx, cy, innerR, outerR, 0, Math.max(10, Math.min(350, angles.a1)))}
                    fill="#FFFFFF"
                  />

                  {/* 2. Mảng Xanh Biển (Khác): angles.a1 đến 360° */}
                  <Path
                    d={describeDonutArc(cx, cy, innerR, outerR, Math.max(10, Math.min(350, angles.a1)), 360)}
                    fill="#0284C7"
                  />

                  {/* Vạch chỉ hướng (Leader lines) */}
                  <Line x1={200} y1={95} x2={230} y2={95} stroke="#0F172A" strokeWidth={1.5} />
                  <Line x1={62} y1={100} x2={98} y2={100} stroke="#0F172A" strokeWidth={1.5} />
                </Svg>

                {/* Nhãn chữ nổi (Labels) với tỷ lệ phần trăm động */}
                <Text style={[styles.chartLabel, styles.labelAnUong]}>
                  Ăn uống ({foodPercent}%)
                </Text>
                <Text style={[styles.chartLabel, styles.labelKhac]}>
                  Khác ({otherPercent}%)
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        );
    }
  };

  return (
    <View style={styles.mainContainer}>
      <Animated.View
        style={[
          styles.screenAnimatedWrapper,
          {
            opacity: pageOpacity,
            transform: [{ translateX: pageTranslateX }],
          },
        ]}
      >
        {renderScreenContent()}
      </Animated.View>

      {/* Persistent Animated Bottom Navigation Bar với hiệu ứng di chuyển màu trượt mượt mà */}
      <AnimatedBottomBar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#BAE6FD',
    alignItems: 'center',
  },
  screenAnimatedWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
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
  headerWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  mascotImage: {
    width: 96,
    height: 72,
    marginBottom: -4,
  },
  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 4,
  },
  mainBalanceBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mainBalanceLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textDecorationLine: 'underline',
    marginRight: 6,
  },
  mainBalanceAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  twoColsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  amountRowSmall: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbolSmall: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textDecorationLine: 'underline',
    marginRight: 4,
  },
  statAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  comparisonPill: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: '#B4E2FA',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 10,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  comparisonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  highlightRed: {
    color: '#EF4444',
    fontWeight: '800',
  },
  highlightGreen: {
    color: '#16A34A',
    fontWeight: '800',
  },
  chartSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    position: 'relative',
    height: 310,
  },
  chartLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  labelAnUong: {
    top: 85,
    right: 18,
  },
  labelKhac: {
    top: 145,
    right: 12,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  bottomNavBar: {
    backgroundColor: '#F8FAFC',
    borderRadius: 36,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  navIconCircleActive: {
    backgroundColor: '#E0F2FE',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  quickPayBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickPayIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPayTextContainer: {
    flex: 1,
  },
  quickPayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickPaySubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
