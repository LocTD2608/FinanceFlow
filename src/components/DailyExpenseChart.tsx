import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { reportApi, DailySeriesItem } from '../api/report';

interface Props {
  token?: string;
  monthStr: string; // YYYY-MM
  onMonthChange?: (newMonthStr: string) => void;
  refreshKey?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DailyExpenseChart({ token, monthStr, refreshKey }: Props) {
  const [reportType, setReportType] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<DailySeriesItem[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const scrollRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setLoading(true);
      try {
        const res = await reportApi.getDailyReport(token, {
          month: monthStr,
          type: reportType,
        });
        if (isMounted && res.success && res.data) {
          setSeries(res.data.series || []);
          setTotal(res.data.total || 0);
          setAverage(res.data.average || 0);
          // Mặc định chọn ngày hôm nay nếu thuộc tháng đang xem, hoặc ngày có chi tiêu gần nhất
          const [year, monthNum] = monthStr.split('-').map(Number);
          const now = new Date();
          if (now.getFullYear() === year && now.getMonth() + 1 === monthNum) {
            setSelectedDay(now.getDate());
          } else {
            const firstActive = res.data.series.find((s) => s.amount > 0);
            setSelectedDay(firstActive ? firstActive.day : 1);
          }
        }
      } catch (err) {
        console.error('Failed to load daily report', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReport();
    return () => {
      isMounted = false;
    };
  }, [token, monthStr, reportType, refreshKey]);

  const formatCurrency = (val: number) => {
    return Math.round(val).toLocaleString('vi-VN');
  };

  // Tính toán kích thước SVG
  const DAY_WIDTH = 38;
  const CHART_HEIGHT = 190;
  const PADDING_TOP = 40;
  const PADDING_BOTTOM = 30;
  const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const maxAmount = useMemo(() => {
    const m = Math.max(...series.map((s) => s.amount), 0);
    return m > 0 ? m * 1.15 : 100000;
  }, [series]);

  const svgWidth = Math.max(series.length * DAY_WIDTH + 20, SCREEN_WIDTH - 60);

  // Tính toạ độ các điểm
  const points = useMemo(() => {
    return series.map((s, idx) => {
      const x = 16 + idx * DAY_WIDTH;
      const ratio = maxAmount > 0 ? s.amount / maxAmount : 0;
      const y = PADDING_TOP + PLOT_HEIGHT * (1 - ratio);
      return { x, y, day: s.day, amount: s.amount, date: s.date };
    });
  }, [series, maxAmount, PLOT_HEIGHT]);

  // Tạo path đường nối
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  // Toạ độ đường trung bình
  const avgY = useMemo(() => {
    if (maxAmount <= 0) return PADDING_TOP + PLOT_HEIGHT;
    const ratio = Math.min(1, average / maxAmount);
    return PADDING_TOP + PLOT_HEIGHT * (1 - ratio);
  }, [average, maxAmount, PLOT_HEIGHT]);

  const selectedPoint = points.find((p) => p.day === selectedDay) || null;

  // Cuộn đến ngày được chọn khi dữ liệu load
  useEffect(() => {
    if (selectedDay && points.length > 0 && scrollRef.current) {
      const idx = points.findIndex((p) => p.day === selectedDay);
      if (idx > 4) {
        scrollRef.current.scrollTo({ x: (idx - 2) * DAY_WIDTH, animated: true });
      }
    }
  }, [selectedDay, points]);

  return (
    <View style={styles.cardContainer}>
      {/* Header card: Tổng tiền & Switch Chi tiêu / Thu nhập */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.titleLabel}>
            {reportType === 'expense' ? 'Chi Tiêu: ' : 'Thu Nhập: '}
            <Text style={styles.highlightAmount}>đ{formatCurrency(total)}</Text>
          </Text>
          <Text style={styles.subLabel}>
            Trung bình: <Text style={styles.avgAmount}>đ{formatCurrency(average)}</Text>
          </Text>
        </View>

        {/* Nút chuyển đổi Chi Tiêu ⇄ Thu Nhập */}
        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setReportType((prev) => (prev === 'expense' ? 'income' : 'expense'))}
          activeOpacity={0.8}
        >
          <Text style={styles.switchText}>
            {reportType === 'expense' ? 'Chi Tiêu ⇄' : 'Thu Nhập ⇄'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#0284C7" size="small" />
          <Text style={styles.loadingText}>Đang tải dữ liệu ngày...</Text>
        </View>
      ) : series.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Chưa có dữ liệu giao dịch trong tháng.</Text>
        </View>
      ) : (
        <View style={styles.chartWrapper}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 30 }}
          >
            <Svg width={svgWidth} height={CHART_HEIGHT}>
              {/* Lưới ngang nét đứt */}
              {[0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
                const y = PADDING_TOP + PLOT_HEIGHT * (1 - ratio);
                return (
                  <Line
                    key={`grid-${i}`}
                    x1={0}
                    y1={y}
                    x2={svgWidth}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Trục đáy y = 0 */}
              <Line
                x1={0}
                y1={PADDING_TOP + PLOT_HEIGHT}
                x2={svgWidth}
                y2={PADDING_TOP + PLOT_HEIGHT}
                stroke="#CBD5E1"
                strokeWidth={1}
              />

              {/* Đường trung bình nét đứt màu vàng */}
              {average > 0 && (
                <>
                  <Line
                    x1={0}
                    y1={avgY}
                    x2={svgWidth}
                    y2={avgY}
                    stroke="#D97706"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                  <SvgText
                    x={8}
                    y={avgY - 4}
                    fill="#D97706"
                    fontSize={10}
                    fontWeight="bold"
                  >
                    TB: {formatCurrency(average)}
                  </SvgText>
                </>
              )}

              {/* Đường nét đứt dọc khi chọn ngày */}
              {selectedPoint && (
                <Line
                  x1={selectedPoint.x}
                  y1={PADDING_TOP}
                  x2={selectedPoint.x}
                  y2={PADDING_TOP + PLOT_HEIGHT}
                  stroke="#0284C7"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}

              {/* Đường line biểu đồ chính màu cam vàng */}
              <Path
                d={linePath}
                fill="none"
                stroke="#0284C7"
                strokeWidth={2.5}
              />

              {/* Các điểm tròn (dots) và nhãn ngày (chỉ vẽ SVG thuần túy) */}
              {points.map((pt) => {
                const isSelected = pt.day === selectedDay;
                return (
                  <React.Fragment key={`pt-${pt.day}`}>
                    {/* Chấm tròn biểu diễn điểm */}
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? '#0284C7' : '#FFFFFF'}
                      stroke={isSelected ? '#FFFFFF' : '#0284C7'}
                      strokeWidth={isSelected ? 2.5 : 1.8}
                    />

                    {/* Số ngày trên trục hoành */}
                    <SvgText
                      x={pt.x}
                      y={CHART_HEIGHT - 8}
                      fill={isSelected ? '#0284C7' : '#64748B'}
                      fontSize={11}
                      fontWeight={isSelected ? '900' : '600'}
                      textAnchor="middle"
                    >
                      {pt.day}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Vùng chạm/click tương tác cho từng ngày (Hoạt động mượt mà trên cả Web & Mobile, tránh lỗi WebShape) */}
            {points.map((pt) => (
              <TouchableOpacity
                key={`touch-${pt.day}`}
                activeOpacity={0.6}
                style={[
                  styles.dayTouchTarget,
                  {
                    left: Math.max(0, pt.x - DAY_WIDTH / 2),
                    width: DAY_WIDTH,
                  },
                ]}
                onPress={() => setSelectedDay(pt.day)}
              />
            ))}

            {/* Tooltip hiển thị số tiền nổi trên điểm được chọn */}
            {selectedPoint && (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltipBadge,
                  {
                    left: Math.max(0, selectedPoint.x - 45),
                    top: Math.max(4, selectedPoint.y - 34),
                  },
                ]}
              >
                <Text style={styles.tooltipText}>
                  đ{formatCurrency(selectedPoint.amount)}
                </Text>
              </View>
            )}
          </ScrollView>

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  highlightAmount: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 16,
  },
  subLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  avgAmount: {
    color: '#D97706',
    fontWeight: '700',
  },
  switchButton: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  chartWrapper: {
    position: 'relative',
    marginTop: 6,
  },
  dayTouchTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 2,
  },
  tooltipBadge: {
    position: 'absolute',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
  },
});
