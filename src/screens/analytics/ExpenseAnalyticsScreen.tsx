import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  Calendar,
  Search,
  ArrowUpDown,
  Plus,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  MoreHorizontal,
  Wallet,
  Bookmark,
  BarChart2,
  Settings,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Props {
  onBack?: () => void;
  onOpenAddModal?: () => void;
  onNavigateToTab?: (tab: 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings') => void;
}

type AnalyticsView = 'list' | 'rank_expense' | 'rank_category';

interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  icon: any;
  date: string;
  time?: string;
  amount: number;
  paymentMethod: 'qr' | 'cash';
}

const SAMPLE_EXPENSES: ExpenseItem[] = [
  {
    id: '1',
    title: 'Mua quần áo',
    category: 'shopping',
    categoryName: 'Mua sắm',
    icon: ShoppingBag,
    date: '18/10/2026',
    amount: 800000,
    paymentMethod: 'qr',
  },
  {
    id: '2',
    title: 'Bữa tối gia đình',
    category: 'food',
    categoryName: 'Ăn uống',
    icon: Utensils,
    date: '18/10/2026',
    amount: 400000,
    paymentMethod: 'qr',
  },
  {
    id: '3',
    title: 'Đi chợ',
    category: 'food',
    categoryName: 'Ăn uống',
    icon: Utensils,
    date: '17/10/2026',
    amount: 300000,
    paymentMethod: 'cash',
  },
  {
    id: '4',
    title: 'Vé xem phim',
    category: 'entertainment',
    categoryName: 'Giải trí',
    icon: Film,
    date: '17/10/2026',
    amount: 250000,
    paymentMethod: 'qr',
  },
  {
    id: '5',
    title: 'Taxi về nhà',
    category: 'transport',
    categoryName: 'Di chuyển',
    icon: Car,
    date: '16/10/2026',
    amount: 150000,
    paymentMethod: 'cash',
  },
  {
    id: '6',
    title: 'In tài liệu',
    category: 'other',
    categoryName: 'Khác',
    icon: MoreHorizontal,
    date: '16/10/2026',
    amount: 100000,
    paymentMethod: 'cash',
  },
];

