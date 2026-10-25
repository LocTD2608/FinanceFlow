import React, { useEffect, useMemo, useState } from 'react';
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
  ScrollView,
  Keyboard,
} from 'react-native';
import { categoryApi, CategoryItemData } from '../api/category';
import { walletApi, WalletItem } from '../api/wallet';

// Danh mục nạp tiền cho phép chọn (theo thứ tự hiển thị). "Lương" là mặc định.
export const TOPUP_CATEGORY_NAMES = ['Lương', 'Thưởng', 'Công việc phụ', 'Vay mượn', 'Đầu tư', 'Kinh doanh', 'Khác'];
const NOTE_MAX = 50;
const AMOUNT_MAX = 100000000;

interface Props {
  visible: boolean;
  token?: string;
  wallet: Pick<WalletItem, '_id' | 'id' | 'name' | 'balance'> | null;
  /** Số tiền gợi ý điền sẵn (vd: số tiền còn thiếu) */
  suggestedAmount?: number;
  onClose: () => void;
  /** Gọi sau khi nạp thành công, kèm số dư mới của ví */
  onSuccess: (newBalance: number) => void;
}

const matchName = (cat: CategoryItemData, label: string) =>
  label === 'Khác' ? /^Khác/.test(cat.name) : cat.name === label;

export default function TopupModal({ visible, token, wallet, suggestedAmount, onClose, onSuccess }: Props) {
  const [categories, setCategories] = useState<CategoryItemData[]>([]);
  const [selected, setSelected] = useState<string>('Lương');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected('Lương');
    setNote('');
    setError('');
    setAmountStr(suggestedAmount && suggestedAmount > 0 ? suggestedAmount.toLocaleString('vi-VN') : '');
    categoryApi.getCategories(token, 'income').then((res) => {
      if (res?.success && Array.isArray(res.data)) setCategories(res.data);
    });
  }, [visible, suggestedAmount, token]);

  const options = useMemo(
    () => TOPUP_CATEGORY_NAMES.map((label) => ({ label, cat: categories.find((c) => matchName(c, label)) })),
    [categories]
  );

  const needsNote = selected === 'Khác';

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!wallet) return;
    const amount = Number(amountStr.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) return setError('Vui lòng nhập số tiền hợp lệ (> 0 đ).');
    if (amount > AMOUNT_MAX) return setError('Mỗi lần nạp tối đa 100.000.000 đ.');
    if (needsNote && !note.trim()) return setError('Vui lòng nhập ghi chú khi chọn danh mục "Khác".');

    const cat = options.find((o) => o.label === selected)?.cat;
    setSubmitting(true);
    setError('');
    try {
      const res = await walletApi.topupWallet(token, (wallet._id || wallet.id) as string, {
        amount,
        categoryId: cat ? cat._id || cat.id : undefined, // không chọn -> server dùng "Lương"
        note: note.trim() || undefined,
      });
      if (res.success) {
        const newBalance = res.data?.wallet?.balance ?? wallet.balance + amount;
        onSuccess(newBalance);
      } else {
        setError(res.message || 'Không thể nạp tiền.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Nạp tiền vào ví</Text>
              {wallet && (
                <Text style={styles.subtitle}>
                  {wallet.name} • Số dư hiện tại {wallet.balance.toLocaleString('vi-VN')} đ
                </Text>
              )}

              <Text style={styles.label}>Số tiền (VNĐ)</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="number-pad"
                placeholder="0 đ"
                placeholderTextColor="#94A3B8"
                value={amountStr}
                onChangeText={(t) => {
                  const num = t.replace(/[^0-9]/g, '');
                  setAmountStr(num ? Number(num).toLocaleString('vi-VN') + ' đ' : '');
                  setError('');
                }}
              />

              <Text style={styles.label}>Danh mục</Text>
              <View style={styles.chipRow}>
                {options.map(({ label }) => {
                  const active = selected === label;
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        setSelected(label);
                        setError('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Ghi chú{needsNote ? ' *' : ' (tuỳ chọn)'}</Text>
              <TextInput
                style={[styles.noteInput, needsNote && !note.trim() && error ? styles.inputError : null]}
                placeholder={needsNote ? 'Nhập lý do (bắt buộc)' : 'Ví dụ: Lương tháng 10'}
                placeholderTextColor="#94A3B8"
                value={note}
                maxLength={NOTE_MAX}
                onChangeText={(t) => {
                  setNote(t);
                  setError('');
                }}
              />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Nạp tiền (+)</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 2, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 4 },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#15803D', fontWeight: '700' },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#DC2626', fontSize: 13, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#16A34A', alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
