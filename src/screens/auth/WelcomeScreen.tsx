import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { THEME } from '../../constants/theme';
import { Coins, Sparkles } from 'lucide-react-native';

interface Props {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Khung hình minh hoạ (Dễ dàng thay bằng ảnh gấu thật sau) */}
        <View style={styles.illustrationWrapper}>
          <View style={styles.illustrationCircle}>
            <Text style={styles.bearEmoji}>🐻</Text>
            <View style={styles.moneyBadge}>
              <Coins size={28} color="#EAB308" />
              <Sparkles size={16} color="#F59E0B" style={styles.sparkleIcon} />
            </View>
          </View>
        </View>

        {/* Tiêu đề & Slogan chuẩn theo bản vẽ Figma */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Quản lí tài chính</Text>
          <Text style={styles.subtitle}>Tiền của bạn là tiền của chúng tôi</Text>
        </View>

        {/* Nút Bắt đầu hình viên thuốc chuẩn Figma */}
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onStart}>
          <Text style={styles.buttonText}>Bắt đầu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  illustrationWrapper: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  bearEmoji: {
    fontSize: 90,
  },
  moneyBadge: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    backgroundColor: '#FEF08A',
    borderRadius: 24,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...THEME.shadow,
  },
  sparkleIcon: {
    marginLeft: 2,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
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
