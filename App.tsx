import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/store/useAuthStore';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import SuccessScreen from './src/screens/auth/SuccessScreen';
import HomeScreen from './src/screens/dashboard/HomeScreen';

type ScreenType = 'welcome' | 'login' | 'register' | 'success' | 'home';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('welcome');
  const [successUsername, setSuccessUsername] = useState<string>('');
  const { user, isLoading, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        setCurrentScreen('home');
      } else {
        setCurrentScreen('welcome');
      }
    }
  }, [isLoading, user]);

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
    <View style={styles.container}>
      <StatusBar style="dark" />

      {currentScreen === 'welcome' && (
        <WelcomeScreen onStart={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'login' && (
        <LoginScreen
          onNavigateToRegister={() => setCurrentScreen('register')}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {currentScreen === 'register' && (
        <RegisterScreen
          onNavigateToLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )}

      {currentScreen === 'success' && (
        <SuccessScreen
          username={successUsername}
          onContinue={() => setCurrentScreen('home')}
        />
      )}

      {currentScreen === 'home' && (
        <HomeScreen onLogout={() => setCurrentScreen('welcome')} />
      )}
    </View>
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
