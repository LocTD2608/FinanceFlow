import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, CalendarPlus, RotateCcw } from 'lucide-react-native';
import { goalApi, PendingDecisionGoal } from '../api/goal';

interface Props {
  visible: boolean;
  goal: PendingDecisionGoal | null;
  token: string | null;
  onResolved: (goalId: string) => void;
}

const EXTENSION_DAYS = [7, 14, 30] as const;

export default function GoalOverdueDecisionModal({ visible, goal, token, onResolved }: Props) {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [submitting, setSubmitting] = useState<'extend' | 'close' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewDeadline = useMemo(() => {
    const d = new Date(Date.now() + selectedDays * 86400000);
    return d.toLocaleDateString('vi-VN');
  }, [selectedDays]);

  if (!visible || !goal) return null;

  const handleExtend = async () => {
    if (!token || submitting) return;
    setSubmitting('extend');
    setErrorMsg(null);
    try {
      const nextDate = new Date(Date.now() + selectedDays * 86400000).toISOString();
      await goalApi.extendGoal(token, goal._id, nextDate);
      onResolved(goal._id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gia hạn mục tiêu thất bại.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleStopAndRefund = async () => {
    if (!token || submitting) return;
    setSubmitting('close');
    setErrorMsg(null);
    try {
      await goalApi.expireCloseGoal(token, goal._id);
      onResolved(goal._id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Hoàn tiền và đóng mục tiêu thất bại.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Bắt buộc chọn Gia hạn tiếp hoặc Dừng gia hạn (KAN-70)
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <AlertTriangle size={28} color="#D97706" />
          </View>

          <Text style={styles.title}>Mục tiêu đã hết hạn</Text>
          <Text style={styles.subtitle}>
            Mục tiêu <Text style={styles.bold}>{goal.name}</Text> đã quá hạn hơn 24 giờ. Vui lòng
            chọn tiếp tục gia hạn hoặc dừng để hoàn 100% tiền về ví chính.
          </Text>

          <View style={styles.summaryBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Đã tiết kiệm</Text>
              <Text style={styles.value}>
                {(goal.currentAmount || 0).toLocaleString('vi-VN')} đ
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Mục tiêu</Text>
              <Text style={styles.value}>
                {(goal.targetAmount || 0).toLocaleString('vi-VN')} đ
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Hoàn nếu dừng</Text>
              <Text style={styles.refundValue}>
                {(goal.currentAmount || 0).toLocaleString('vi-VN')} đ (100% - 0 đ phí)
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Chọn thời gian gia hạn ({previewDeadline}):</Text>
          <View style={styles.chipRow}>
            {EXTENSION_DAYS.map((days) => {
              const active = selectedDays === days;
              return (
                <TouchableOpacity
                  key={days}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedDays(days)}
                  disabled={!!submitting}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    +{days} ngày
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.disabledBtn]}
            onPress={handleExtend}
            disabled={!!submitting}
          >
            {submitting === 'extend' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <CalendarPlus size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Gia hạn tiếp (+{selectedDays} ngày)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, submitting && styles.disabledBtn]}
            onPress={handleStopAndRefund}
            disabled={!!submitting}
          >
            {submitting === 'close' ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <>
                <RotateCcw size={18} color="#DC2626" />
                <Text style={styles.secondaryBtnText}>
                  Dừng gia hạn (Hoàn 100% về ví chính)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#64748B',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  refundValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#4338CA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 13,
  },
  secondaryBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
