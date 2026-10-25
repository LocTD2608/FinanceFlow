import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import {
  Wallet,
  Plus,
  Bookmark,
  BarChart2,
  Settings,
} from 'lucide-react-native';

export type TabKey = 'finance' | 'payment' | 'cash' | 'save' | 'chart' | 'settings' | 'add';

interface TabItemConfig {
  id: 'finance' | 'cash' | 'save' | 'chart' | 'settings';
  label: string;
  icon: any;
}

const TABS: TabItemConfig[] = [
  { id: 'finance', label: 'Tài chính', icon: Wallet },
  { id: 'cash', label: 'Thêm', icon: Plus },
  { id: 'save', label: 'Lưu', icon: Bookmark },
  { id: 'chart', label: 'Biểu đồ', icon: BarChart2 },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

interface Props {
  activeTab: TabKey;
  onSelectTab: (tab: 'finance' | 'cash' | 'save' | 'chart' | 'settings') => void;
}

export default function AnimatedBottomBar({ activeTab, onSelectTab }: Props) {
  const { width: windowWidth } = Dimensions.get('window');
  const initialBarWidth = Math.min(windowWidth - 40, 440);
  const [barWidth, setBarWidth] = useState(initialBarWidth);

  // Tính chiều rộng mỗi tab
  const usableWidth = Math.max(0, barWidth - 20); // trừ paddingHorizontal 10 mỗi bên
  const tabWidth = usableWidth / TABS.length;

  // Lấy index tab hiện tại
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const effectiveIndex = activeIndex >= 0 ? activeIndex : 0;

  // Animation values cho sliding indicator
  const translateX = useRef(new Animated.Value(effectiveIndex * (initialBarWidth - 20) / 5)).current;
  const indicatorScale = useRef(new Animated.Value(1)).current;
  const prevIndexRef = useRef(effectiveIndex);

  // Icon scale animations cho 5 tab
  const iconScales = useRef(TABS.map(() => new Animated.Value(1))).current;

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - barWidth) > 1) {
      setBarWidth(w);
    }
  };

  useEffect(() => {
    if (activeIndex === -1) return;

    const targetX = activeIndex * tabWidth;
    const isMoving = prevIndexRef.current !== activeIndex;
    prevIndexRef.current = activeIndex;

    if (isMoving) {
      // 1. Hiệu ứng di chuyển mượt mà dạng lò xo (Spring Glide)
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: targetX,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        // Hiệu ứng co giãn nhẹ (Squash & Stretch) khi di chuyển tạo cảm giác sống động
        Animated.sequence([
          Animated.timing(indicatorScale, {
            toValue: 1.14,
            duration: 110,
            useNativeDriver: true,
          }),
          Animated.spring(indicatorScale, {
            toValue: 1,
            friction: 5,
            tension: 120,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // 2. Hiệu ứng nảy nhẹ của icon vừa được chọn
      Animated.sequence([
        Animated.timing(iconScales[activeIndex], {
          toValue: 1.2,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(iconScales[activeIndex], {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateX.setValue(targetX);
    }
  }, [activeIndex, tabWidth, translateX, indicatorScale, iconScales]);

  // Vị trí offset của viên indicator (38x38) căn giữa trong từng ô tab
  const indicatorBaseLeft = 10 + Math.max(0, (tabWidth - 38) / 2);

  return (
    <View style={styles.bottomNavContainer}>
      <View style={styles.bottomNavBar} onLayout={onBarLayout}>
        {/* Sliding Indicator (Màu nền pastel xanh trượt từ nút cũ sang nút mới) */}
        {activeIndex >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slidingIndicator,
              {
                left: indicatorBaseLeft,
                transform: [
                  { translateX },
                  { scale: indicatorScale },
                ],
              },
            ]}
          />
        )}

        {/* 5 Nút Tab */}
        {TABS.map((item, index) => {
          const IconComp = item.icon;
          const isActive = activeIndex === index;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.navItem}
              onPress={() => onSelectTab(item.id)}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.navIconCircle,
                  {
                    transform: [{ scale: iconScales[index] }],
                  },
                ]}
              >
                <IconComp
                  size={21}
                  color={isActive ? '#0F172A' : '#64748B'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </Animated.View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 99,
  },
  bottomNavBar: {
    width: '100%',
    maxWidth: 440,
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  slidingIndicator: {
    position: 'absolute',
    top: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#BAE6FD',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    zIndex: 1,
  },
  navIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
});
