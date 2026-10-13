import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Mascot gấu cầm tiền lấp lánh và túi xách gấu hồng
const MASCOT_MONEY = require('../../../assets/mascot_money.webp');

interface Props {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Mascot chú gấu cầm tiền chuẩn 100% hình mockup */}
        <View style={styles.illustrationWrapper}>
          <Image
            source={MASCOT_MONEY}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>

        {/* Tiêu đề & Slogan chuẩn theo bản vẽ */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Quản lí tài chính</Text>
          <Text style={styles.subtitle}>Tiền của bạn là tiền của chúng tôi</Text>
        </View>

        {/* Nút Bắt đầu hình viên thuốc bo tròn nền xanh nhạt */}
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={onStart}
        >
          <Text style={styles.buttonText}>Bắt đầu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  illustrationWrapper: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: Math.min(width * 0.75, 260),
    height: Math.min(width * 0.75, 260),
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 42,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  button: {
    width: 170,
    height: 48,
    backgroundColor: '#CFF0FC', // Xanh nhạt pastel chuẩn thiết kế
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
