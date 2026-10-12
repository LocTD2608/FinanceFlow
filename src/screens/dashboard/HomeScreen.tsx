import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { THEME } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import AddTransactionModal from './AddTransactionModal';
import {
  ArrowDownLeft,
  ArrowUpRight,
  LogOut,
  Wallet,
  PieChart,
  Home,
  PlusCircle,
  User as UserIcon,
  Clock,
  TrendingUp,
} from 'lucide-react-native';

interface Props {
  onLogout: () => void;
}

export default function HomeScreen({ onLogout }: Props) {
  const { user, token, logout } = useAuthStore();
  const { transactions, summary, isLoading, fetchTransactions, fetchSummary } = useTransactionStore();

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSummary(token || undefined);
    fetchTransactions(token || undefined);
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchSummary(token || undefined),
      fetchTransactions(token || undefined),
    ]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const formatVND = (num: number) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  };

  // Tính số dư hiển thị: 10.000.000đ base + dòng tiền ròng
  const baseBalance = 10000000;
  const currentBalance = baseBalance + summary.netCashFlow;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào,</Text>
          <Text style={styles.username}>{user?.username || 'Hoàng Nam'} 👋</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />}
      >
        {/* Thẻ Tổng quan Số dư chuẩn Figma */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
          <Text style={styles.balanceValue}>{formatVND(currentBalance)}</Text>

          <View style={styles.cashFlowRow}>
            {/* Tiền vào (Thu nhập) */}
            <View style={styles.cashFlowItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                <ArrowDownLeft size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.cashFlowSub}>Tiền vào</Text>
                <Text style={[styles.cashFlowAmount, { color: '#16A34A' }]}>
                  +{formatVND(summary.totalIncome)}
                </Text>
              </View>
            </View>

            {/* Tiền ra (Chi tiêu) */}
            <View style={styles.cashFlowItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <ArrowUpRight size={18} color="#DC2626" />
              </View>
              <View>
                <Text style={styles.cashFlowSub}>Tiền ra</Text>
                <Text style={[styles.cashFlowAmount, { color: '#DC2626' }]}>
                  -{formatVND(summary.totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nút bấm Tạo giao dịch nhanh */}
        <TouchableOpacity
          style={styles.quickAddBanner}
          onPress={() => setIsAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.quickAddIcon}>
            <TrendingUp size={20} color="#0284C7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickAddTitle}>Ghi chép giao dịch tức thì</Text>
            <Text style={styles.quickAddSubtitle}>Tự động tính toán & cập nhật số dư ví ngay</Text>
          </View>
          <Text style={styles.quickAddPlus}>+ Thêm</Text>
        </TouchableOpacity>

        {/* Danh sách Giao dịch gần đây */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
          <Text style={styles.sectionCount}>{transactions.length} giao dịch</Text>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Clock size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Chưa có giao dịch nào</Text>
            <Text style={styles.emptyDesc}>Bấm nút "+" để thêm giao dịch thu hoặc chi đầu tiên của bạn!</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {transactions.slice(0, 10).map((tx) => {
              const isIncome = tx.type === 'income';
              const dateText = tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('vi-VN') : '';
              return (
                <View key={tx._id || tx.id} style={styles.txItem}>
                  <View
                    style={[
                      styles.txIconCircle,
                      { backgroundColor: isIncome ? '#DCFCE7' : '#FEE2E2' },
                    ]}
                  >
                    {isIncome ? (
                      <ArrowDownLeft size={18} color="#16A34A" />
                    ) : (
                      <ArrowUpRight size={18} color="#DC2626" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{tx.note || (isIncome ? 'Thu nhập' : 'Chi tiêu')}</Text>
                    <Text style={styles.txDate}>{dateText}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isIncome ? '#16A34A' : '#DC2626' },
                    ]}
                  >
                    {isIncome ? '+' : '-'}{formatVND(tx.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Thêm Giao Dịch */}
      <AddTransactionModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSuccess={() => {
          fetchSummary(token || undefined);
          fetchTransactions(token || undefined);
        }}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Home size={22} color="#0284C7" />
          <Text style={[styles.tabLabel, { color: '#0284C7' }]}>Trang chủ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Wallet size={22} color="#94A3B8" />
          <Text style={styles.tabLabel}>Ví tiền</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerAddBtn} onPress={() => setIsAddModalVisible(true)} activeOpacity={0.8}>
          <PlusCircle size={32} color="#BAE6FD" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <PieChart size={22} color="#94A3B8" />
          <Text style={styles.tabLabel}>Ngân sách</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <UserIcon size={22} color="#94A3B8" />
          <Text style={styles.tabLabel}>Hồ sơ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  balanceCard: {
    backgroundColor: '#BAE6FD',
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    ...THEME.shadow,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#0369A1',
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0C4A6E',
    marginBottom: 20,
  },
  cashFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  cashFlowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashFlowSub: {
    fontSize: 12,
    color: '#64748B',
  },
  cashFlowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickAddBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...THEME.shadow,
  },
  quickAddIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickAddSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  quickAddPlus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  txList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  txDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  bottomBar: {
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    color: '#94A3B8',
    fontWeight: '600',
  },
  centerAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...THEME.shadow,
  },
});
