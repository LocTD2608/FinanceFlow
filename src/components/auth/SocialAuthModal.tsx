import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { THEME } from '../../constants/theme';
import { SocialLoginPayload } from '../../api/auth';
import { GoogleIcon, AppleIcon, FacebookIcon } from './SocialIcons';

interface Props {
  visible: boolean;
  provider: 'google' | 'apple' | 'facebook' | null;
  loading: boolean;
  onClose: () => void;
  onSelectAccount: (payload: SocialLoginPayload) => void;
}

export function SocialAuthModal({ visible, provider, loading, onClose, onSelectAccount }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!provider) return null;

  const getProviderInfo = () => {
    switch (provider) {
      case 'google':
        return {
          title: 'Đăng nhập bằng Google',
          sub: 'Google Identity Services (OAuth 2.0)',
          color: '#4285F4',
          icon: <GoogleIcon size={26} />,
          samples: [
            {
              name: 'Nguyễn Văn An',
              email: 'an.nguyen.google@gmail.com',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
              oauthId: 'g_sub_1092837419',
            },
            {
              name: 'Trần Minh Quang',
              email: 'quang.tran.dev@gmail.com',
              avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&q=80',
              oauthId: 'g_sub_2847192847',
            },
          ],
        };
      case 'apple':
        return {
          title: 'Sign in with Apple',
          sub: 'Apple ID Authentication (iOS & Web)',
          color: '#000000',
          icon: <AppleIcon size={26} color="#FFFFFF" />,
          samples: [
            {
              name: 'Trần Thị Mai',
              email: 'tran.thi.mai@icloud.com',
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
              oauthId: 'apple_sub_9928172635',
            },
            {
              name: 'Apple User (Ẩn email)',
              email: 'user.private89f@privaterelay.appleid.com',
              avatar: null,
              oauthId: 'apple_sub_privaterelay_89f',
            },
          ],
        };
      case 'facebook':
        return {
          title: 'Đăng nhập bằng Facebook',
          sub: 'Meta Login for Developers',
          color: '#1877F2',
          icon: <FacebookIcon size={26} color="#FFFFFF" />,
          samples: [
            {
              name: 'Lê Hoàng Long',
              email: 'long.le.fb@facebook.com',
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
              oauthId: 'fb_id_8172635489',
            },
            {
              name: 'Phạm Thu Thảo',
              email: 'thao.pham.fb@facebook.com',
              avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
              oauthId: 'fb_id_9988776655',
            },
          ],
        };
    }
  };

  const info = getProviderInfo();

  const handleCustomSubmit = () => {
    setValidationError('');
    if (!customEmail.trim() || !customEmail.includes('@')) {
      setValidationError('Vui lòng nhập định dạng email hợp lệ.');
      return;
    }
    onSelectAccount({
      provider,
      oauthId: `${provider}_custom_${Date.now()}`,
      email: customEmail.trim(),
      username: customName.trim() || customEmail.split('@')[0],
      avatar: undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={[styles.headerBadge, { backgroundColor: info.color }]}>
            {info.icon}
            <Text style={styles.headerBadgeText}>{info.title}</Text>
          </View>

          <Text style={styles.subTitle}>{info.sub}</Text>
          <Text style={styles.note}>
            ⚡ Chế độ kiểm thử nhanh: Chọn tài khoản đại diện để đăng nhập và kết nối thẳng tới Cloud MongoDB Atlas:
          </Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
              <Text style={styles.loadingText}>Đang xác thực với {info.title}...</Text>
            </View>
          ) : customMode ? (
            <View style={styles.customForm}>
              <Text style={styles.formLabel}>Tên hiển thị:</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ví dụ: Nguyễn Văn Tester"
                placeholderTextColor="#94A3B8"
                value={customName}
                onChangeText={setCustomName}
              />

              <Text style={styles.formLabel}>Email tài khoản:</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ví dụ: tester.demo@gmail.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={customEmail}
                onChangeText={setCustomEmail}
              />

              {validationError ? <Text style={styles.errText}>{validationError}</Text> : null}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleCustomSubmit} activeOpacity={0.8}>
                <Text style={styles.primaryBtnText}>Đăng nhập ngay</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.textBtn} onPress={() => setCustomMode(false)}>
                <Text style={styles.textBtnTitle}>← Quay lại danh sách mẫu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {info.samples.map((acc, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.accountItem}
                  activeOpacity={0.7}
                  onPress={() =>
                    onSelectAccount({
                      provider,
                      oauthId: acc.oauthId,
                      email: acc.email,
                      username: acc.name,
                      avatar: acc.avatar || undefined,
                    })
                  }
                >
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{acc.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.accName}>{acc.name}</Text>
                    <Text style={styles.accEmail}>{acc.email}</Text>
                  </View>
                  <Text style={styles.arrowIcon}>→</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.customToggleBtn}
                onPress={() => setCustomMode(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.customToggleText}>✏️ Nhập tài khoản tùy chỉnh khác...</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Nút Đóng */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>Hủy bỏ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  subTitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 17,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  accName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  accEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
  },
  customToggleBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  customToggleText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  customForm: {
    paddingVertical: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  errText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.primary,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: THEME.colors.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  textBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  textBtnTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
});
