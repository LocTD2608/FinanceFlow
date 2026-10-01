import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { THEME } from '../../constants/theme';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  onNavigateToRegister: () => void;
  onLoginSuccess: (username: string) => void;
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    paddingVertical: 32,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 32,
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
    ...THEME.shadow,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.primaryText,
  },
});
