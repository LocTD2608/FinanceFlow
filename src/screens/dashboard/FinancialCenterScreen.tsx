import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import Svg, { Path, G, Line, Circle } from 'react-native-svg';
import {
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import AddTransactionModal from './AddTransactionModal';

const { width } = Dimensions.get('window');

// Mascot bear image
const MASCOT_IMG = require('../../../assets/mascot.png');

export default function FinancialCenterScreen() {
  const { token } = useAuthStore();
  const { summary, fetchSummary, fetchTransactions } = useTransactionStore();

  const [currentMonthIndex, setCurrentMonthIndex] = useState(10); // Tháng 10
  const [activeTab, setActiveTab] = useState<'finance' | 'add' | 'save' | 'chart' | 'settings'>('finance');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const monthStr = `2026-${String(currentMonthIndex).padStart(2, '0')}`;
    fetchSummary(token || undefined, monthStr);
    fetchTransactions(token || undefined, monthStr);
  }, [token, currentMonthIndex]);

  // Dữ liệu hiển thị (kết hợp dữ liệu mock theo chuẩn thiết kế và summary động từ store)
  const currentBalance = summary.netCashFlow !== 0 ? 12450000 + summary.netCashFlow : 12450000;
  const usedAmount = summary.totalExpense > 0 ? summary.totalExpense : 3120000;
  const depositedAmount = summary.totalIncome > 0 ? summary.totalIncome : 15000000;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN');
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
              >
                <ChevronLeft size={16} color="#334155" />
              </TouchableOpacity>
              <Text style={styles.monthText}>{`< Tháng ${currentMonthIndex} >`}</Text>
              <TouchableOpacity
                onPress={() => setCurrentMonthIndex((m) => Math.min(12, m + 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            <Text style={styles.highlightRed}>Tăng 300.000đ</Text> so với cùng kì tháng trước
          </Text>
        </View>

        {/* Biểu đồ Donut Chart trung tâm */}
        <View style={styles.chartSection}>
          <Svg width={300} height={300} viewBox="0 0 300 300">
            {/* Các phân đoạn bánh Donut */}
            {/* 1. Mảng Trắng (Ăn uống): 0° đến 65° */}
            <Path
              d={describeDonutArc(cx, cy, innerR, outerR, 0, 65)}
              fill="#FFFFFF"
            />
            {/* 2. Mảng Xanh Lam Đậm (Khác): 65° đến 125° */}
            <Path
              d={describeDonutArc(cx, cy, innerR, outerR, 65, 125)}
              fill="#4379F2"
            />
            {/* 3. Mảng Xanh Biển Nhạt (Phần đáy phải): 125° đến 210° */}
            <Path
              d={describeDonutArc(cx, cy, innerR, outerR, 125, 210)}
              fill="#67E8F9"
            />
            {/* 4. Mảng Xanh Biển Trung (Phần đáy trái): 210° đến 280° */}
            <Path
              d={describeDonutArc(cx, cy, innerR, outerR, 210, 280)}
              fill="#38BDF8"
            />
            {/* 5. Mảng Xanh Biển Đậm Vừa (Góc trên trái): 280° đến 360° */}
            <Path
              d={describeDonutArc(cx, cy, innerR, outerR, 280, 360)}
              fill="#22D3EE"
            />

            {/* Vạch chỉ hướng (Leader lines) */}
            {/* Vạch 1: Ăn uống */}
            <Line x1={200} y1={95} x2={230} y2={95} stroke="#0F172A" strokeWidth={1.5} />
            {/* Vạch 2: Khác */}
            <Line x1={235} y1={155} x2={250} y2={155} stroke="#0F172A" strokeWidth={1.5} />
            {/* Vạch 3: Đáy phải */}
            <Line x1={202} y1={235} x2={246} y2={235} stroke="#0F172A" strokeWidth={1.5} />
            {/* Vạch 4: Đáy trái */}
            <Line x1={24} y1={218} x2={70} y2={218} stroke="#0F172A" strokeWidth={1.5} />
            {/* Vạch 5: Trên trái */}
            <Line x1={62} y1={100} x2={98} y2={100} stroke="#0F172A" strokeWidth={1.5} />
          </Svg>

          {/* Nhãn chữ nổi (Labels) đặt vị trí tương ứng chuẩn mockup */}
          <Text style={[styles.chartLabel, styles.labelAnUong]}>Ăn uống (...%)</Text>
          <Text style={[styles.chartLabel, styles.labelKhac]}>Khác (...%)</Text>
        </View>
      </ScrollView>

      {/* Thanh Bottom Navigation chuẩn mockup (Viên thuốc trắng bo tròn) */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNavBar}>
          {/* 1. Tài chính */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('finance')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, activeTab === 'finance' && styles.navIconCircleActive]}>
              <Wallet size={22} color={activeTab === 'finance' ? '#0F172A' : '#64748B'} />
            </View>
            <Text style={[styles.navLabel, activeTab === 'finance' && styles.navLabelActive]}>
              Tài chính
            </Text>
          </TouchableOpacity>

          {/* 2. Thêm */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              setActiveTab('add');
              setIsAddModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, activeTab === 'add' && styles.navIconCircleActive]}>
              <Plus size={22} color={activeTab === 'add' ? '#0F172A' : '#64748B'} />
            </View>
            <Text style={[styles.navLabel, activeTab === 'add' && styles.navLabelActive]}>
              Thêm
            </Text>
          </TouchableOpacity>

          {/* 3. Lưu */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('save')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, activeTab === 'save' && styles.navIconCircleActive]}>
              <Bookmark size={22} color={activeTab === 'save' ? '#0F172A' : '#64748B'} />
            </View>
            <Text style={[styles.navLabel, activeTab === 'save' && styles.navLabelActive]}>
              Lưu
            </Text>
          </TouchableOpacity>

          {/* 4. Biểu đồ */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('chart')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, activeTab === 'chart' && styles.navIconCircleActive]}>
              <BarChart2 size={22} color={activeTab === 'chart' ? '#0F172A' : '#64748B'} />
            </View>
            <Text style={[styles.navLabel, activeTab === 'chart' && styles.navLabelActive]}>
              Biểu đồ
            </Text>
          </TouchableOpacity>

          {/* 5. Cài đặt */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, activeTab === 'settings' && styles.navIconCircleActive]}>
              <Settings size={22} color={activeTab === 'settings' ? '#0F172A' : '#64748B'} />
            </View>
            <Text style={[styles.navLabel, activeTab === 'settings' && styles.navLabelActive]}>
              Cài đặt
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Thêm giao dịch */}
      <AddTransactionModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          const monthStr = `2026-${String(currentMonthIndex).padStart(2, '0')}`;
          fetchSummary(token || undefined, monthStr);
          fetchTransactions(token || undefined, monthStr);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#BAE6FD', // Nền xanh da trời phấn chuẩn thiết kế
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
    paddingHorizontal: 8,
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
    borderRadius: 28,
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
});
