/**
 * AccountSetupModal
 * Dialog bắt buộc hiện ra khi ví chưa có số tài khoản ngân hàng.
 * User PHẢI chọn 1 trong 3 cách trước khi dùng app tiếp.
 *
 * Option 1 – Dùng SĐT đã đăng ký (cần SĐT 10 số)
 * Option 2 – Hệ thống gợi ý 1 số đẹp (refresh được)
 * Option 3 – Tự nhập số (validate realtime)
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Phone,
  Shuffle,
  PenLine,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react-native';
import { walletApi, WalletItem } from '../api/wallet';
import { User } from '../api/auth';

type OptionKey = 'phone' | 'pretty' | 'custom';

interface Props {
  visible: boolean;
  user: User | null;
  wallet: WalletItem | null;
  token?: string;
  /** Gọi sau khi set thành công – truyền wallet đã cập nhật */
  onSuccess: (wallet: WalletItem) => void;
}

export default function AccountSetupModal({ visible, user, wallet, token, onSuccess }: Props) {
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [prettyNumber, setPrettyNumber] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [customStatus, setCustomStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [customError, setCustomError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lấy số đẹp khi mở modal hoặc bấm refresh
  const fetchPretty = useCallback(async () => {
    setLoading(true);
    const res = await walletApi.suggestAccount(token);
    if (res.success && res.data?.accountNumber) {
      setPrettyNumber(res.data.accountNumber);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setCustomInput('');
      setCustomStatus('idle');
      setCustomError('');
      fetchPretty();
    }
  }, [visible, fetchPretty]);

  // Validate số tự nhập – debounce 600ms
  useEffect(() => {
    if (selected !== 'custom') return;
    const acc = customInput.replace(/\D/g, '');
    if (acc.length !== 10) {
      setCustomStatus('idle');
      setCustomError('');
      return;
    }
    setCustomStatus('checking');
    setCustomError('');
    const timer = setTimeout(async () => {
      const res = await walletApi.checkAccount(token, acc);
      if (res.success) {
        setCustomStatus('ok');
      } else {
        setCustomStatus('error');
        setCustomError(res.message || 'Số tài khoản không hợp lệ.');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [customInput, selected, token]);

  const getAccountToSet = (): string | null => {
    if (selected === 'phone') {
      const phone = user?.phone?.replace(/\D/g, '') || '';
      return phone.length === 10 ? phone : null;
    }
    if (selected === 'pretty') return prettyNumber || null;
    if (selected === 'custom') {
      const acc = customInput.replace(/\D/g, '');
      return customStatus === 'ok' && acc.length === 10 ? acc : null;
    }
    return null;
  };

  const canConfirm = (): boolean => {
    if (!selected) return false;
    return getAccountToSet() !== null;
  };

  const handleConfirm = async () => {
    const acc = getAccountToSet();
    if (!acc || !wallet) return;
    setSubmitting(true);
    try {
      const res = await walletApi.setAccount(token, wallet._id || wallet.id, acc);
      if (res.success && res.data) {
        onSuccess(res.data as WalletItem);
      } else {
        // Nếu trùng STK (race condition) → lấy số đẹp mới
        if (res.code === 'TAKEN' && selected === 'pretty') {
          await fetchPretty();
        }
        setCustomError(res.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        if (selected === 'custom') setCustomStatus('error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const phoneValid = (user?.phone?.replace(/\D/g, '') || '').length === 10;
  const phoneDisplay = user?.phone || 'Chưa có SĐT';

  const OPTIONS: { key: OptionKey; icon: any; label: string; desc: string; disabled?: boolean }[] = [
    {
      key: 'phone',
      icon: Phone,
      label: 'Dùng số điện thoại',
      desc: phoneValid
        ? `Số tài khoản: ${user!.phone}`
        : `Tài khoản chưa liên kết SĐT hợp lệ (${phoneDisplay})`,
      disabled: !phoneValid,
    },
    {
      key: 'pretty',
      icon: Shuffle,
      label: 'Hệ thống chọn số đẹp',
      desc: 'Số dễ nhớ, hệ thống đảm bảo chưa ai dùng',
    },
    {
      key: 'custom',
      icon: PenLine,
      label: 'Tự đặt số',
      desc: 'Nhập đúng 10 chữ số bạn muốn',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <ShieldCheck size={28} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Cài đặt số tài khoản</Text>
                <Text style={styles.subtitle}>
                  Bạn cần chọn số tài khoản để sử dụng đầy đủ tính năng FinanceFlow.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Options */}
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = selected === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optionRow, isActive && styles.optionRowActive, opt.disabled && styles.optionRowDisabled]}
                  onPress={() => !opt.disabled && setSelected(opt.key)}
                  activeOpacity={opt.disabled ? 1 : 0.75}
                >
                  <View style={[styles.optionIconCircle, isActive && styles.optionIconCircleActive]}>
                    <Icon size={18} color={isActive ? '#059669' : opt.disabled ? '#CBD5E1' : '#475569'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, opt.disabled && styles.optionLabelDisabled]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  {isActive && <CheckCircle2 size={20} color="#059669" />}
                </TouchableOpacity>
              );
            })}

            {/* Detail section per option */}
            {selected === 'pretty' && (
              <View style={styles.detailBox}>
                {loading ? (
                  <ActivityIndicator color="#059669" />
                ) : (
                  <View style={styles.prettyRow}>
                    <Text style={styles.prettyNumber}>{prettyNumber}</Text>
                    <TouchableOpacity onPress={fetchPretty} style={styles.refreshBtn}>
                      <RefreshCw size={16} color="#059669" />
                      <Text style={styles.refreshText}>Đổi số khác</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {selected === 'custom' && (
              <View style={styles.detailBox}>
                <View
                  style={[
                    styles.inputWrap,
                    customStatus === 'ok' && styles.inputWrapOk,
                    customStatus === 'error' && styles.inputWrapError,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập 10 chữ số..."
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={customInput}
                    onChangeText={setCustomInput}
                  />
                  {customStatus === 'checking' && <ActivityIndicator size="small" color="#059669" />}
                  {customStatus === 'ok' && <CheckCircle2 size={18} color="#059669" />}
                  {customStatus === 'error' && <AlertCircle size={18} color="#EF4444" />}
                </View>
                {customStatus === 'error' && (
                  <Text style={styles.errorText}>{customError}</Text>
                )}
                {customStatus === 'ok' && (
                  <Text style={styles.okText}>✓ Số tài khoản hợp lệ!</Text>
                )}
              </View>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm() && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm() || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>Xác nhận &amp; Bắt đầu dùng app</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footNote}>
              Số tài khoản không thể thay đổi sau khi đã xác nhận.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  optionRowActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  optionRowDisabled: {
    opacity: 0.45,
  },
  optionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconCircleActive: {
    backgroundColor: '#D1FAE5',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  optionLabelDisabled: {
    color: '#94A3B8',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  detailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prettyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prettyNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
  },
  refreshText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputWrapOk: { borderColor: '#059669' },
  inputWrapError: { borderColor: '#EF4444' },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
  okText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 6,
  },
  confirmBtn: {
    backgroundColor: '#059669',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  footNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
  },
});

