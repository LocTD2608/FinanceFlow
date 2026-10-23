import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Edit3,
  Mail,
  Phone,
  Camera,
  Check,
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
} from 'lucide-react-native';

interface Props {
  onBack?: () => void;
  onLogout?: () => void;
  onNavigateToTab?: (tab: 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings') => void;
}

export default function ProfileScreen({
  onBack,
  onLogout,
  onNavigateToTab,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('HOANG NGOC LIEN');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      Alert.alert('Lỗi', 'Họ và tên không được để trống.');
      return;
    }
    setIsEditing(false);
    Alert.alert('Thành công', 'Đã lưu thay đổi thông tin cá nhân!');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isEditing) {
                setIsEditing(false);
              } else if (onBack) {
                onBack();
              }
            }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Chỉnh sửa hồ sơ' : 'Hồ sơ cá nhân'}
          </Text>
        </View>

        {/* ════════════════════════════════════════════════════════════════
            MÀN HÌNH 3A: HỒ SƠ CÁ NHÂN (VIEW MODE)
        ════════════════════════════════════════════════════════════════ */}
        {!isEditing ? (
          <View>
            {/* Avatar & Name Card */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>HL</Text>
              </View>

              <Text style={styles.profileName}>{fullName}</Text>
              <Text style={styles.profileRole}>Tài khoản cá nhân</Text>

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.8}
              >
                <Edit3 size={16} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Chỉnh sửa thông tin</Text>
              </TouchableOpacity>
            </View>

            {/* Thẻ 1: Thông tin liên hệ */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeading}>Thông tin liên hệ</Text>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Mail size={18} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>
                    {email.trim() ? email : 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Phone size={18} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>
                    {phone.trim() ? phone : 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Thẻ 2: Thông tin tài khoản */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeading}>Thông tin tài khoản</Text>

              <View style={styles.propRow}>
                <Text style={styles.propLabel}>Loại tài khoản</Text>
                <Text style={styles.propValue}>Cá nhân</Text>
              </View>

              <View style={styles.propRow}>
                <Text style={styles.propLabel}>Ngôn ngữ</Text>
                <Text style={styles.propValue}>Tiếng Việt</Text>
              </View>

              <View style={styles.propRow}>
                <Text style={styles.propLabel}>Đơn vị tiền tệ</Text>
                <Text style={styles.propValue}>VND • Việt Nam đồng</Text>
              </View>
            </View>

            {/* Nút Đăng xuất */}
            {onLogout && (
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={onLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.logoutBtnText}>Đăng xuất tài khoản</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* ════════════════════════════════════════════════════════════════
             MÀN HÌNH 3B: CHỈNH SỬA HỒ SƠ (EDIT MODE)
          ════════════════════════════════════════════════════════════════ */
          <View>
            {/* Avatar Edit Card */}
            <View style={styles.avatarEditCard}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarCircleSmall}>
                  <Text style={styles.avatarTextSmall}>HL</Text>
                </View>

                <TouchableOpacity
                  style={styles.changeAvatarBtn}
                  onPress={() => Alert.alert('Ảnh đại diện', 'Tính năng chọn ảnh từ thư viện.')}
                  activeOpacity={0.7}
                >
                  <Camera size={16} color="#0284C7" />
                  <Text style={styles.changeAvatarText}>Thay ảnh đại diện</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.avatarFootnote}>
                Chưa cập nhật ảnh đại diện.
              </Text>
            </View>

            {/* Form Thông tin cá nhân */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeading}>Thông tin cá nhân</Text>

              {/* Họ và tên */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Họ và tên *</Text>
                <TextInput
                  style={styles.textInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nhập họ và tên..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Nhập địa chỉ email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Số điện thoại */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.inputFootnote}>
                * Thông tin bắt buộc. Email và số điện thoại hiện chưa được cập nhật.
              </Text>
            </View>

            {/* Nút Lưu thay đổi */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveProfile}
              activeOpacity={0.8}
            >
              <Check size={18} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
            </TouchableOpacity>

            {/* Link Hủy */}
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => setIsEditing(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelLinkText}>Hủy</Text>
            </TouchableOpacity>
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
            onPress={() => setIsEditing(false)}
            activeOpacity={0.7}
          >
            <View style={[styles.navIconCircle, styles.navIconCircleActive]}>
              <Settings size={20} color="#0F172A" />
              {/* Blue dot indicator for Cài đặt */}
              <View style={styles.activeDot} />
            </View>
            <Text style={[styles.navLabel, styles.navLabelActive]}>Cài đặt</Text>
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
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0284C7',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0084FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  infoCard: {
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
  cardHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  propLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  propValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  avatarEditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  avatarCircleSmall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284C7',
  },
  changeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  avatarFootnote: {
    fontSize: 11,
    color: '#64748B',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputFootnote: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 14,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0084FF',
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: '#0084FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
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
    position: 'relative',
  },
  navIconCircleActive: {
    backgroundColor: '#BAE6FD',
  },
  activeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
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
