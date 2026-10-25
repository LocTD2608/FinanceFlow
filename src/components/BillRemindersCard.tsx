import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { billReminderApi, BillReminderItem } from '../api/billReminder';
import { walletApi, WalletItem } from '../api/wallet';

interface Props {
  token?: string;
  wallet: WalletItem | null;
  /** Gọi khi số dư ví đã đổi (đã trả hóa đơn) */
  onPaid?: () => void;
  /** Thiếu số dư khi trả hóa đơn: để màn cha mở form nạp tiền */
  onInsufficient?: (shortfall: number) => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// Nhập ngày dạng DD/MM/YYYY -> ISO (12:00 giờ VN để tránh lệch ngày theo múi giờ)
const parseDate = (text: string): string | null => {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 5, 0, 0));
  return date.getUTCDate() === Number(d) ? date.toISOString() : null;
};

const CYCLES: { id: BillReminderItem['repeatCycle']; label: string }[] = [
  { id: 'monthly', label: 'Hàng tháng' },
  { id: 'weekly', label: 'Hàng tuần' },
  { id: 'none', label: 'Một lần' },
];

/**
 * Danh sách nhắc hóa đơn: thêm, trả từ ví, xóa. Thông báo đẩy do server gửi (3 ngày / 1 ngày / đến hạn / quá hạn).
 */
export default function BillRemindersCard({ token, wallet, onPaid, onInsufficient }: Props) {
  const [bills, setBills] = useState<BillReminderItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [cycle, setCycle] = useState<BillReminderItem['repeatCycle']>('monthly');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await billReminderApi.list(token, 'pending');
    if (res.success) setBills(res.data);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = Number(amount.replace(/[^0-9]/g, ''));
    const dueIso = parseDate(due);
    if (!title.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập tên hóa đơn.');
    if (!amt) return Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ.');
    if (!dueIso) return Alert.alert('Lỗi', 'Ngày đến hạn theo dạng DD/MM/YYYY.');
    setBusy(true);
    const res = await billReminderApi.create(token, { title: title.trim(), amount: amt, dueDate: dueIso, repeatCycle: cycle });
    setBusy(false);
    if (!res.success) return Alert.alert('Lỗi', res.message || 'Không thể thêm nhắc hóa đơn.');
    setTitle('');
    setAmount('');
    setDue('');
    setAdding(false);
    load();
  };

  const handlePay = async (bill: BillReminderItem) => {
    if (!wallet) return Alert.alert('Lỗi', 'Chưa tải được ví.');
    setBusy(true);
    const res = await billReminderApi.pay(token, bill._id, (wallet._id || wallet.id) as string);
    setBusy(false);
    if (res.success) {
      load();
      onPaid?.();
    } else if (res.code === 'INSUFFICIENT_BALANCE') {
      const missing = res.shortfall ?? bill.amount;
      Alert.alert('Số dư không đủ', `Ví còn thiếu ${missing.toLocaleString('vi-VN')} đ. Bạn có muốn nạp thêm không?`, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Nạp thêm', onPress: () => onInsufficient?.(missing) },
      ]);
    } else {
      Alert.alert('Lỗi', res.message || 'Không thể thanh toán hóa đơn.');
    }
  };

  const handleDelete = (bill: BillReminderItem) =>
    Alert.alert('Xóa nhắc hóa đơn', `Xóa "${bill.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const res = await billReminderApi.remove(token, bill._id);
          if (res.success) load();
          else Alert.alert('Lỗi', res.message || 'Không thể xóa.');
        },
      },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Nhắc hóa đơn</Text>
        <TouchableOpacity onPress={() => setAdding((v) => !v)}>
          <Text style={styles.link}>{adding ? 'Đóng' : '+ Thêm'}</Text>
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Tên hóa đơn (vd: Tiền điện)" value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder="Số tiền" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder="Ngày đến hạn (DD/MM/YYYY)" value={due} onChangeText={setDue} />
          <View style={styles.cycleRow}>
            {CYCLES.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.chip, cycle === c.id && styles.chipActive]} onPress={() => setCycle(c.id)}>
                <Text style={[styles.chipText, cycle === c.id && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primary} onPress={handleAdd} disabled={busy}>
            <Text style={styles.primaryText}>Lưu nhắc nhở</Text>
          </TouchableOpacity>
        </View>
      )}

      {!bills.length && !adding && <Text style={styles.empty}>Chưa có hóa đơn nào cần nhắc.</Text>}

      {bills.map((b) => (
        <View key={b._id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{b.title}</Text>
            <Text style={styles.itemSub}>
              {b.amount.toLocaleString('vi-VN')} đ • Hạn {fmtDate(b.dueDate)}
              {new Date(b.dueDate).getTime() < Date.now() ? ' • Quá hạn' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(b)} disabled={busy}>
            <Text style={styles.payText}>Trả</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(b)} style={{ marginLeft: 10 }}>
            <Text style={styles.delete}>Xóa</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  link: { color: '#0284C7', fontWeight: '700' },
  empty: { color: '#64748B', fontSize: 13 },
  form: { marginBottom: 8 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    color: '#0F172A',
  },
  cycleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#E0F2FE', borderColor: '#0284C7' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#0369A1' },
  primary: { backgroundColor: '#0284C7', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  itemSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  payBtn: { backgroundColor: '#DCFCE7', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  payText: { color: '#15803D', fontWeight: '700' },
  delete: { color: '#DC2626', fontWeight: '600' },
});
