import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox, Alert } from 'react-native';

// Bỏ qua cảnh báo thông báo đẩy của Expo Go trên Android để không hiện thanh vàng
LogBox.ignoreLogs(['[expo-notifications]']);
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/useAuthStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { soundService } from './src/services/soundService';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import SuccessScreen from './src/screens/auth/SuccessScreen';
import FinancialCenterScreen from './src/screens/dashboard/FinancialCenterScreen';
import AdminPortalScreen from './src/screens/admin/AdminPortalScreen';
import BalanceToastBanner from './src/components/notification/BalanceToastBanner';
import { registerForPushNotifications } from './src/utils/pushNotifications';

type ScreenType = 'welcome' | 'login' | 'register' | 'success' | 'home';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [successUsername, setSuccessUsername] = useState<string>('');
  const { isLoading, loadSession, token, user, activeMode, logout } = useAuthStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSession();
    loadSettings();
  }, [loadSession, loadSettings]);

  // Mở khóa Web Audio khi có tương tác đầu tiên
  useEffect(() => {
    soundService.unlockAudio();
  }, []);

  // Đăng ký nhận thông báo nhắc hóa đơn khi đã đăng nhập (chỉ thiết bị thật)
  useEffect(() => {
    if (currentScreen === 'home' && token) registerForPushNotifications(token);
  }, [currentScreen, token]);

  // Kiểm tra an toàn: nếu tài khoản bị khóa trong phiên, tự động logout
  useEffect(() => {
    if (token && user?.status === 'locked') {
      Alert.alert(
        'Tài khoản bị khóa',
        'Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ bộ phận hỗ trợ.',
        [
          {
            text: 'Đăng xuất',
            onPress: async () => {
              await logout();
              setCurrentScreen('welcome');
            },
          },
        ]
      );
    }
  }, [token, user?.status, logout]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284C7" />
        <StatusBar style="dark" />
      </View>
    );
  }

  const handleLoginSuccess = (username: string) => {
    setSuccessUsername(username);
    setCurrentScreen('success');
  };

  const handleRegisterSuccess = (username: string) => {
    setSuccessUsername(username);
    setCurrentScreen('success');
  };

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="dark" />

      {/* Floating Realtime Balance Notification Banner ("Ting Ting") */}
      <BalanceToastBanner />

      {/* 1. Màn hình mở đầu (Onboarding) chuẩn mascot chú gấu cầm tiền */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen onStart={() => setCurrentScreen('login')} />
      )}

      {/* 2. Màn hình Đăng nhập (Login) */}
      {currentScreen === 'login' && (
        <LoginScreen
          onNavigateToRegister={() => setCurrentScreen('register')}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* 3. Màn hình Đăng ký (Register) */}
      {currentScreen === 'register' && (
        <RegisterScreen
          onNavigateToLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )}

      {/* 4. Màn hình Đăng nhập thành công với Mascot nhảy vui mừng */}
      {currentScreen === 'success' && (
        <SuccessScreen
          username={successUsername}
          onContinue={() => setCurrentScreen('home')}
        />
      )}

      {/* 5. Điều hướng theo Vai trò (Role Guard): Admin Portal vs Financial Center */}
      {currentScreen === 'home' && (
        user?.role === 'admin' && activeMode === 'admin' ? (
          <AdminPortalScreen onLogout={() => setCurrentScreen('welcome')} />
        ) : (
          <FinancialCenterScreen onLogout={() => setCurrentScreen('welcome')} />
        )
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
