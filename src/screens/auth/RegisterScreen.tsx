import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { THEME } from '../../constants/theme';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  onNavigateToLogin: () => void;
  onRegisterSuccess: (username: string) => void;
}

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { setUser } = useAuthStore();

  const handleRegister = async () => {
    setErrorMsg('');
    if (!username.trim() || !phone.trim() || !email.trim() || !password) {
      setErrorMsg('Vui lòng điền đầy đủ tất cả thông tin.');
      return;
    }

    setLoading(true);
    const res = await authApi.register(username.trim(), phone.trim(), email.trim(), password);
    setLoading(false);

    if (res.success && res.user && res.token) {
      await setUser(res.user, res.token);
      onRegisterSuccess(res.user.username);
    } else {
      setErrorMsg(res.message || 'Đăng ký không thành công.');
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
          <Text style={styles.headerTitle}>Đăng ký</Text>

          {/* Form Card chuẩn theo khung bản vẽ Figma */}
          <View style={styles.card}>
            {/* Input Tên người dùng */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tên người dùng</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên người dùng..."
                placeholderTextColor="#94A3B8"
                value={username}
                onChangeText={(t) => { setUsername(t); setErrorMsg(''); }}
              />
            </View>

            {/* Input Số điện thoại */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập số điện thoại..."
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => { setPhone(t); setErrorMsg(''); }}
              />
            </View>

            {/* Input Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập địa chỉ email..."
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
              />
            </View>

            {/* Input Mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
              />
            </View>

            {/* Thông báo lỗi nếu có */}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Liên kết quay lại Đăng nhập */}
            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.7}>
                <Text style={styles.linkText}>Đã có tài khoản? <Text style={styles.boldLink}>Đăng nhập tại đây.</Text></Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Nút Đăng ký bo tròn chuẩn Figma */}
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={THEME.colors.primaryText} />
            ) : (
              <Text style={styles.buttonText}>Đăng ký</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 28,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 28,
    ...THEME.shadow,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  linksContainer: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  linkText: {
    fontSize: 13,
    color: '#64748B',
  },
  boldLink: {
    color: '#0284C7',
    fontWeight: '700',
  },
  button: {
    width: '60%',
    maxWidth: 240,
    height: 52,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.primaryText,
  },
});
