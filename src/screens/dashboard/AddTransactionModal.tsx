import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAuthStore } from '../../store/useAuthStore';
import { useTransactionStore } from '../../store/useTransactionStore';
import { TransactionType } from '../../api/transaction';
import { walletApi, WalletItem } from '../../api/wallet';
import { categoryApi, CategoryItemData } from '../../api/category';
import TopupModal from '../../components/TopupModal';

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

  const [wallet, setWallet] = useState<WalletItem | null>(null);
  const [categories, setCategories] = useState<CategoryItemData[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [topupVisible, setTopupVisible] = useState(false);
  const [shortfall, setShortfall] = useState(0);

  // Ví mặc định thật từ server (không dùng id cứng)
  useEffect(() => {
    if (!visible) return;
    walletApi.getDefaultWallet(token || undefined).then(setWallet);
  }, [visible, token]);

  // Danh mục theo loại giao dịch
  useEffect(() => {
    if (!visible) return;
    setCategoryId('');
    const kind = type === 'income' ? 'income' : 'expense';
    categoryApi.getCategories(token || undefined, kind).then((res) => {
      if (res?.success && Array.isArray(res.data)) setCategories(res.data);
    });
  }, [visible, type, token]);

  const selectedCategory = categories.find((c) => (c._id || c.id) === categoryId);
  const noteRequired = !!selectedCategory && /^Khác/.test(selectedCategory.name);

  const resetForm = () => {
    setAmountStr('');
    setNote('');
    setCategoryId('');
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const amount = Number(amountStr.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ (> 0 đ).');
      return;
    }
    if (!categoryId) {
      Alert.alert('Lỗi', 'Vui lòng chọn danh mục.');
      return;
    }
    if (noteRequired && (!note.trim() || note.trim().length > 50)) {
      Alert.alert('Lỗi', 'Danh mục "Khác" bắt buộc ghi chú (tối đa 50 ký tự).');
      return;
    }
    if (!wallet) {
      Alert.alert('Lỗi', 'Chưa tải được ví. Vui lòng thử lại.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createTransaction(token || undefined, {
        amount,
        type,
        walletId: (wallet._id || wallet.id) as string,
        categoryId,
        note: note.trim(),
        transactionDate: new Date().toISOString(),
      });

      if (result.success) {
        Alert.alert('Thành công', result.message);
        resetForm();
        onClose();
        if (onSuccess) onSuccess();
      } else if (result.code === 'INSUFFICIENT_BALANCE') {
        const missing = result.shortfall ?? amount;
        if (typeof result.currentBalance === 'number') setWallet({ ...wallet, balance: result.currentBalance });
        setShortfall(missing);
        Alert.alert(
          'Số dư không đủ',
          `Ví còn thiếu ${missing.toLocaleString('vi-VN')} đ. Bạn có muốn nạp thêm không?`,
          [
            {
              text: 'Hủy',
              style: 'cancel',
              onPress: () => {
                resetForm();
                onClose();
              },
            },
            { text: 'Nạp thêm', onPress: () => setTopupVisible(true) },
          ]
        );
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheetContainer}>
                {/* Header thanh kéo & Nút đóng */}
                <View style={styles.headerRow}>
                  <View style={styles.headerSpacer} />
                  <View style={styles.indicator} />
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
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

                  {!!wallet && (
                    <Text style={styles.walletInfo}>
                      {wallet.name} • Số dư {wallet.balance.toLocaleString('vi-VN')} đ
                    </Text>
                  )}

                  {/* Danh mục */}
                  <Text style={styles.inputLabel}>Danh mục</Text>
                  <View style={styles.chipRow}>
                    {categories.map((c) => {
                      const id = (c._id || c.id) as string;
                      const active = id === categoryId;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setCategoryId(id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Amount input & Toolbar Ẩn bàn phím */}
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Số tiền (VNĐ)</Text>
                    <TouchableOpacity
                      style={styles.hideKeyBtn}
                      onPress={Keyboard.dismiss}
                      activeOpacity={0.7}
                    >
                      <Check size={14} color="#0284C7" />
                      <Text style={styles.hideKeyText}>Xong / Ẩn phím</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.amountInput}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
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
                  <Text style={styles.inputLabel}>Ghi chú giao dịch{noteRequired ? ' *' : ''}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ví dụ: Ăn trưa, Đổ xăng, Tiền lương..."
                    placeholderTextColor="#94A3B8"
                    value={note}
                    onChangeText={setNote}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
                      <Text style={styles.cancelBtnText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.submitBtn,
                        { backgroundColor: type === 'expense' ? '#DC2626' : '#16A34A' },
                      ]}
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
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <TopupModal
        visible={topupVisible}
        token={token || undefined}
        wallet={wallet}
        suggestedAmount={shortfall}
        onClose={() => setTopupVisible(false)}
        onSuccess={(newBalance) => {
          setTopupVisible(false);
          if (wallet) setWallet({ ...wallet, balance: newBalance });
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
    ...THEME.shadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerSpacer: {
    width: 24,
  },
  indicator: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
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
    marginBottom: 16,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  walletInfo: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  hideKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  hideKeyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
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
    marginBottom: 22,
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
