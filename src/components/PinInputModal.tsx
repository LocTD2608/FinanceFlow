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
  Fingerprint,
  ScanFace,
  Delete,
  Lock,
  CircleAlert,
} from 'lucide-react-native';

export interface PinInputModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  onForgotPin?: () => void;
  onBiometricSuccess?: () => void;
  errorMessage?: string;
  isLoading?: boolean;
  lockRemainingSeconds?: number;
}

export interface PinDotsProps {
  length?: number;
  value: string;
  hasError?: boolean;
}

export const PinDots: React.FC<PinDotsProps> = ({
  length = 6,
  value,
  hasError = false,
}) => {
  const dots = Array.from({ length }, (_, i) => i);
  return (
    <View style={dotStyles.container}>
      {dots.map((index) => {
        const isFilled = index < value.length;
        return (
          <View
            key={index}
            style={[
              dotStyles.dot,
              isFilled && dotStyles.dotFilled,
              hasError && dotStyles.dotError,
              isFilled && hasError && dotStyles.dotFilledError,
            ]}
          />
        );
      })}
    </View>
  );
};

export interface NumericKeypadProps {
  onPressDigit: (digit: string) => void;
  onPressDelete: () => void;
  onPressBiometric?: () => void;
  biometricType?: 'fingerprint' | 'face' | null;
  showBiometric?: boolean;
  disabled?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onPressDigit,
  onPressDelete,
  onPressBiometric,
  biometricType = 'fingerprint',
  showBiometric = false,
  disabled = false,
}) => {
  const digits = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    <View style={[keypadStyles.container, disabled && keypadStyles.containerDisabled]}>
      {digits.map((row, rowIndex) => (
        <View key={rowIndex} style={keypadStyles.row}>
          {row.map((digit) => (
            <TouchableOpacity
              key={digit}
              style={keypadStyles.key}
              onPress={() => onPressDigit(digit)}
              disabled={disabled}
              activeOpacity={0.6}
            >
              <Text style={keypadStyles.keyText}>{digit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {/* Row 4: Biometric, 0, Backspace */}
      <View style={keypadStyles.row}>
        {showBiometric && onPressBiometric ? (
          <TouchableOpacity
            style={keypadStyles.keyAction}
            onPress={onPressBiometric}
            disabled={disabled}
            activeOpacity={0.6}
          >
            {biometricType === 'face' ? (
              <ScanFace size={28} color={disabled ? '#94A3B8' : '#0284C7'} />
            ) : (
              <Fingerprint size={28} color={disabled ? '#94A3B8' : '#0284C7'} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={keypadStyles.keyPlaceholder} />
        )}

        <TouchableOpacity
          style={keypadStyles.key}
          onPress={() => onPressDigit('0')}
          disabled={disabled}
          activeOpacity={0.6}
        >
          <Text style={keypadStyles.keyText}>0</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={keypadStyles.keyAction}
          onPress={onPressDelete}
          disabled={disabled}
          activeOpacity={0.6}
        >
          <Delete size={26} color={disabled ? '#94A3B8' : '#475569'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function PinInputModal({
  visible,
  title = 'Nhập mã PIN',
  subtitle = 'Nhập mã PIN gồm 6 chữ số để xác thực giao dịch',
  onConfirm,
  onCancel,
  onForgotPin,
  onBiometricSuccess,
  errorMessage,
  isLoading = false,
  lockRemainingSeconds = 0,
}: PinInputModalProps) {
  const [pin, setPin] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(lockRemainingSeconds || 0);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null);

  // Sync lockout countdown
  useEffect(() => {
    setSecondsLeft(lockRemainingSeconds || 0);
  }, [lockRemainingSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Reset PIN on open or when error message appears
  useEffect(() => {
    if (visible) {
      setPin('');
    }
  }, [visible]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setPin('');
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Detect biometric hardware
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;
    (async () => {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHw && isEnrolled) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (isMounted) {
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
              setBiometricType('face');
            } else {
              setBiometricType('fingerprint');
            }
          }
        } else if (isMounted) {
          setBiometricType(null);
        }
      } catch {
        if (isMounted) setBiometricType(null);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const isLocked = secondsLeft > 0;
  const isKeypadDisabled = isLoading || isLocked;

  const handleDigitPress = (digit: string) => {
    if (isKeypadDisabled || pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 6) {
      onConfirm(nextPin);
    }
  };

  const handleDeletePress = () => {
    if (isKeypadDisabled || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleBiometricPress = async () => {
    if (isKeypadDisabled || !onBiometricSuccess) return;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: title || 'Xác thực sinh trắc học',
        fallbackLabel: 'Sử dụng mã PIN',
        cancelLabel: 'Hủy',
      });
      if (result.success) {
        onBiometricSuccess();
      }
    } catch {
      // ignore biometric cancel
    }
  };

  const formatLockTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Top handle notch */}
          <View style={styles.notch} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeftPlaceholder} />
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {/* Lockout Banner */}
          {isLocked ? (
            <View style={styles.lockoutBanner}>
              <Lock size={18} color="#DC2626" />
              <View style={styles.lockoutContent}>
                <Text style={styles.lockoutTitle}>
                  Tài khoản tạm khóa: {formatLockTime(secondsLeft)}
                </Text>
                <Text style={styles.lockoutDesc}>
                  Bạn đã nhập sai mã PIN quá số lần quy định. Vui lòng đợi hoặc bấm "Quên mã PIN?".
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Message */}
          {errorMessage && !isLocked ? (
            <View style={styles.errorBanner}>
              <CircleAlert size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Loading Indicator or PIN Dots */}
          <View style={styles.dotsSection}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#0284C7" />
                <Text style={styles.loadingText}>Đang xác thực mã PIN...</Text>
              </View>
            ) : (
              <PinDots value={pin} hasError={Boolean(errorMessage)} />
            )}
          </View>

          {/* Numeric Keypad */}
          <NumericKeypad
            onPressDigit={handleDigitPress}
            onPressDelete={handleDeletePress}
            onPressBiometric={onBiometricSuccess ? handleBiometricPress : undefined}
            biometricType={biometricType}
            showBiometric={Boolean(onBiometricSuccess && (biometricType || true))}
            disabled={isKeypadDisabled}
          />

          {/* Forgot PIN Button */}
          {onForgotPin ? (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={onForgotPin}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Quên mã PIN?</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  dotFilled: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  dotError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  dotFilledError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
});

const keypadStyles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    marginTop: 6,
  },
  containerDisabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  key: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#0F172A',
  },
  keyAction: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPlaceholder: {
    width: 68,
    height: 68,
  },
});

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
  headerLeftPlaceholder: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  lockoutContent: {
    flex: 1,
  },
  lockoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  lockoutDesc: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
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
    height: 60,
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
  forgotButton: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0284C7',
  },
});
