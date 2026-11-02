import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { X, QrCode, Banknote, MessageSquare, RotateCcw } from 'lucide-react-native';

export interface DynamicQRModalProps {
  visible: boolean;
  initialAmount?: number;
  initialNote?: string;
  onClose: () => void;
  onSubmit: (data: { amount: number; note: string }) => void;
}

const QUICK_AMOUNTS = [
  { label: '+50k', value: 50000 },
  { label: '+100k', value: 100000 },
  { label: '+200k', value: 200000 },
  { label: '+500k', value: 50000 },
];

export default function DynamicQRModal({
  visible,
  initialAmount,
  initialNote,
  onClose,
  onSubmit,
}: DynamicQRModalProps) {
  const [amountStr, setAmountStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (initialAmount && initialAmount > 0) {
        setAmountStr(initialAmount.toLocaleString('vi-VN'));
      } else {
        setAmountStr('');
      }
      setNote(initialNote || '');
      setError('');
    }
  }, [visible, initialAmount, initialNote]);

  const handleAmountChange = (text: string) => {
    const raw = text.replace(/[^0-9]/g, '');
    setError('');
    if (!raw) {
      setAmountStr('');
      return;
    }
    const num = parseInt(raw, 10);
    setAmountStr(num.toLocaleString('vi-VN'));
  };

  const handleAddQuickAmount = (val: number) => {
    setError('');
    const currentNum = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10);
    const newTotal = currentNum + val;
    setAmountStr(newTotal.toLocaleString('vi-VN'));
  };

  const handleClearAmount = () => {
    setAmountStr('');
    setError('');
  };

  const handleSubmit = () => {
    const rawNum = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10);
    if (!rawNum || rawNum < 1000) {
      setError('Vui lòng nhập số tiền từ 1.000 đ trở lên.');
      return;
    }
    if (rawNum > 100000000) {
      setError('Số tiền tối đa là 100.000.000 đ.');
      return;
    }

    onSubmit({
      amount: rawNum,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                  <View style={styles.headerIconWrapper}>
                    <QrCode size={20} color="#059669" />
                  </View>
                  <Text style={styles.title}>Tạo mã QR có số tiền</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.description}>
                  Người quét mã sẽ được điền sẵn số tiền và nội dung chuyển tiền này.
                </Text>

                {/* Amount input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <View style={styles.labelWithIcon}>
                      <Banknote size={16} color="#059669" />
                      <Text style={styles.label}>Số tiền nhận (VND)</Text>
                    </View>
                    {amountStr ? (
                      <TouchableOpacity
                        onPress={handleClearAmount}
                        style={styles.clearBtn}
                      >
                        <RotateCcw size={13} color="#94a3b8" />
                        <Text style={styles.clearBtnText}>Đặt lại</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="numeric"
                      value={amountStr}
                      onChangeText={handleAmountChange}
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                    />
                    <Text style={styles.currencyBadge}>đ</Text>
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>

                {/* Quick amount chips */}
                <View style={styles.quickChipsRow}>
                  {QUICK_AMOUNTS.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={styles.chip}
                      onPress={() => handleAddQuickAmount(item.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Note input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelWithIcon}>
                    <MessageSquare size={16} color="#059669" />
                    <Text style={styles.label}>Nội dung chuyển tiền (Tùy chọn)</Text>
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="VD: Tiền ăn tối, Cafe, Tiền phòng..."
                    placeholderTextColor="#94a3b8"
                    maxLength={50}
                  />
                  <Text style={styles.charCount}>{note.length}/50 ký tự</Text>
                </View>
              </ScrollView>

              {/* Action buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitBtnText}>Tạo mã QR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#64748b',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
  },
  inputWrapperError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  amountInput: {
    flex: 1,
    height: 48,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  currencyBadge: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#ef4444',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  submitBtn: {
    flex: 1.6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
