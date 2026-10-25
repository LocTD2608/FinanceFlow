import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { walletApi, WalletItem } from '../api/wallet';

interface Props {
  visible: boolean;
  token?: string;
  wallet: WalletItem | null;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

/**
 * Chỉnh số dư ví trực tiếp (đối soát với tiền thật), KHÔNG tạo giao dịch.
 * Ví thường không được âm; ví credit_card được âm (dư nợ).
 */
export default function EditBalanceModal({ visible, token, wallet, onClose, onSuccess }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canBeNegative = wallet?.type === 'credit_card';

  useEffect(() => {
    if (visible && wallet) {
      setValue(String(wallet.balance));
      setError('');
    }
  }, [visible, wallet]);

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!wallet) return;
    const normalized = value.replace(/[^0-9-]/g, '');
    const balance = Number(normalized);
    if (normalized === '' || normalized === '-' || !Number.isFinite(balance)) return setError('Số dư không hợp lệ.');
    if (balance < 0 && !canBeNegative) return setError('Số dư không được âm (chỉ ví thẻ tín dụng mới được âm).');

    setSubmitting(true);
    setError('');
    try {
      const res = await walletApi.updateWallet(token, (wallet._id || wallet.id) as string, { balance });
      if (res.success) onSuccess(res.data?.balance ?? balance);
      else setError(res.message || 'Không thể cập nhật số dư.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.box}>
            <Text style={styles.title}>Chỉnh số dư ví</Text>
            {wallet && <Text style={styles.sub}>{wallet.name}</Text>}

            <TextInput
              style={styles.input}
              keyboardType={canBeNegative ? 'numbers-and-punctuation' : 'number-pad'}
              value={value}
              onChangeText={(t) => {
                setValue(t);
                setError('');
              }}
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.warning}>
              Thay đổi này không tạo giao dịch. Dùng khi số dư trong app lệch với tiền thực tế.
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.row}>
              <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={submitting}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.save} onPress={handleSave} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Lưu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  sub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 12 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
  },
  warning: { fontSize: 12, color: '#B45309', marginTop: 10, textAlign: 'center' },
  error: { fontSize: 13, color: '#DC2626', marginTop: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancel: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#475569' },
  save: { flex: 2, paddingVertical: 13, borderRadius: 14, backgroundColor: '#0284C7', alignItems: 'center' },
  saveText: { fontWeight: '700', color: '#FFFFFF' },
});
