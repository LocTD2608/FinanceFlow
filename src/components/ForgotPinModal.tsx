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
import {
  X,
  ChevronLeft,
  Mail,
  CircleAlert,
  CircleCheck,
  KeyRound,
  ShieldAlert,
} from 'lucide-react-native';
import { securityApi } from '../api/security';
import { PinDots, NumericKeypad } from './PinInputModal';

export interface ForgotPinModalProps {
  visible: boolean;
  token?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type ForgotStep =
  | 'request_otp'
  | 'enter_otp'
  | 'enter_new_pin'
  | 'confirm_new_pin'
  | 'success';

export default function ForgotPinModal({
  visible,
  token,
  onSuccess,
  onCancel,
}: ForgotPinModalProps) {
  const [step, setStep] = useState<ForgotStep>('request_otp');
  const [targetEmail, setTargetEmail] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setStep('request_otp');
      setTargetEmail('');
      setDevOtp('');
      setOtp('');
      setNewPin('');
      setConfirmNewPin('');
      setErrorMessage('');
      setLoading(false);
      setResendCountdown(0);
    }
  }, [visible]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Step 1: Request OTP
  const handleRequestOtp = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await securityApi.forgotPin(token);
      if (res.success) {
        setTargetEmail(res.email || 'email tài khoản');
        if (res.devOtp) {
          setDevOtp(res.devOtp);
        }
        setResendCountdown(60);
        setStep('enter_otp');
      } else {
        setErrorMessage(res.message || 'Không thể gửi mã OTP.');
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || loading) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await securityApi.forgotPin(token);
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setResendCountdown(60);
      } else {
        setErrorMessage(res.message || 'Không thể gửi lại mã OTP.');
      }
    } catch {
      setErrorMessage('Không thể gửi lại mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Keypad inputs across different steps
  const handleDigitPress = (digit: string) => {
    if (loading) return;

    if (step === 'enter_otp') {
      if (otp.length >= 6) return;
      const nextOtp = otp + digit;
      setOtp(nextOtp);
      setErrorMessage('');

      if (nextOtp.length === 6) {
        setTimeout(() => {
          setStep('enter_new_pin');
        }, 150);
      }
    } else if (step === 'enter_new_pin') {
      if (newPin.length >= 6) return;
      const nextPin = newPin + digit;
      setNewPin(nextPin);
      setErrorMessage('');

      if (nextPin.length === 6) {
        setTimeout(() => {
          setStep('confirm_new_pin');
        }, 150);
      }
    } else if (step === 'confirm_new_pin') {
      if (confirmNewPin.length >= 6) return;
      const nextConfirm = confirmNewPin + digit;
      setConfirmNewPin(nextConfirm);
      setErrorMessage('');

      if (nextConfirm.length === 6) {
        if (nextConfirm !== newPin) {
          setErrorMessage('Mã PIN xác nhận không khớp. Vui lòng thử lại.');
          setTimeout(() => {
            setNewPin('');
            setConfirmNewPin('');
            setStep('enter_new_pin');
          }, 600);
        } else {
          handleResetPinSubmit(otp, newPin, nextConfirm);
        }
      }
    }
  };

  const handleDeletePress = () => {
    if (loading) return;
    if (step === 'enter_otp') {
      setOtp((prev) => prev.slice(0, -1));
    } else if (step === 'enter_new_pin') {
      setNewPin((prev) => prev.slice(0, -1));
    } else if (step === 'confirm_new_pin') {
      setConfirmNewPin((prev) => prev.slice(0, -1));
    }
  };

  const handleResetPinSubmit = async (
    codeOtp: string,
    pin: string,
    confirmPin: string
  ) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await securityApi.resetPinWithOtp(token, codeOtp, pin, confirmPin);
      if (res.success) {
        setStep('success');
      } else {
        setErrorMessage(res.message || 'Đặt lại mã PIN thất bại.');
        // If OTP expired or invalid, return to OTP step
        if (res.code === 'OTP_INVALID' || (res.message && res.message.includes('OTP'))) {
          setOtp('');
          setStep('enter_otp');
        } else {
          setNewPin('');
          setConfirmNewPin('');
          setStep('enter_new_pin');
        }
      }
    } catch {
      setErrorMessage('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
      setNewPin('');
      setConfirmNewPin('');
      setStep('enter_new_pin');
    } finally {
      setLoading(false);
    }
  };

  const handleBackStep = () => {
    setErrorMessage('');
    if (step === 'enter_otp') {
      setStep('request_otp');
    } else if (step === 'enter_new_pin') {
      setStep('enter_otp');
    } else if (step === 'confirm_new_pin') {
      setConfirmNewPin('');
      setStep('enter_new_pin');
    }
  };

  const getCurrentValue = () => {
    if (step === 'enter_otp') return otp;
    if (step === 'enter_new_pin') return newPin;
    if (step === 'confirm_new_pin') return confirmNewPin;
    return '';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.notch} />

          {/* Step 1: Request OTP */}
          {step === 'request_otp' && (
            <View style={styles.contentBox}>
              <View style={styles.headerRow}>
                <View style={styles.headerPlaceholder} />
                <Text style={styles.title}>Quên mã PIN</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onCancel}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.iconCircleBadge}>
                <Mail size={48} color="#0284C7" />
              </View>

              <Text style={styles.mainTitle}>Khôi phục mã PIN giao dịch</Text>
              <Text style={styles.mainSubtitle}>
                Để đảm bảo an toàn cho ví của bạn, hệ thống sẽ gửi mã xác thực OTP gồm 6 chữ số đến
                email tài khoản đã đăng ký.
              </Text>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <CircleAlert size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Gửi mã OTP qua Email</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 5: Success Screen */}
          {step === 'success' && (
            <View style={styles.contentBox}>
              <View style={styles.successIconBadge}>
                <CircleCheck size={56} color="#16A34A" />
              </View>

              <Text style={styles.mainTitle}>Đặt lại mã PIN thành công!</Text>
              <Text style={styles.mainSubtitle}>
                Mã PIN mới của bạn đã được cập nhật thành công và tài khoản ví đã được mở khóa.
                Hãy ghi nhớ mã PIN này cho các giao dịch chuyển tiền và bảo mật tiếp theo.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onSuccess}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Hoàn tất</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Steps 2, 3, 4: OTP & New PIN keypad flows */}
          {(step === 'enter_otp' ||
            step === 'enter_new_pin' ||
            step === 'confirm_new_pin') && (
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBackStep}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <ChevronLeft size={22} color="#0F172A" />
                </TouchableOpacity>

                <Text style={styles.title}>Khôi phục mã PIN</Text>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onCancel}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Step Badge */}
              <View style={styles.stepBadge}>
                <KeyRound size={14} color="#0284C7" />
                <Text style={styles.stepBadgeText}>
                  {step === 'enter_otp' && 'Bước 1/3: Nhập mã OTP từ Email'}
                  {step === 'enter_new_pin' && 'Bước 2/3: Thiết lập mã PIN mới'}
                  {step === 'confirm_new_pin' && 'Bước 3/3: Xác nhận mã PIN mới'}
                </Text>
              </View>

              {/* Instructions */}
              <Text style={styles.instructionTitle}>
                {step === 'enter_otp' && 'Nhập mã xác thực OTP'}
                {step === 'enter_new_pin' && 'Nhập mã PIN mới'}
                {step === 'confirm_new_pin' && 'Xác nhận mã PIN mới'}
              </Text>

              <Text style={styles.subtitle}>
                {step === 'enter_otp' &&
                  `Mã OTP đã được gửi đến ${targetEmail}. Vui lòng nhập 6 chữ số:`}
                {step === 'enter_new_pin' && 'Nhập 6 chữ số cho mã PIN bảo mật mới của bạn:'}
                {step === 'confirm_new_pin' && 'Nhập lại đúng 6 chữ số vừa tạo để hoàn tất:'}
              </Text>

              {/* Dev OTP Helper */}
              {step === 'enter_otp' && devOtp ? (
                <View style={styles.devOtpBadge}>
                  <Text style={styles.devOtpText}>Mã thử nghiệm (Dev): {devOtp}</Text>
                </View>
              ) : null}

              {/* Error Banner */}
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <CircleAlert size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Dots or Loading */}
              <View style={styles.dotsSection}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#0284C7" />
                    <Text style={styles.loadingText}>Đang xử lý đặt lại mã PIN...</Text>
                  </View>
                ) : (
                  <PinDots value={getCurrentValue()} hasError={Boolean(errorMessage)} />
                )}
              </View>

              {/* Numeric Keypad */}
              <NumericKeypad
                onPressDigit={handleDigitPress}
                onPressDelete={handleDeletePress}
                disabled={loading}
              />

              {/* Resend OTP button when in enter_otp step */}
              {step === 'enter_otp' ? (
                <View style={styles.resendRow}>
                  {resendCountdown > 0 ? (
                    <Text style={styles.resendCountdownText}>
                      Gửi lại mã sau {resendCountdown}s
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleResendOtp}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.resendButtonText}>Gửi lại mã OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
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
  contentBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
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
  iconCircleBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  successIconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#BBF7D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  stepBadge: {
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
  stepBadgeText: {
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
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  devOtpBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 2,
  },
  devOtpText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
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
    marginTop: 6,
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
  primaryButton: {
    width: '100%',
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendRow: {
    marginTop: 12,
    paddingVertical: 4,
  },
  resendCountdownText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  resendButtonText: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '600',
  },
});
