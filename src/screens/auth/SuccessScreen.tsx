import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { THEME } from '../../constants/theme';
import { CheckCircle2, Sparkles } from 'lucide-react-native';

interface Props {
  username?: string;
  onContinue: () => void;
}

export default function SuccessScreen({ username, onContinue }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Floating Card màu xanh nhạt theo bản vẽ Figma */}
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập{'\n'}thành công!</Text>

          {/* Vùng ảnh ăn mừng cute (Thay bằng ảnh chibi thật sau) */}
          <View style={styles.illustrationWrapper}>
            <Text style={styles.celebrationEmoji}>🎉🐻🥳</Text>
            <View style={styles.checkBadge}>
              <CheckCircle2 size={32} color="#059669" />
              <Sparkles size={20} color="#F59E0B" style={styles.sparkle} />
            </View>
          </View>

          {username ? (
            <Text style={styles.welcomeUser}>Xin chào, <Text style={styles.boldUser}>{username}</Text>!</Text>
          ) : null}

          {/* Hướng dẫn tiếp tục chuẩn text Figma */}
          <Text style={styles.subtitle}>
            Chọn Tiếp tục để bắt đầu{'\n'}quản lý tài chính của bạn
          </Text>
        </View>

        {/* Nút Tiếp tục chuẩn Figma */}
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onContinue}>
          <Text style={styles.buttonText}>Tiếp tục</Text>
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.colors.cardTint, // Nền xanh nhạt #E0F2FE chuẩn Figma
    borderRadius: THEME.borderRadius.card,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    marginBottom: 36,
    ...THEME.shadow,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  illustrationWrapper: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  celebrationEmoji: {
    fontSize: 56,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -6,
    right: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  sparkle: {
    marginLeft: 2,
  },
  welcomeUser: {
    fontSize: 16,
    color: '#0F172A',
    marginTop: 8,
    marginBottom: 4,
  },
  boldUser: {
    fontWeight: '800',
    color: '#0284C7',
  },
  subtitle: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
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
