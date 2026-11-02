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
  StatusBar as RNStatusBar,
  Animated,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
import { transactionApi, TransactionItem } from '../../api/transaction';
import { walletApi, WalletItem } from '../../api/wallet';
import { dashboardApi, CategoryBreakdownItem } from '../../api/dashboard';
import DailyExpenseChart from '../../components/DailyExpenseChart';
import TopupModal from '../../components/TopupModal';
import NetWorthCard from '../../components/NetWorthCard';
import BillRemindersCard from '../../components/BillRemindersCard';
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
  const { token, user, setActiveMode } = useAuthStore();
  const { summary, transactions, fetchSummary, fetchTransactions } = useTransactionStore();

  const currentYear = new Date().getFullYear();
  // Khởi tạo tháng hiện tại (mặc định lấy tháng thực tế của hệ thống)
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings'>('finance');
  const [paymentInitialTab, setPaymentInitialTab] = useState<'scan' | 'my_qr'>('scan');
  const [refreshing, setRefreshing] = useState(false);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [topupVisible, setTopupVisible] = useState(false);
  const [topupSuggest, setTopupSuggest] = useState(0);

  const loadWallets = useCallback(async () => {
    const res = await walletApi.getWallets(token || undefined);
    if (res?.success && Array.isArray(res.data)) setWallets(res.data);
  }, [token]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets, refreshKey]);

  const activeWallets = wallets.filter((w) => !w.isArchived);
  const defaultWallet = activeWallets[0] || null;
  const [prevMonthExpense, setPrevMonthExpense] = useState<number>(0);
  const [allTransactions, setAllTransactions] = useState<TransactionItem[]>([]);
  const [breakdownItems, setBreakdownItems] = useState<CategoryBreakdownItem[]>([]);
  const [breakdownTotal, setBreakdownTotal] = useState<number>(0);

  const loadData = useCallback(async (monthIdx: number) => {
    const monthStr = `${currentYear}-${String(monthIdx).padStart(2, '0')}`;
    const prevIdx = monthIdx > 1 ? monthIdx - 1 : 12;
    const prevMonthStr = `${monthIdx > 1 ? currentYear : currentYear - 1}-${String(prevIdx).padStart(2, '0')}`;

    const [sumRes, txRes, allTxRes, breakdownRes] = await Promise.all([
      fetchSummary(token || undefined, monthStr),
      fetchTransactions(token || undefined, monthStr),
      transactionApi.getTransactions(token || undefined, { limit: 1000 }),
      dashboardApi.getBreakdown(token || undefined, {
        type: 'expense',
        period: 'month',
        date: `${monthStr}-01`,
      }),
    ]);

    // Cập nhật dữ liệu phân bổ danh mục thật từ backend API
    if (breakdownRes?.success && breakdownRes.data) {
      setBreakdownItems(breakdownRes.data.items || []);
      setBreakdownTotal(breakdownRes.data.total || 0);
    } else {
      setBreakdownItems([]);
      setBreakdownTotal(0);
    }

    // Lấy thêm summary tháng trước để tính so sánh chênh lệch
    try {
      const prevRes = await transactionApi.getSummary(token || undefined, prevMonthStr);
      if (prevRes?.success && prevRes.data) {
        setPrevMonthExpense(prevRes.data.totalExpense || 0);
      } else {
        setPrevMonthExpense(0);
      }
    } catch {
      setPrevMonthExpense(0);
    }

    if (allTxRes?.success && Array.isArray(allTxRes.data)) {
      setAllTransactions(allTxRes.data);
    }
  }, [token, currentYear, fetchSummary, fetchTransactions]);

  useEffect(() => {
    loadData(currentMonthIndex);
  }, [currentMonthIndex, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(currentMonthIndex);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  };

  const currentTotalWalletBalance = activeWallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  // Số dư tính theo từng tháng:
  // Lấy tổng số dư ví hiện tại trừ đi biến động ròng của các tháng trong tương lai (sau tháng đang chọn)
  const currentBalance = useMemo(() => {
    if (!activeWallets.length) return 0;

    // Thời điểm kết thúc của tháng đang chọn (theo năm hiện tại)
    const endOfMonth = new Date(currentYear, currentMonthIndex, 0, 23, 59, 59, 999);
    const endOfMonthTime = endOfMonth.getTime();

    let futureIncome = 0;
    let futureExpense = 0;

    allTransactions.forEach((t) => {
      const tTime = t.transactionDate ? new Date(t.transactionDate).getTime() : 0;
      if (tTime > endOfMonthTime) {
        if (t.type === 'income') futureIncome += t.amount;
        if (t.type === 'expense') futureExpense += t.amount;
      }
    });

    const futureNet = futureIncome - futureExpense;
    return Math.max(0, currentTotalWalletBalance - futureNet);
  }, [activeWallets, currentTotalWalletBalance, allTransactions, currentYear, currentMonthIndex]);

  // Chi tiêu và thu nhập: lấy số thật từ API của tháng đang chọn, mặc định ban đầu là 0
  const usedAmount = summary.totalExpense || 0;
  const depositedAmount = summary.totalIncome || 0;

  // Tính mức tăng/giảm so với cùng kỳ tháng trước
  const expenseDiff = usedAmount - prevMonthExpense;
  const isIncreased = expenseDiff >= 0;
  const diffAbs = Math.abs(expenseDiff);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN');
  };

  const PALETTE = ['#0284C7', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F97316', '#06B6D4', '#64748B'];

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
    let actualEnd = endAngle;
    if (actualEnd - startAngle >= 359.99) {
      actualEnd = startAngle + 359.9;
    }
    const startOuter = polarToCartesian(cx, cy, outerR, actualEnd);
    const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
    const startInner = polarToCartesian(cx, cy, innerR, actualEnd);
    const endInner = polarToCartesian(cx, cy, innerR, startAngle);

    const largeArc = actualEnd - startAngle <= 180 ? 0 : 1;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
      'Z',
    ].join(' ');
  };

  const cx = 130;
  const cy = 130;
  const innerR = 64;
  const outerR = 110;

  // Tính toán các cung Donut arc động từ breakdownItems
  const donutArcs = useMemo(() => {
    if (!breakdownItems.length || breakdownTotal <= 0) return [];

    let currentAngle = 0;
    return breakdownItems.map((item, idx) => {
      const angleSpan = (item.amount / breakdownTotal) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      const color = item.color && item.color !== '#6B7280' ? item.color : PALETTE[idx % PALETTE.length];

      return {
        ...item,
        color,
        startAngle,
        endAngle,
      };
    });
  }, [breakdownItems, breakdownTotal]);

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

    if (activeTab === 'finance') {
      loadWallets();
      loadData(currentMonthIndex);
      setRefreshKey((k) => k + 1);
    }
  }, [activeTab, currentMonthIndex, loadWallets, loadData]);

  const renderScreenContent = () => {
    switch (activeTab) {
      case 'payment':
        return (
          <PaymentScreen
            initialTab={paymentInitialTab}
            onBackToHome={() => {
              loadWallets();
              loadData(currentMonthIndex);
              setRefreshKey((k) => k + 1);
              setActiveTab('finance');
            }}
            onNavigateToTab={(t) => {
              if (t === 'finance') {
                loadWallets();
                loadData(currentMonthIndex);
                setRefreshKey((k) => k + 1);
              }
              setActiveTab(t);
            }}
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
            <StatusBar style="dark" />
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
              {/* Dual-Mode Admin Switcher Banner */}
              {user?.role === 'admin' && (
                <View style={styles.adminBanner}>
                  <View style={styles.adminBannerLeft}>
                    <Text style={styles.adminBannerTitle}>🛡️ Chế độ Người dùng (Admin)</Text>
                    <Text style={styles.adminBannerSub}>Bạn đang xem giao diện người dùng cá nhân</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.adminBackBtn}
                    onPress={() => setActiveMode('admin')}
                  >
                    <Text style={styles.adminBackBtnText}>⚙️ Về Admin</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Header với Tiêu đề & Mascot Gấu Trúc/Gấu Bông */}
              <View style={styles.headerWrapper}>
                <Text style={styles.screenTitle}>Trung tâm tài chính</Text>
                <Image source={MASCOT_IMG} style={styles.mascotImage} resizeMode="contain" />
              </View>

              {/* Card: Tổng quan dashboard */}
              <View style={styles.dashboardCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>Tổng quan dashboard</Text>

                  {/* Pill Chọn Tháng */}
                  <View style={styles.monthPill}>
                    <TouchableOpacity
                      onPress={() => setCurrentMonthIndex((m) => Math.max(1, m - 1))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={currentMonthIndex <= 1}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={16} color={currentMonthIndex <= 1 ? '#CBD5E1' : '#334155'} />
                    </TouchableOpacity>
                    <Text style={styles.monthText} numberOfLines={1}>{`Tháng ${currentMonthIndex}`}</Text>
                    <TouchableOpacity
                       onPress={() => setCurrentMonthIndex((m) => Math.min(12, m + 1))}
                       hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                       disabled={currentMonthIndex >= 12}
                       activeOpacity={0.7}
                    >
                      <ChevronRight size={16} color={currentMonthIndex >= 12 ? '#CBD5E1' : '#334155'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Ô Lớn: Số tiền hiện tại */}
                <View style={styles.mainBalanceBox}>
                  <View style={styles.mainBalanceHeader}>
                    <Text style={styles.mainBalanceLabel}>Số tiền hiện tại</Text>
                    {!!defaultWallet?.accountNumber && (
                      <View style={styles.accountBadge}>
                        <Text style={styles.accountBadgeText}>STK: {defaultWallet.accountNumber}</Text>
                      </View>
                    )}
                  </View>
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
                  {diffAbs === 0 ? (
                    <Text style={{ color: '#0F172A', fontWeight: '800' }}>0đ</Text>
                  ) : (
                    <Text style={isIncreased ? styles.highlightRed : styles.highlightGreen}>
                      {isIncreased ? 'Tăng ' : 'Giảm '}
                      {formatCurrency(diffAbs)}đ
                    </Text>
                  )}{' '}
                  so với cùng kì tháng trước
                </Text>
              </View>


              <NetWorthCard token={token || undefined} refreshKey={refreshKey} />

              <BillRemindersCard
                token={token || undefined}
                wallet={defaultWallet}
                onPaid={() => {
                  setRefreshKey((k) => k + 1);
                  loadData(currentMonthIndex);
                }}
                onInsufficient={(missing) => {
                  setTopupSuggest(missing);
                  setTopupVisible(true);
                }}
              />

              <TopupModal
                visible={topupVisible}
                token={token || undefined}
                wallet={defaultWallet}
                suggestedAmount={topupSuggest}
                onClose={() => setTopupVisible(false)}
                onSuccess={() => {
                  setTopupVisible(false);
                  setRefreshKey((k) => k + 1);
                  loadData(currentMonthIndex);
                }}
              />

              {/* Nút hành động nhanh: Quét QR & Thanh toán / Nhận tiền */}
              <View style={styles.quickPayContainer}>
                <TouchableOpacity
                  style={styles.quickPayBanner}
                  onPress={() => {
                    setPaymentInitialTab('scan');
                    setActiveTab('payment');
                  }}
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

                <TouchableOpacity
                  style={styles.myQrBanner}
                  onPress={() => {
                    setPaymentInitialTab('my_qr');
                    setActiveTab('payment');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.myQrIconBox}>
                    <QrCode size={20} color="#059669" />
                  </View>
                  <View style={styles.quickPayTextContainer}>
                    <Text style={styles.myQrTitle}>Mã QR của tôi</Text>
                    <Text style={styles.quickPaySubtitle}>Nhận tiền chuyển khoản P2P nhanh chóng</Text>
                  </View>
                  <ChevronRight size={18} color="#059669" />
                </TouchableOpacity>
              </View>

              {/* Biểu đồ chi tiêu theo ngày từ API /api/reports/daily */}
              <DailyExpenseChart
                token={token || undefined}
                monthStr={`${currentYear}-${String(currentMonthIndex).padStart(2, '0')}`}
                refreshKey={refreshKey}
              />

              {/* Card Cơ cấu chi tiêu theo danh mục kết nối API /api/dashboard/breakdown */}
              <View style={styles.donutCard}>
                <View style={styles.donutCardHeader}>
                  <Text style={styles.donutCardTitle}>Cơ cấu chi tiêu danh mục</Text>
                  <Text style={styles.donutCardSubtitle}>
                    Tháng {currentMonthIndex} • {breakdownItems.length} danh mục
                  </Text>
                </View>

                <View style={styles.donutChartWrapper}>
                  <Svg width={260} height={260} viewBox="0 0 260 260">
                    {donutArcs.length === 0 ? (
                      <>
                        <Path
                          d={describeDonutArc(cx, cy, innerR, outerR, 0, 180)}
                          fill="#E2E8F0"
                        />
                        <Path
                          d={describeDonutArc(cx, cy, innerR, outerR, 180, 360)}
                          fill="#E2E8F0"
                        />
                      </>
                    ) : donutArcs.length === 1 ? (
                      <>
                        <Path
                          d={describeDonutArc(cx, cy, innerR, outerR, 0, 180)}
                          fill={donutArcs[0].color}
                        />
                        <Path
                          d={describeDonutArc(cx, cy, innerR, outerR, 180, 360)}
                          fill={donutArcs[0].color}
                        />
                      </>
                    ) : (
                      donutArcs.map((arc, i) => (
                        <Path
                          key={arc.categoryId || `arc-${i}`}
                          d={describeDonutArc(cx, cy, innerR, outerR, arc.startAngle, arc.endAngle)}
                          fill={arc.color}
                        />
                      ))
                    )}
                  </Svg>

                  {/* Tâm vòng tròn Donut */}
                  <View style={styles.donutCenterInfo}>
                    <Text style={styles.donutCenterLabel}>Tổng chi</Text>
                    <Text style={styles.donutCenterAmount} numberOfLines={1}>
                      {formatCurrency(breakdownTotal)}đ
                    </Text>
                  </View>
                </View>

                {/* Legend danh sách danh mục phân bổ */}
                <View style={styles.donutLegendList}>
                  {breakdownItems.length === 0 ? (
                    <Text style={styles.donutEmptyText}>Chưa có chi tiêu danh mục nào trong tháng này.</Text>
                  ) : (
                    breakdownItems.map((item, i) => {
                      const color = item.color && item.color !== '#6B7280' ? item.color : PALETTE[i % PALETTE.length];
                      return (
                        <View key={item.categoryId || `item-${i}`} style={styles.legendRow}>
                          <View style={styles.legendLeft}>
                            <View style={[styles.legendDot, { backgroundColor: color }]} />
                            <Text style={styles.legendName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.legendTxCount}>
                              ({item.transactionCount} gd)
                            </Text>
                          </View>
                          <View style={styles.legendRight}>
                            <Text style={styles.legendAmount}>
                              {formatCurrency(item.amount)}đ
                            </Text>
                            <Text style={styles.legendPercent}>
                              {item.percent}%
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
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
  adminBanner: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminBannerLeft: { flex: 1, marginRight: 8 },
  adminBannerTitle: { fontSize: 13, fontWeight: '700', color: '#6B21A8' },
  adminBannerSub: { fontSize: 11, color: '#7E22CE', marginTop: 2 },
  adminBackBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminBackBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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
  walletActionBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#BAE6FD',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) + 4 : 0,
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
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    flexShrink: 1,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
    minWidth: 100,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 3,
    includeFontPadding: false,
    textAlign: 'center',
  },
  mainBalanceBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mainBalanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  accountBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  accountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  mainBalanceLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
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
  donutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  donutCardHeader: {
    marginBottom: 8,
  },
  donutCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  donutCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  donutChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 12,
    height: 260,
  },
  donutCenterInfo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
  },
  donutCenterLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  donutCenterAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    textAlign: 'center',
  },
  donutLegendList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 10,
  },
  donutEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  legendTxCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  legendRight: {
    alignItems: 'flex-end',
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  legendPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
    marginTop: 1,
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
  quickPayContainer: {
    marginVertical: 12,
    gap: 10,
  },
  quickPayBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
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
  myQrBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  myQrIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myQrTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
});
