import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Users,
  Layers,
  BarChart3,
  Smartphone,
  LogOut,
  Search,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  RefreshCw,
  Tag,
  DollarSign,
  TrendingUp,
  Receipt,
  Utensils,
  Car,
  ShoppingBag,
  Gift,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { adminApi, AdminMetrics, SystemCategory } from '../../api/admin';
import { User } from '../../api/auth';

interface AdminPortalProps {
  onLogout: () => void;
}

type TabType = 'metrics' | 'users' | 'categories';

const PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#0284C7', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'];
const AVAILABLE_ICONS = ['utensils', 'car', 'shopping-bag', 'receipt', 'dollar-sign', 'gift', 'trending-up', 'tag'];

export default function AdminPortalScreen({ onLogout }: AdminPortalProps) {
  const { user: currentUser, token, setActiveMode, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('metrics');

  // Metrics State
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  // Categories State
  const [categories, setCategories] = useState<SystemCategory[]>([]);
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('tag');
  const [newCatColor, setNewCatColor] = useState('#0284C7');

  // 1. Fetch Metrics
  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await adminApi.getMetrics(token);
      if (res.success && res.metrics) {
        setMetrics(res.metrics);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tải thống kê.');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [token]);

  // 2. Fetch Users
  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await adminApi.getUsers(token, {
        search: searchQuery,
        status: statusFilter,
        role: roleFilter,
      });
      if (res.success) {
        setUsers(res.users);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token, searchQuery, statusFilter, roleFilter]);

  // 3. Fetch Categories
  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const res = await adminApi.getCategories(token);
      if (res.success) {
        setCategories(res.categories);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tải danh mục.');
    } finally {
      setIsLoadingCategories(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'metrics') loadMetrics();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'categories') loadCategories();
  }, [activeTab, loadMetrics, loadUsers, loadCategories]);

  // Toggle user lock/unlock status
  const handleToggleStatus = (targetUser: User) => {
    const isSelf = targetUser.id === currentUser?.id;
    if (isSelf) {
      Alert.alert('Cảnh báo an toàn', 'Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }
    const newStatus = targetUser.status === 'locked' ? 'active' : 'locked';
    const actionText = newStatus === 'locked' ? 'khóa' : 'mở khóa';

    Alert.alert(
      'Xác nhận thao tác',
      `Bạn có chắc chắn muốn ${actionText} tài khoản "${targetUser.username || targetUser.email}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý',
          style: newStatus === 'locked' ? 'destructive' : 'default',
          onPress: async () => {
            const res = await adminApi.updateUserStatus(token, targetUser.id, newStatus);
            if (res.success) {
              Alert.alert('Thành công', res.message);
              loadUsers();
              loadMetrics();
            } else {
              Alert.alert('Thất bại', res.message);
            }
          },
        },
      ]
    );
  };

  // Toggle user role between user and admin
  const handleToggleRole = (targetUser: User) => {
    const isSelf = targetUser.id === currentUser?.id;
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';

    if (isSelf && newRole === 'user') {
      Alert.alert('Cảnh báo an toàn', 'Bạn không thể tự tước quyền Quản trị viên của chính mình.');
      return;
    }

    const actionText = newRole === 'admin' ? 'nâng cấp thành Quản trị viên' : 'hạ quyền xuống Người dùng';

    Alert.alert(
      'Xác nhận phân quyền',
      `Bạn có muốn ${actionText} cho "${targetUser.username || targetUser.email}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            const res = await adminApi.updateUserRole(token, targetUser.id, newRole);
            if (res.success) {
              Alert.alert('Thành công', res.message);
              loadUsers();
              loadMetrics();
            } else {
              Alert.alert('Thất bại', res.message);
            }
          },
        },
      ]
    );
  };

  // Add default system category
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên danh mục.');
      return;
    }
    const res = await adminApi.createCategory(token, {
      name: newCatName.trim(),
      type: categoryType,
      icon: newCatIcon,
      color: newCatColor,
    });
    if (res.success) {
      Alert.alert('Thành công', res.message);
      setShowAddCategoryModal(false);
      setNewCatName('');
      loadCategories();
    } else {
      Alert.alert('Lỗi', res.message);
    }
  };

  // Delete system category
  const handleDeleteCategory = (cat: SystemCategory) => {
    Alert.alert('Xác nhận xóa', `Xóa danh mục mặc định "${cat.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const res = await adminApi.deleteCategory(token, cat._id);
          if (res.success) {
            Alert.alert('Thành công', res.message);
            loadCategories();
          } else {
            Alert.alert('Lỗi', res.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header & Dual-Mode Controls */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.adminBadge}>
            <ShieldCheck size={16} color="#FFFFFF" />
            <Text style={styles.adminBadgeText}>Admin Portal</Text>
          </View>
          <Text style={styles.headerTitle}>Hệ Thống Quản Trị</Text>
          <Text style={styles.headerSub}>
            Xin chào, <Text style={styles.adminName}>{currentUser?.username || 'Admin'}</Text>
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Dual-Mode Switcher */}
          <TouchableOpacity
            style={styles.modeSwitchBtn}
            activeOpacity={0.8}
            onPress={() => setActiveMode('user')}
          >
            <Smartphone size={16} color="#0284C7" />
            <Text style={styles.modeSwitchText}>Chế độ User</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.8}
            onPress={async () => {
              await logout();
              onLogout();
            }}
          >
            <LogOut size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'metrics' && styles.tabItemActive]}
          onPress={() => setActiveTab('metrics')}
        >
          <BarChart3 size={18} color={activeTab === 'metrics' ? '#0284C7' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'metrics' && styles.tabTextActive]}>Thống kê</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'users' && styles.tabItemActive]}
          onPress={() => setActiveTab('users')}
        >
          <Users size={18} color={activeTab === 'users' ? '#0284C7' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Người dùng</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'categories' && styles.tabItemActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Layers size={18} color={activeTab === 'categories' ? '#0284C7' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>Danh mục</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Tab Content */}
      <View style={styles.content}>
        {/* TAB 1: METRICS */}
        {activeTab === 'metrics' && (
          <ScrollView contentContainerStyle={styles.tabScroll}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Chỉ số Hệ thống (Overview)</Text>
              <TouchableOpacity onPress={loadMetrics} style={styles.refreshBtn}>
                <RefreshCw size={16} color="#0284C7" />
              </TouchableOpacity>
            </View>

            {isLoadingMetrics ? (
              <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
            ) : metrics ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { borderLeftColor: '#0284C7' }]}>
                    <Text style={styles.metricLabel}>Tổng Người Dùng</Text>
                    <Text style={styles.metricValue}>{metrics.totalUsers}</Text>
                    <Text style={styles.metricSub}>Tài khoản đăng ký</Text>
                  </View>

                  <View style={[styles.metricCard, { borderLeftColor: '#10B981' }]}>
                    <Text style={styles.metricLabel}>Đang Hoạt Động</Text>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>{metrics.activeUsers}</Text>
                    <Text style={styles.metricSub}>Trạng thái Active</Text>
                  </View>

                  <View style={[styles.metricCard, { borderLeftColor: '#EF4444' }]}>
                    <Text style={styles.metricLabel}>Tài Khoản Bị Khóa</Text>
                    <Text style={[styles.metricValue, { color: '#EF4444' }]}>{metrics.lockedUsers}</Text>
                    <Text style={styles.metricSub}>Trạng thái Locked</Text>
                  </View>

                  <View style={[styles.metricCard, { borderLeftColor: '#7C3AED' }]}>
                    <Text style={styles.metricLabel}>Quản Trị Viên (Admin)</Text>
                    <Text style={[styles.metricValue, { color: '#7C3AED' }]}>{metrics.adminUsers}</Text>
                    <Text style={styles.metricSub}>Toàn quyền hệ thống</Text>
                  </View>
                </View>

                {/* Additional Stats */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>📊 Thông số Hoạt động</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tổng số giao dịch toàn sàn:</Text>
                    <Text style={styles.infoVal}>{metrics.totalTransactions} giao dịch</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Danh mục mẫu mặc định:</Text>
                    <Text style={styles.infoVal}>{metrics.totalDefaultCategories} danh mục</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tỷ lệ tài khoản hoạt động:</Text>
                    <Text style={styles.infoVal}>
                      {metrics.totalUsers > 0 ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 100}%
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <View style={{ flex: 1 }}>
            {/* Search and Filters */}
            <View style={styles.userFilterBox}>
              <View style={styles.searchBar}>
                <Search size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm theo email, tên, số điện thoại..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={loadUsers}
                />
              </View>

              <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.pill, statusFilter === 'all' && styles.pillActive]}
                    onPress={() => setStatusFilter('all')}
                  >
                    <Text style={[styles.pillText, statusFilter === 'all' && styles.pillTextActive]}>Tất cả</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, statusFilter === 'active' && styles.pillActive]}
                    onPress={() => setStatusFilter('active')}
                  >
                    <Text style={[styles.pillText, statusFilter === 'active' && styles.pillTextActive]}>Hoạt động</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, statusFilter === 'locked' && styles.pillActive]}
                    onPress={() => setStatusFilter('locked')}
                  >
                    <Text style={[styles.pillText, statusFilter === 'locked' && styles.pillTextActive]}>Đã khóa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, roleFilter === 'admin' && styles.pillActive]}
                    onPress={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
                  >
                    <Text style={[styles.pillText, roleFilter === 'admin' && styles.pillTextActive]}>Admin</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>

            {isLoadingUsers ? (
              <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={users}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                  const isCurrentAdmin = item.id === currentUser?.id;
                  const isLocked = item.status === 'locked';
                  const isAdmin = item.role === 'admin';

                  return (
                    <View style={styles.userCard}>
                      <View style={styles.userHeader}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>
                            {(item.username || item.email || 'U')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.userInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.userUsername}>{item.username || 'Không tên'}</Text>
                            {isCurrentAdmin && <Text style={styles.youBadge}>(Bạn)</Text>}
                          </View>
                          <Text style={styles.userEmail}>{item.email}</Text>
                          {item.phone ? <Text style={styles.userPhone}>📞 {item.phone}</Text> : null}
                        </View>

                        <View style={styles.badgeCol}>
                          <View style={[styles.roleBadge, isAdmin ? styles.roleAdmin : styles.roleUser]}>
                            <Text style={styles.roleText}>{isAdmin ? 'Admin' : 'User'}</Text>
                          </View>
                          <View style={[styles.statusBadge, isLocked ? styles.statusLocked : styles.statusActive]}>
                            <Text style={styles.statusText}>{isLocked ? 'Đã khóa' : 'Hoạt động'}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={styles.userActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, isLocked ? styles.actionUnlock : styles.actionLock, isCurrentAdmin && { opacity: 0.4 }]}
                          disabled={isCurrentAdmin}
                          onPress={() => handleToggleStatus(item)}
                        >
                          {isLocked ? <Unlock size={14} color="#10B981" /> : <Lock size={14} color="#EF4444" />}
                          <Text style={[styles.actionBtnText, { color: isLocked ? '#10B981' : '#EF4444' }]}>
                            {isLocked ? 'Mở khóa' : 'Khóa'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionRole, isCurrentAdmin && { opacity: 0.4 }]}
                          disabled={isCurrentAdmin}
                          onPress={() => handleToggleRole(item)}
                        >
                          {isAdmin ? <UserX size={14} color="#64748B" /> : <UserCheck size={14} color="#7C3AED" />}
                          <Text style={[styles.actionBtnText, { color: isAdmin ? '#64748B' : '#7C3AED' }]}>
                            {isAdmin ? 'Hạ xuống User' : 'Nâng thành Admin'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* TAB 3: CATEGORY MANAGEMENT */}
        {activeTab === 'categories' && (
          <View style={{ flex: 1 }}>
            <View style={styles.categorySubTabs}>
              <TouchableOpacity
                style={[styles.subTab, categoryType === 'expense' && styles.subTabActive]}
                onPress={() => setCategoryType('expense')}
              >
                <Text style={[styles.subTabText, categoryType === 'expense' && styles.subTabTextActive]}>
                  Chi tiêu (Expense)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTab, categoryType === 'income' && styles.subTabActive]}
                onPress={() => setCategoryType('income')}
              >
                <Text style={[styles.subTabText, categoryType === 'income' && styles.subTabTextActive]}>
                  Thu nhập (Income)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.catHeaderAction}>
              <Text style={styles.catCountText}>
                {categories.filter(c => c.type === categoryType).length} danh mục hệ thống mặc định
              </Text>
              <TouchableOpacity
                style={styles.addCatBtn}
                onPress={() => setShowAddCategoryModal(true)}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.addCatBtnText}>Thêm mới</Text>
              </TouchableOpacity>
            </View>

            {isLoadingCategories ? (
              <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={categories.filter(c => c.type === categoryType)}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View style={styles.catCard}>
                    <View style={[styles.catIconWrap, { backgroundColor: item.color + '20' }]}>
                      <Tag size={20} color={item.color} />
                    </View>
                    <View style={styles.catInfo}>
                      <Text style={styles.catName}>{item.name}</Text>
                      <Text style={styles.catDefaultBadge}>Mặc định hệ thống</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.catDeleteBtn}
                      onPress={() => handleDeleteCategory(item)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>

      {/* Modal Add Category */}
      <Modal visible={showAddCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Thêm Danh Mục Hệ Thống Mới</Text>
            <Text style={styles.modalSub}>Dành cho tất cả người dùng trong hệ thống</Text>

            <Text style={styles.inputLabel}>Tên danh mục:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ví dụ: Bảo hiểm, Quà tặng..."
              placeholderTextColor="#94A3B8"
              value={newCatName}
              onChangeText={setNewCatName}
            />

            <Text style={styles.inputLabel}>Chọn màu sắc:</Text>
            <View style={styles.paletteRow}>
              {PALETTE.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorCircle, { backgroundColor: color }, newCatColor === color && styles.colorSelected]}
                  onPress={() => setNewCatColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddCategoryModal(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateCategory}
              >
                <Text style={styles.modalConfirmText}>Thêm danh mục</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  adminBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  adminName: { color: '#38BDF8', fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  modeSwitchText: { color: '#0284C7', fontSize: 13, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    padding: 9,
    borderRadius: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0284C7',
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#0284C7', fontWeight: '700' },
  content: { flex: 1 },
  tabScroll: { padding: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  refreshBtn: { padding: 6 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  metricSub: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  infoBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 13, color: '#64748B' },
  infoVal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  userFilterBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  filterRow: { flexDirection: 'row' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#0284C7' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  pillTextActive: { color: '#FFFFFF' },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#0284C7' },
  userInfo: { flex: 1 },
  userUsername: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  youBadge: { fontSize: 11, color: '#0284C7', fontWeight: '700' },
  userEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  userPhone: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleAdmin: { backgroundColor: '#F3E8FF' },
  roleUser: { backgroundColor: '#E0F2FE' },
  roleText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusLocked: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  userActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionLock: { backgroundColor: '#FEF2F2' },
  actionUnlock: { backgroundColor: '#F0FDF4' },
  actionRole: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  categorySubTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: '#0284C7' },
  subTabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  subTabTextActive: { color: '#0284C7', fontWeight: '700' },
  catHeaderAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  catCountText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addCatBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  catIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  catDefaultBadge: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  catDeleteBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
