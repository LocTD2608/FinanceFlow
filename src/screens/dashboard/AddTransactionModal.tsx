import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { THEME } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { TransactionType } from '../../api/transaction';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddTransactionModal({ visible, onClose, onSuccess }: Props) {
  const { token } = useAuthStore();
  const { createTransaction } = useTransactionStore();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const amount = Number(amountStr.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ (> 0 đ).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Dùng default wallet id (nếu chưa chọn ví cụ thể)
      const defaultWalletId = '660000000000000000000010';
      const result = await createTransaction(token || undefined, {
        amount,
        type,
        walletId: defaultWalletId,
        note: note.trim(),
      });

      if (result.success) {
        Alert.alert('Thành công', result.message);
        setAmountStr('');
        setNote('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        Alert.alert('Lỗi', result.message);
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi tạo giao dịch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.indicator} />
          <Text style={styles.title}>Thêm Giao Dịch Mới</Text>
          <Text style={styles.subtitle}>Tự động tính toán cộng / trừ số dư ví</Text>

          {/* Type Toggle: Chi tiêu vs Thu nhập */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'expense' && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
              ]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  type === 'expense' && { color: '#DC2626', fontWeight: '700' },
                ]}
              >
                💸 Tiền Ra (Chi)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'income' && { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
              ]}
              onPress={() => setType('income')}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  type === 'income' && { color: '#16A34A', fontWeight: '700' },
                ]}
              >
                💰 Tiền Vào (Thu)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Số tiền (VNĐ)</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            placeholder="0 đ"
            placeholderTextColor="#94A3B8"
            value={amountStr}
            onChangeText={(t) => {
              const num = t.replace(/[^0-9]/g, '');
              if (!num) {
                setAmountStr('');
              } else {
                setAmountStr(Number(num).toLocaleString('vi-VN') + ' đ');
              }
            }}
          />

          {/* Note input */}
          <Text style={styles.inputLabel}>Ghi chú giao dịch</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ví dụ: Ăn trưa, Đổ xăng, Tiền lương..."
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
          />

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: type === 'expense' ? '#DC2626' : '#16A34A' }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {type === 'expense' ? 'Ghi nhận Chi tiêu (-)' : 'Ghi nhận Thu nhập (+)'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 36,
    ...THEME.shadow,
  },
  indicator: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    ...THEME.shadow,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
