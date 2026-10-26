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

// Mascot chú gấu nhảy vui mừng cùng bạn nhỏ với các ngôi sao vàng
const MASCOT_SUCCESS = require('../../../assets/mascot_success.png');

interface Props {
  username?: string;
  onContinue: () => void;
}

export default function SuccessScreen({ onContinue }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Card xanh pastel chuẩn theo hình mockup */}
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập{'\n'}thành công!</Text>

          {/* Vùng ảnh mascot gấu vui mừng */}
          <View style={styles.illustrationWrapper}>
            <Image
              source={MASCOT_SUCCESS}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* Hướng dẫn tiếp tục chuẩn text mockup */}
          <Text style={styles.subtitle}>
            Chọn Tiếp tục để bắt đầu{'\n'}quản lý tài chính của bạn
          </Text>
        </View>

        {/* Nút Tiếp tục hình viên thuốc bo tròn */}
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={onContinue}
        >
          <Text style={styles.buttonText}>Tiếp tục</Text>
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
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#D8F1FE', // Nền xanh pastel chuẩn ảnh 5
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  illustrationWrapper: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: 200,
    height: 200,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  button: {
    width: 170,
    height: 48,
    backgroundColor: '#CFF0FC', // Nền xanh nhạt
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
