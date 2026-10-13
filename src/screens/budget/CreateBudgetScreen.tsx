import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Utensils,
  ShoppingBag,
  Car,
  Film,
  ArrowRight,
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
  Check,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Props {
  onBackToFinance?: () => void;
  onOpenAddModal?: () => void;
}

type CategoryType = 'food' | 'shopping' | 'transport' | 'entertainment';

export default function CreateBudgetScreen({ onBackToFinance, onOpenAddModal }: Props) {
  // State quản lý việc đã kích hoạt ngân sách thành công hay chưa
  const [isSuccess, setIsSuccess] = useState(false);

  // Form states
  const [amountStr, setAmountStr] = useState('3.500.000');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('food');
  const [budgetName, setBudgetName] = useState('Ngân sách ăn trưa văn phòng');
  const [alertEnabled, setAlertEnabled] = useState(true);

  // Tab điều hướng dưới cùng
  const [activeTab, setActiveTab] = useState<'finance' | 'add' | 'save' | 'chart' | 'settings'>('save');

  const categories = [
    { id: 'food' as CategoryType, name: 'Ăn uống', icon: Utensils },
    { id: 'shopping' as CategoryType, name: 'Mua sắm', icon: ShoppingBag },
    { id: 'transport' as CategoryType, name: 'Di chuyển', icon: Car },
    { id: 'entertainment' as CategoryType, name: 'Giải trí', icon: Film },
  ];

  const getCategoryName = (cat: CategoryType) => {
    switch (cat) {
      case 'food':
        return 'Ăn uống';
      case 'shopping':
        return 'Mua sắm';
      case 'transport':
        return 'Di chuyển';
      case 'entertainment':
        return 'Giải trí';
      default:
        return 'Ăn uống';
    }
  };

  const handleActivate = () => {
    Keyboard.dismiss();
    setIsSuccess(true);
  };

  const handleEdit = () => {
    setIsSuccess(false);
  };

  const handleConfirm = () => {
    if (onBackToFinance) {
      onBackToFinance();
    } else {
      setIsSuccess(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Header chung: Tiêu đề "Tạo ngân sách" và Icon Chuông */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Tạo ngân sách</Text>
              <TouchableOpacity
                style={styles.bellBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Bell size={26} color="#0284C7" strokeWidth={2} />
                <View style={styles.bellDot} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!isSuccess ? (
                /* ══════════════════════════════════════════════════════════════
                   TRẠNG THÁI 1: FORM TẠO NGÂN SÁCH (ẢNH 1 MOCKUP)
                   ══════════════════════════════════════════════════════════════ */
                <View style={styles.formContainer}>
                  {/* Card 1: Hạn mức ngân sách mong muốn */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Hạn mức ngân sách mong muốn</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.currencySymbol}>đ</Text>
                      <TextInput
                        style={styles.amountTextInput}
                        value={amountStr}
                        onChangeText={(t) => {
                          const num = t.replace(/[^0-9]/g, '');
                          if (!num) {
                            setAmountStr('0');
                          } else {
                            setAmountStr(Number(num).toLocaleString('vi-VN'));
                          }
                        }}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                      <View style={styles.cursorBar} />
                    </View>
                  </View>

                  {/* Card 2: Chọn danh mục áp dụng */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Chọn danh mục áp dụng</Text>
                    <View style={styles.categoriesGrid}>
                      {categories.map((cat) => {
                        const IconComp = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.categoryItem,
                              isSelected && styles.categoryItemSelected,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setSelectedCategory(cat.id)}
                          >
                            <IconComp
                              size={20}
                              color={isSelected ? '#0284C7' : '#0F172A'}
                              strokeWidth={2}
                            />
                            <Text
                              style={[
                                styles.categoryText,
                                isSelected && styles.categoryTextSelected,
                              ]}
                            >
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Card 3: Tên ngân sách & Cảnh báo 80% */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Tên ngân sách (Tùy chọn)</Text>
                    <TextInput
                      style={styles.budgetInput}
                      value={budgetName}
                      onChangeText={setBudgetName}
                      placeholder="Nhập tên ngân sách..."
                      placeholderTextColor="#94A3B8"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    {/* Hàng Cảnh báo khi đạt 80% */}
                    <View style={styles.alertRow}>
                      <View style={styles.alertLeft}>
                        <Bell size={18} color="#0F172A" />
                        <Text style={styles.alertText}>Cảnh báo khi đạt 80%</Text>
                      </View>
                      <Switch
                        value={alertEnabled}
                        onValueChange={setAlertEnabled}
                        trackColor={{ false: '#CBD5E1', true: '#0284C7' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#CBD5E1"
                      />
                    </View>
                  </View>

                  {/* Nút Kích hoạt ngân sách ➔ */}
                  <TouchableOpacity
                    style={styles.activateBtn}
                    activeOpacity={0.85}
                    onPress={handleActivate}
                  >
                    <Text style={styles.activateBtnText}>Kích hoạt ngân sách</Text>
                    <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ) : (
                /* ══════════════════════════════════════════════════════════════
                   TRẠNG THÁI 2: TẠO NGÂN SÁCH THÀNH CÔNG! (ẢNH 2 MOCKUP)
                   ══════════════════════════════════════════════════════════════ */
                <View style={styles.successContainer}>
                  <View style={styles.successCard}>
                    <Text style={styles.successTitle}>Tạo ngân sách thành công!</Text>

                    {/* Box Số tiền ngân sách */}
                    <View style={styles.successBox}>
                      <Text style={styles.successBoxLabel}>Số tiền cho ngân sách:</Text>
                      <Text style={styles.successAmount}>{amountStr || '4.000.000'}đ</Text>
                    </View>

                    {/* Box Danh mục áp dụng */}
                    <View style={styles.successBox}>
                      <Text style={styles.successCategoryText}>
                        Áp dụng cho danh mục{' '}
                        <Text style={styles.highlightRedCategory}>
                          {getCategoryName(selectedCategory)}
                        </Text>
                      </Text>
                    </View>

                    {/* Hàng 2 Nút: Xác nhận & Chỉnh sửa */}
                    <View style={styles.successActionsRow}>
                      <TouchableOpacity
                        style={styles.pillButton}
                        activeOpacity={0.8}
                        onPress={handleConfirm}
                      >
                        <Text style={styles.pillButtonText}>Xác nhận</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.pillButton}
                        activeOpacity={0.8}
                        onPress={handleEdit}
                      >
                        <Text style={styles.pillButtonText}>Chỉnh sửa</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Thanh Floating Bottom Navigation chuẩn thiết kế */}
            <View style={styles.bottomNavContainer}>
              <View style={styles.bottomNavBar}>
                {/* 1. Tài chính */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => {
                    if (onBackToFinance) onBackToFinance();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.navIconCircle}>
                    <Wallet size={22} color="#64748B" />
                  </View>
                  <Text style={styles.navLabel}>Tài chính</Text>
                </TouchableOpacity>

                {/* 2. Thêm */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => {
                    if (onOpenAddModal) onOpenAddModal();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.navIconCircle}>
                    <Plus size={22} color="#64748B" />
                  </View>
                  <Text style={styles.navLabel}>Thêm</Text>
                </TouchableOpacity>

                {/* 3. Lưu (Active khi đang ở màn hình ngân sách) */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => setActiveTab('save')}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.navIconCircle,
                      activeTab === 'save' && styles.navIconCircleActive,
                    ]}
                  >
                    <Bookmark
                      size={22}
                      color={activeTab === 'save' ? '#0F172A' : '#64748B'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.navLabel,
                      activeTab === 'save' && styles.navLabelActive,
                    ]}
                  >
                    Lưu
                  </Text>
                </TouchableOpacity>

                {/* 4. Biểu đồ */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => {
                    if (onBackToFinance) onBackToFinance();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.navIconCircle}>
                    <BarChart2 size={22} color="#64748B" />
                  </View>
                  <Text style={styles.navLabel}>Biểu đồ</Text>
                </TouchableOpacity>

                {/* 5. Cài đặt */}
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={() => {
                    if (onBackToFinance) onBackToFinance();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.navIconCircle}>
                    <Settings size={22} color="#64748B" />
                  </View>
                  <Text style={styles.navLabel}>Cài đặt</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#BAE6FD', // Nền xanh pastel chuẩn toàn app
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 4 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  bellDot: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    paddingTop: 4,
  },
  formContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textDecorationLine: 'underline',
    marginRight: 8,
  },
  amountTextInput: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    paddingVertical: 0,
    minWidth: 150,
  },
  cursorBar: {
    width: 2.5,
    height: 30,
    backgroundColor: '#0284C7',
    marginLeft: 6,
    borderRadius: 1.5,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryItem: {
    width: (width - 32 - 40 - 12) / 2, // 2 cột đều nhau
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  categoryItemSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoryTextSelected: {
    color: '#0284C7',
  },
  budgetInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    marginBottom: 16,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activateBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    marginTop: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  activateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  /* ─── Styles cho Trạng thái Thành Công ─── */
  successContainer: {
    paddingTop: 10,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 32,
    textAlign: 'center',
  },
  successBox: {
    width: '100%',
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  successBoxLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  successAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
  },
  successCategoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  highlightRedCategory: {
    color: '#DC2626',
    fontWeight: '800',
  },
  successActionsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 28,
  },
  pillButton: {
    width: 135,
    height: 44,
    backgroundColor: '#D8F1FE',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  pillButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },

  /* ─── Bottom Navigation ─── */
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