export default function ExpenseAnalyticsScreen({
  onBack,
  onOpenAddModal,
  onNavigateToTab,
}: Props) {
  const [viewMode, setViewMode] = useState<AnalyticsView>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [paymentFilter, setPaymentFilter] = useState('Tất cả');

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN') + 'đ';
  };

  // Tính tổng số tiền và số lượng
  const totalAmount = 2000000;
  const totalCount = SAMPLE_EXPENSES.length;

  // Lọc chi tiêu theo tìm kiếm
  const filteredExpenses = useMemo(() => {
    return SAMPLE_EXPENSES.filter((item) => {
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [searchQuery]);

  // Nhóm theo ngày cho View Mode: List
  const groupedDates = useMemo(() => {
    const dates = ['18/10/2026', '17/10/2026', '16/10/2026'];
    return dates.map((d) => {
      const items = filteredExpenses.filter((e) => e.date === d);
      const subtotal = items.reduce((sum, cur) => sum + cur.amount, 0);
      return { date: d, items, subtotal };
    });
  }, [filteredExpenses]);

  // Xếp hạng chi tiêu từ cao đến thấp
  const rankedExpenses = useMemo(() => {
    return [...SAMPLE_EXPENSES].sort((a, b) => b.amount - a.amount);
  }, []);

  // Xếp hạng danh mục từ cao đến thấp
  const rankedCategories = [
    {
      id: '1',
      name: 'Mua sắm',
      icon: ShoppingBag,
      txCount: 1,
      amount: 800000,
      percent: 40,
      color: '#0284C7',
    },
    {
      id: '2',
      name: 'Ăn uống',
      icon: Utensils,
      txCount: 2,
      amount: 700000,
      percent: 35,
      color: '#38BDF8',
    },
    {
      id: '3',
      name: 'Giải trí',
      icon: Film,
      txCount: 1,
      amount: 250000,
      percent: 12.5,
      color: '#7DD3FC',
    },
    {
      id: '4',
      name: 'Di chuyển',
      icon: Car,
      txCount: 1,
      amount: 150000,
      percent: 7.5,
      color: '#BAE6FD',
    },
    {
      id: '5',
      name: 'Khác',
      icon: MoreHorizontal,
      txCount: 1,
      amount: 100000,
      percent: 5,
      color: '#E2E8F0',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {viewMode === 'list'
              ? 'Danh sách chi tiêu'
              : viewMode === 'rank_expense'
              ? 'Xếp hạng khoản chi'
              : 'Xếp hạng danh mục'}
          </Text>
        </View>

        {/* Period Overview Card (Dùng chung cho cả 3 chế độ) */}
        <View style={styles.periodCard}>
          <TouchableOpacity style={styles.datePickerBtn} activeOpacity={0.7}>
            <Calendar size={14} color="#0284C7" />
            <Text style={styles.datePickerText}>16/10 – 18/10/2026</Text>
            <ChevronDown size={14} color="#64748B" />
          </TouchableOpacity>

          <Text style={styles.periodLabel}>Tổng chi trong kỳ</Text>
          <View style={styles.periodAmountRow}>
            <Text style={styles.periodAmount}>{formatCurrency(totalAmount)}</Text>
            <Text style={styles.periodCount}>{totalCount} khoản chi</Text>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════
            CHẾ ĐỘ 1: DANH SÁCH CHI TIÊU (IMAGE 2 - LEFT)
        ════════════════════════════════════════════════════════════════ */}
        {viewMode === 'list' && (
          <View>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={16} color="#64748B" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm khoản chi..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Filter Dropdowns */}
            <View style={styles.filtersRow}>
              <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
                <Text style={styles.filterBtnText}>Danh mục: {categoryFilter}</Text>
                <ChevronDown size={14} color="#64748B" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
                <Text style={styles.filterBtnText}>Thanh toán: {paymentFilter}</Text>
                <ChevronDown size={14} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Actions Row: + Thêm khoản chi & Xếp hạng */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.addExpenseAction}
                onPress={onOpenAddModal}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#0284C7" />
                <Text style={styles.addExpenseText}>Thêm khoản chi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rankAction}
                onPress={() => setViewMode('rank_expense')}
                activeOpacity={0.7}
              >
                <Text style={styles.rankText}>Xếp hạng</Text>
                <ArrowUpDown size={14} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Date Groups */}
            {groupedDates.map((group) => {
              if (group.items.length === 0) return null;
              return (
                <View key={group.date} style={styles.dateGroupContainer}>
                  {/* Date Subheader */}
                  <View style={styles.groupHeaderRow}>
                    <Text style={styles.groupDateText}>{group.date}</Text>
                    <Text style={styles.groupSubtotalText}>
                      {formatCurrency(group.subtotal)}
                    </Text>
                  </View>

                  {/* Expense Items in Date */}
                  <View style={styles.expenseCardsContainer}>
                    {group.items.map((item) => {
                      const IconComp = item.icon;
                      const isQR = item.paymentMethod === 'qr';

                      return (
                        <View key={item.id} style={styles.expenseCard}>
                          <View style={styles.expenseLeft}>
                            <View style={styles.categoryIconCircle}>
                              <IconComp size={18} color="#0F172A" />
                            </View>
                            <View>
                              <Text style={styles.expenseTitle}>{item.title}</Text>
                              <Text style={styles.expenseSubText}>
                                {item.categoryName} •{' '}
                                {isQR ? 'Tài khoản / QR' : 'Tiền mặt'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.expenseRight}>
                            <Text style={styles.expenseAmountText}>
                              {formatCurrency(item.amount)}
                            </Text>
                            {isQR && (
                              <Text style={styles.expenseTagText}>
                                Tài khoản / QR
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            CHẾ ĐỘ 2 & 3: XẾP HẠNG (IMAGE 2 - CENTER & RIGHT)
        ════════════════════════════════════════════════════════════════ */}
        {(viewMode === 'rank_expense' || viewMode === 'rank_category') && (
          <View>
            {/* Pill Tab Switcher: [ Khoản chi ]   [ Danh mục ] */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[
                  styles.tabSwitcherBtn,
                  viewMode === 'rank_expense' && styles.tabSwitcherBtnActive,
                ]}
                onPress={() => setViewMode('rank_expense')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabSwitcherText,
                    viewMode === 'rank_expense' && styles.tabSwitcherTextActive,
                  ]}
                >
                  Khoản chi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabSwitcherBtn,
                  viewMode === 'rank_category' && styles.tabSwitcherBtnActive,
                ]}
                onPress={() => setViewMode('rank_category')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabSwitcherText,
                    viewMode === 'rank_category' && styles.tabSwitcherTextActive,
                  ]}
                >
                  Danh mục
                </Text>
              </TouchableOpacity>
            </View>

            {/* Back to List Link */}
            <TouchableOpacity
              style={styles.backToListLink}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Text style={styles.backToListText}>‹ Quay lại danh sách chi tiêu</Text>
            </TouchableOpacity>

            {/* SUB-VIEW 2A: XẾP HẠNG KHOẢN CHI (TỪ CAO ĐẾN THẤP) */}
            {viewMode === 'rank_expense' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <ArrowUpDown size={14} color="#0284C7" />
                  <Text style={styles.sectionTitle}>Số tiền từ cao đến thấp</Text>
                </View>

                <View style={styles.rankListContainer}>
                  {rankedExpenses.map((item, idx) => {
                    const rankNum = String(idx + 1).padStart(2, '0');
                    return (
                      <View key={item.id} style={styles.rankCard}>
                        <View style={styles.rankNumberBadge}>
                          <Text style={styles.rankNumberText}>{rankNum}</Text>
                        </View>

                        <View style={styles.rankContent}>
                          <View style={styles.rankTopRow}>
                            <Text style={styles.rankTitle}>{item.title}</Text>
                            <Text style={styles.rankAmount}>
                              {formatCurrency(item.amount)}
                            </Text>
                          </View>

                          <View style={styles.rankBottomRow}>
                            <Text style={styles.rankSubText}>
                              {item.categoryName} • {item.date}
                            </Text>
                            <Text style={styles.rankMethodText}>
                              {item.paymentMethod === 'qr'
                                ? 'Tài khoản / QR'
                                : 'Tiền mặt'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* SUB-VIEW 2B: XẾP HẠNG DANH MỤC & TỶ TRỌNG (IMAGE 2 - RIGHT) */}
            {viewMode === 'rank_category' && (
              <View>
                {/* Card Tỷ Trọng Chi Tiêu */}
                <View style={styles.proportionCard}>
                  <View style={styles.proportionHeader}>
                    <Text style={styles.proportionTitle}>Tỷ trọng chi tiêu</Text>
                    <Text style={styles.proportion100}>100%</Text>
                  </View>

                  {/* Multi-segment Bar */}
                  <View style={styles.segmentedBar}>
                    {rankedCategories.map((cat) => (
                      <View
                        key={cat.id}
                        style={{
                          flex: cat.percent,
                          height: '100%',
                          backgroundColor: cat.color,
                        }}
                      />
                    ))}
                  </View>

                  <Text style={styles.proportionFootnote}>
                    Mua sắm chiếm nhiều nhất: 40% tổng chi trong kỳ.
                  </Text>
                </View>

                {/* Section Header: Tổng chi từ cao đến thấp */}
                <View style={styles.sectionHeaderRow}>
                  <ArrowUpDown size={14} color="#0284C7" />
                  <Text style={styles.sectionTitle}>Tổng chi từ cao đến thấp</Text>
                </View>

                <View style={styles.categoryRankContainer}>
                  {rankedCategories.map((cat) => {
                    const IconComp = cat.icon;
                    return (
                      <View key={cat.id} style={styles.catRankCard}>
                        <View style={styles.catRankLeft}>
                          <Text style={styles.catRankIndex}>{cat.id}</Text>
                          <View style={styles.catRankIcon}>
                            <IconComp size={16} color="#0F172A" />
                          </View>
                          <View>
                            <Text style={styles.catRankName}>{cat.name}</Text>
                            <Text style={styles.catRankTxCount}>
                              {cat.txCount} giao dịch
                            </Text>
                          </View>
                        </View>

                        <View style={styles.catRankRight}>
                          <Text style={styles.catRankAmount}>
                            {formatCurrency(cat.amount)}
                          </Text>
                          <Text style={styles.catRankPercent}>
                            {cat.percent}%
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
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
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, styles.navIconCircleActive]}>
              <BarChart2 size={20} color="#0F172A" />
            </View>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Biểu đồ</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E0F2FE', // Nền xanh cyan pastel chuẩn Figma
  },
  scrollContainer: {
    paddingHorizontal: 20,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  datePickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  periodLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  periodAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  periodAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  periodCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  addExpenseAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addExpenseText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  rankAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateGroupContainer: {
    marginBottom: 14,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  groupDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  groupSubtotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  expenseCardsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  expenseSubText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  expenseTagText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#BAE6FD',
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
  },
  tabSwitcherBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSwitcherBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tabSwitcherText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tabSwitcherTextActive: {
    color: '#0284C7',
  },
  backToListLink: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  backToListText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  rankListContainer: {
    gap: 8,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  rankNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumberText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0284C7',
  },
  rankContent: {
    flex: 1,
  },
  rankTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rankTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  rankAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  rankBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankSubText: {
    fontSize: 10,
    color: '#64748B',
  },
  rankMethodText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  proportionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  proportionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proportionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  proportion100: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  segmentedBar: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  proportionFootnote: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  categoryRankContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  catRankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  catRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catRankIndex: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    width: 14,
  },
  catRankIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRankName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  catRankTxCount: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  catRankRight: {
    alignItems: 'flex-end',
  },
  catRankAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  catRankPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
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
