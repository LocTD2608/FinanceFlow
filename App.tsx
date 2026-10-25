import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/useAuthStore';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import SuccessScreen from './src/screens/auth/SuccessScreen';
import FinancialCenterScreen from './src/screens/dashboard/FinancialCenterScreen';
import { registerForPushNotifications } from './src/utils/pushNotifications';

type ScreenType = 'welcome' | 'login' | 'register' | 'success' | 'home';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [successUsername, setSuccessUsername] = useState<string>('');
  const { isLoading, loadSession, token } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Đăng ký nhận thông báo nhắc hóa đơn khi đã đăng nhập (chỉ thiết bị thật)
  useEffect(() => {
    if (currentScreen === 'home' && token) registerForPushNotifications(token);
  }, [currentScreen, token]);

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

      {/* 5. Màn hình Trung tâm tài chính chính */}
      {currentScreen === 'home' && (
        <FinancialCenterScreen onLogout={() => setCurrentScreen('welcome')} />
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
