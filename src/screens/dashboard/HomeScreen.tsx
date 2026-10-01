import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { THEME } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { ArrowDownLeft, ArrowUpRight, LogOut, Wallet, PieChart, Home, PlusCircle, User as UserIcon } from 'lucide-react-native';

interface Props {
  onLogout: () => void;
}

export default function HomeScreen({ onLogout }: Props) {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Thẻ Tổng quan Số dư chuẩn Figma */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
          <Text style={styles.balanceValue}>12.450.000 đ</Text>

          <View style={styles.cashFlowRow}>
            {/* Tiền vào */}
            <View style={styles.cashFlowItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                <ArrowDownLeft size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.cashFlowSub}>Tiền vào</Text>
                <Text style={[styles.cashFlowAmount, { color: '#16A34A' }]}>+3.150.000 đ</Text>
              </View>
            </View>

            {/* Tiền ra */}
            <View style={styles.cashFlowItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <ArrowUpRight size={18} color="#DC2626" />
              </View>
              <View>
                <Text style={styles.cashFlowSub}>Tiền ra</Text>
                <Text style={[styles.cashFlowAmount, { color: '#DC2626' }]}>-18.500.000 đ</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Thông báo sẵn sàng kết nối */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoTitle}>🎉 Đăng nhập thành công</Text>
          <Text style={styles.infoDesc}>Bạn đang ở Trang chính (Dashboard). Tiếp theo chúng ta sẽ hoàn thiện biểu đồ Donut và chức năng Tạo Ngân Sách theo bản vẽ Figma!</Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation chuẩn Figma */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Home size={22} color="#0284C7" />
          <Text style={[styles.tabLabel, { color: '#0284C7' }]}>Trang chủ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Wallet size={22} color="#94A3B8" />
          <Text style={styles.tabLabel}>Ví tiền</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.centerAddBtn}>
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
  },
  balanceCard: {
    backgroundColor: '#BAE6FD',
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
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
  infoBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
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
