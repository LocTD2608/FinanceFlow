import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  X,
  ChevronLeft,
  Fingerprint,
  ScanFace,
  CircleAlert,
  ShieldCheck,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { securityApi } from '../api/security';
import { PinDots, NumericKeypad } from './PinInputModal';

export interface PinSetupModalProps {
  visible: boolean;
  token?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type SetupStep = 'enter_pin' | 'confirm_pin' | 'biometric_prompt';

export default function PinSetupModal({
  visible,
  token,
  onSuccess,
  onCancel,
}: PinSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('enter_pin');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face'>('fingerprint');

  // Reset state whenever modal is opened
  useEffect(() => {
    if (visible) {
      setStep('enter_pin');
      setFirstPin('');
      setConfirmPin('');
      setErrorMessage('');
      setLoading(false);
    }
  }, [visible]);

  const handleDigitPress = (digit: string) => {
    if (loading) return;

    if (step === 'enter_pin') {
      if (firstPin.length >= 6) return;
      const nextPin = firstPin + digit;
      setFirstPin(nextPin);
      setErrorMessage('');

      if (nextPin.length === 6) {
        // Transition to confirm pin
        setTimeout(() => {
          setStep('confirm_pin');
        }, 150);
      }
    } else if (step === 'confirm_pin') {
      if (confirmPin.length >= 6) return;
      const nextConfirm = confirmPin + digit;
      setConfirmPin(nextConfirm);
      setErrorMessage('');

      if (nextConfirm.length === 6) {
        // Compare with firstPin
        if (nextConfirm !== firstPin) {
          setErrorMessage('Mã PIN xác nhận không khớp. Vui lòng thiết lập lại.');
          setTimeout(() => {
            setFirstPin('');
            setConfirmPin('');
            setStep('enter_pin');
          }, 600);
        } else {
          // Both match: Call setupPin API
          handlePinSubmit(firstPin, nextConfirm);
        }
      }
    }
  };

  const handleDeletePress = () => {
    if (loading) return;
    if (step === 'enter_pin') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else if (step === 'confirm_pin') {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handlePinSubmit = async (pin: string, cPin: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await securityApi.setupPin(token, pin, cPin);
      if (!res.success) {
        setErrorMessage(res.message || 'Không thể thiết lập mã PIN.');
        setFirstPin('');
        setConfirmPin('');
        setStep('enter_pin');
        setLoading(false);
        return;
      }

      // Check device biometrics capability
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHw && isEnrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const isFace = types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
        );
        setBiometricType(isFace ? 'face' : 'fingerprint');
        setLoading(false);
        setStep('biometric_prompt');
      } else {
        setLoading(false);
        onSuccess();
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
      setFirstPin('');
      setConfirmPin('');
      setStep('enter_pin');
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    setLoading(true);
    try {
      await AsyncStorage.setItem('@financeflow_biometric_pin', confirmPin || firstPin);
      await securityApi.toggleBiometric(token, true);
    } catch {
      // ignore error, pin is already set
    } finally {
      setLoading(false);
      onSuccess();
    }
  };

  const handleSkipBiometric = () => {
    onSuccess();
  };

  const handleBackToStep1 = () => {
    setConfirmPin('');
    setErrorMessage('');
    setStep('enter_pin');
  };

  const currentPinValue = step === 'enter_pin' ? firstPin : confirmPin;
  const isFace = biometricType === 'face';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.notch} />

          {/* Biometric Prompt View */}
          {step === 'biometric_prompt' ? (
            <View style={styles.bioContainer}>
              <View style={styles.bioIconBadge}>
                {isFace ? (
                  <ScanFace size={54} color="#0284C7" />
                ) : (
                  <Fingerprint size={54} color="#0284C7" />
                )}
              </View>

              <Text style={styles.bioTitle}>
                {isFace ? 'Bật xác thực FaceID?' : 'Bật xác thực Vân tay?'}
              </Text>
              <Text style={styles.bioSubtitle}>
                Sử dụng {isFace ? 'khuôn mặt (FaceID)' : 'vân tay'} để xác thực và thực hiện các
                giao dịch ví nhanh chóng, an toàn hơn mà không cần nhập mã PIN mỗi lần.
              </Text>

              <TouchableOpacity
                style={styles.bioPrimaryButton}
                onPress={handleEnableBiometric}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.bioPrimaryButtonText}>Kích hoạt ngay</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bioSkipButton}
                onPress={handleSkipBiometric}
                disabled={loading}
                activeOpacity={0.6}
              >
                <Text style={styles.bioSkipButtonText}>Để sau</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* PIN Setup Steps */
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                {step === 'confirm_pin' ? (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackToStep1}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <ChevronLeft size={22} color="#0F172A" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.headerPlaceholder} />
                )}

                <Text style={styles.title}>Thiết lập mã PIN</Text>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onCancel}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Step indicator */}
              <View style={styles.stepIndicatorBadge}>
                <ShieldCheck size={14} color="#0284C7" />
                <Text style={styles.stepIndicatorText}>
                  {step === 'enter_pin' ? 'Bước 1/2: Tạo mã PIN mới' : 'Bước 2/2: Xác nhận mã PIN'}
                </Text>
              </View>

              <Text style={styles.instructionTitle}>
                {step === 'enter_pin'
                  ? 'Thiết lập mã PIN giao dịch'
                  : 'Xác nhận mã PIN của bạn'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'enter_pin'
                  ? 'Nhập 6 chữ số để bảo vệ ví và xác thực giao dịch'
                  : 'Vui lòng nhập lại 6 chữ số vừa tạo để xác nhận'}
              </Text>

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <CircleAlert size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* PIN Dots or Loading */}
              <View style={styles.dotsSection}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0284C7" />
                    <Text style={styles.loadingText}>Đang khởi tạo mã PIN...</Text>
                  </View>
                ) : (
                  <PinDots value={currentPinValue} hasError={Boolean(errorMessage)} />
                )}
              </View>

              {/* Numeric Keypad */}
              <NumericKeypad
                onPressDigit={handleDigitPress}
                onPressDelete={handleDeletePress}
                disabled={loading}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  notch: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 10,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerPlaceholder: {
    width: 32,
    height: 32,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  stepIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 6,
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  dotsSection: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '500',
  },
  bioContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  bioIconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  bioTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  bioSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  bioPrimaryButton: {
    width: '100%',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  bioPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bioSkipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bioSkipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
