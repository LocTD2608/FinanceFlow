import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../../constants/theme';
import { authApi, SocialLoginPayload } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { SocialAuthModal } from '../../components/auth/SocialAuthModal';
import { GoogleIcon, AppleIcon, FacebookIcon } from '../../components/auth/SocialIcons';

interface Props {
  onNavigateToRegister: () => void;
  onLoginSuccess: (username: string) => void;
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Social Auth States
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'apple' | 'facebook' | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  const { setUser } = useAuthStore();

  const handleLogin = async () => {
    setErrorMsg('');
    if (!identifier.trim() || !password) {
      setErrorMsg('Vui lòng nhập email/SĐT và mật khẩu.');
      return;
    }

    setLoading(true);
    const res = await authApi.login(identifier.trim(), password);
    setLoading(false);

    if (res.success && res.user && res.token) {
      await setUser(res.user, res.token);
      onLoginSuccess(res.user.username);
    } else {
      setErrorMsg(res.message || 'Đăng nhập không thành công.');
    }
  };

  const handleOpenSocialModal = (provider: 'google' | 'apple' | 'facebook') => {
    setSelectedProvider(provider);
    setSocialModalVisible(true);
    setErrorMsg('');
  };

  const handleSocialSelect = async (payload: SocialLoginPayload) => {
    setSocialLoading(true);
    const res = await authApi.socialLogin(payload);
    setSocialLoading(false);
    setSocialModalVisible(false);

    if (res.success && res.user && res.token) {
      await setUser(res.user, res.token);
      onLoginSuccess(res.user.username);
    } else {
      setErrorMsg(res.message || 'Đăng nhập mạng xã hội thất bại.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <Text style={styles.headerTitle}>Đăng nhập</Text>

          {/* Form Card chuẩn theo khung bản vẽ Figma */}
          <View style={styles.card}>
            {/* Input Email hoặc SĐT */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email hoặc số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email hoặc số điện thoại..."
                placeholderTextColor="#94A3B8"
                value={identifier}
                onChangeText={(t) => { setIdentifier(t); setErrorMsg(''); }}
                autoCapitalize="none"
              />
            </View>

            {/* Input Mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập mật khẩu..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
              />
            </View>

            {/* Thông báo lỗi nếu có */}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Quick Fill Admin / Test Accounts */}
            <View style={styles.testAccountBox}>
              <Text style={styles.testAccountTitle}>⚡ Tài khoản kiểm thử nhanh:</Text>
              <View style={styles.testBtnRow}>
                <TouchableOpacity
                  style={styles.testBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIdentifier('admin');
                    setPassword('admin123');
                    setErrorMsg('');
                  }}
                >
                  <Text style={styles.testBtnText}>👑 Admin (admin / admin123)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.testBtn, styles.testBtnDemo]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setIdentifier('demo');
                    setPassword('123456');
                    setErrorMsg('');
                  }}
                >
                  <Text style={styles.testBtnDemoText}>👤 Demo (demo / 123456)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Các liên kết phụ */}
            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.7}>
                <Text style={styles.linkText}>Chưa có tài khoản? <Text style={styles.boldLink}>Đăng ký tại đây.</Text></Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7} onPress={() => Alert.alert('Quên mật khẩu', 'Tính năng đặt lại mật khẩu đang được phát triển.')}>
                <Text style={styles.forgotText}>Quên mật khẩu</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nút Đăng nhập bo tròn chuẩn Figma */}
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={THEME.colors.primaryText} />
            ) : (
              <Text style={styles.buttonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          {/* Dải phân cách: Hoặc tiếp tục với */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Hàng nút Social Login chuẩn Apple HIG & Google Brand Guidelines */}
          <View style={styles.socialButtonsContainer}>
            {/* Nút Apple (Hiển thị khi chạy trên iOS hoặc Web theo chuẩn Apple HIG) */}
            {(Platform.OS === 'ios' || Platform.OS === 'web') && (
              <TouchableOpacity
                style={styles.appleButton}
                activeOpacity={0.85}
                onPress={() => handleOpenSocialModal('apple')}
                disabled={socialLoading}
              >
                <AppleIcon size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Tiếp tục với Apple</Text>
              </TouchableOpacity>
            )}

            {/* Hàng 2 nút Google & Facebook */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.googleButton}
                activeOpacity={0.8}
                onPress={() => handleOpenSocialModal('google')}
                disabled={socialLoading}
              >
                <GoogleIcon size={19} />
                <Text style={styles.googleButtonText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.facebookButton}
                activeOpacity={0.8}
                onPress={() => handleOpenSocialModal('facebook')}
                disabled={socialLoading}
              >
                <FacebookIcon size={19} color="#FFFFFF" />
                <Text style={styles.facebookButtonText}>Facebook</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal xác thực mạng xã hội (Demo / Hybrid) */}
      <SocialAuthModal
        visible={socialModalVisible}
        provider={selectedProvider}
        loading={socialLoading}
        onClose={() => setSocialModalVisible(false)}
        onSelectAccount={handleSocialSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    ...THEME.shadow,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.input,
    paddingHorizontal: 16,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  errorText: {
    color: THEME.colors.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  testAccountBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
  },
  testAccountTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 8,
  },
  testBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  testBtnDemo: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  testBtnDemoText: {
    color: '#0369A1',
    fontSize: 11,
    fontWeight: '700',
  },
  linksContainer: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  linkText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  boldLink: {
    color: '#0284C7',
    fontWeight: '700',
  },
  forgotBtn: {
    marginTop: 2,
  },
  forgotText: {
    fontSize: 13,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  button: {
    width: '60%',
    maxWidth: 240,
    height: 52,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...THEME.shadow,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.primaryText,
  },
  dividerRow: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  socialButtonsContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#000000',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  socialRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  googleButton: {
    flex: 1,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleButtonText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  facebookButton: {
    flex: 1,
    height: 46,
    backgroundColor: '#1877F2',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  facebookButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
