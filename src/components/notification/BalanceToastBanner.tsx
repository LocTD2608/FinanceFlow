import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
  BellRing,
} from 'lucide-react-native';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const { width } = Dimensions.get('window');

export default function BalanceToastBanner() {
  const { currentNotification, dismiss } = useNotificationStore();
  const { toastEnabled } = useSettingsStore();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (currentNotification && toastEnabled) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Slide down
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: Platform.OS === 'web' ? 16 : 48,
          useNativeDriver: true,
          bounciness: 6,
          speed: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 4 seconds
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 4000);
    } else {
      translateY.setValue(-150);
      opacity.setValue(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentNotification, toastEnabled]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismiss();
    });
  };

  if (!currentNotification || !toastEnabled) return null;

  const isIncome = currentNotification.direction === 'in';
  const formattedAmount = (currentNotification.amount || 0).toLocaleString('vi-VN') + ' đ';
  const formattedBalance =
    currentNotification.newBalance !== undefined
      ? `Số dư: ${currentNotification.newBalance.toLocaleString('vi-VN')} đ`
      : '';

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.toastCard, isIncome ? styles.toastIncome : styles.toastExpense]}
        activeOpacity={0.9}
        onPress={handleDismiss}
      >
        {/* Left Icon Badge */}
        <View style={[styles.iconBadge, isIncome ? styles.iconBadgeIncome : styles.iconBadgeExpense]}>
          {isIncome ? (
            <ArrowDownLeft size={22} color="#10B981" />
          ) : (
            <ArrowUpRight size={22} color="#EF4444" />
          )}
        </View>

        {/* Content */}
        <View style={styles.contentCol}>
          <View style={styles.topRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <BellRing size={12} color={isIncome ? '#10B981' : '#EF4444'} />
              <Text style={styles.titleText}>
                {isIncome ? 'Biến động số dư (+)' : 'Biến động số dư (-)'}
              </Text>
            </View>
            <Text style={styles.timeText}>Vừa xong</Text>
          </View>

          {/* Amount */}
          <Text style={[styles.amountText, isIncome ? styles.amountIncome : styles.amountExpense]}>
            {isIncome ? `+ ${formattedAmount}` : `- ${formattedAmount}`}
          </Text>

          {/* Details: Wallet name & new balance */}
          <View style={styles.detailsRow}>
            <Text style={styles.walletText} numberOfLines={1}>
              {currentNotification.walletName || 'Ví mặc định'}
            </Text>
            {formattedBalance ? (
              <Text style={styles.balanceText} numberOfLines={1}>
                • {formattedBalance}
              </Text>
            ) : null}
          </View>

          {currentNotification.note ? (
            <Text style={styles.noteText} numberOfLines={1}>
              {currentNotification.note}
            </Text>
          ) : null}
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={16} color="#64748B" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toastCard: {
    width: Math.min(width - 32, 420),
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
  },
  toastIncome: {
    borderColor: '#A7F3D0',
    borderLeftWidth: 5,
    borderLeftColor: '#10B981',
  },
  toastExpense: {
    borderColor: '#FECACA',
    borderLeftWidth: 5,
    borderLeftColor: '#EF4444',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBadgeIncome: {
    backgroundColor: '#D1FAE5',
  },
  iconBadgeExpense: {
    backgroundColor: '#FEE2E2',
  },
  contentCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '900',
    marginVertical: 2,
  },
  amountIncome: {
    color: '#059669',
  },
  amountExpense: {
    color: '#DC2626',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  walletText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  balanceText: {
    fontSize: 12,
    color: '#64748B',
  },
  noteText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
});
