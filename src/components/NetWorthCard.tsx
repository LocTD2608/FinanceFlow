import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { netWorthApi, NetWorthPoint } from '../api/networth';

interface Props {
  token?: string;
  /** Đổi giá trị để tải lại (vd: sau khi nạp tiền) */
  refreshKey?: number;
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

/**
 * Thẻ xu hướng tài sản ròng 6 tháng gần nhất (dữ liệu từ snapshot cuối tháng).
 */
export default function NetWorthCard({ token, refreshKey }: Props) {
  const [points, setPoints] = useState<NetWorthPoint[]>([]);

  useEffect(() => {
    // Chụp tháng hiện tại rồi lấy xu hướng, để thẻ luôn có điểm mới nhất
    (async () => {
      await netWorthApi.snapshot(token);
      setPoints(await netWorthApi.getTrend(token, 6));
    })();
  }, [token, refreshKey]);

  if (!points.length) return null;

  const max = Math.max(...points.map((p) => Math.abs(p.netWorth)), 1);
  const last = points[points.length - 1];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tài sản ròng</Text>
      <Text style={[styles.value, last.netWorth < 0 && { color: '#DC2626' }]}>{fmt(last.netWorth)} đ</Text>
      <Text style={styles.sub}>
        Tài sản {fmt(last.totalAssets)} đ • Nợ {fmt(last.totalLiabilities)} đ
      </Text>
      <View style={styles.bars}>
        {points.map((p) => (
          <View key={p.month} style={styles.barCol}>
            <View
              style={[
                styles.bar,
                { height: Math.max(4, (Math.abs(p.netWorth) / max) * 70), backgroundColor: p.netWorth < 0 ? '#F87171' : '#38BDF8' },
              ]}
            />
            <Text style={styles.barLabel}>{p.month.slice(5)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 14 },
  title: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  value: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96 },
  barCol: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  bar: { width: 22, borderRadius: 6 },
  barLabel: { fontSize: 11, color: '#64748B', marginTop: 4 },
});
