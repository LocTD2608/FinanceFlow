import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  Zap,
  ZapOff,
  Image as ImageIcon,
  Search,
  Camera,
  CameraOff,
  User,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react-native';
import { parseQRPayload } from '../../utils/qrPayload';
import { p2pApi, P2PRecipient } from '../../api/p2p';

export interface ScanQRTabProps {
  token?: string;
  onSelectRecipient: (
    recipient: P2PRecipient,
    amount?: number,
    note?: string
  ) => void;
}

const SCAN_BOX_SIZE = 230;

export default function ScanQRTab({ token, onSelectRecipient }: ScanQRTabProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Animated laser line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [laserAnim]);

  const handleBarcodeScanned = (rawData: string) => {
    if (isScanned) return;
    setIsScanned(true);

    const result = parseQRPayload(rawData);
    if (!result.valid || !result.data) {
      Alert.alert(
        'Mã QR không hợp lệ',
        result.error || 'Mã QR không thuộc hệ thống FinanceFlow hoặc không hợp lệ.',
        [
          {
            text: 'Quét lại',
            onPress: () => {
              setIsScanned(false);
            },
          },
        ]
      );
      return;
    }

    const payload = result.data;
    const recipient: P2PRecipient = {
      id: payload.recipientId,
      _id: payload.recipientId,
      username: payload.username,
      nickname: payload.nickname,
      phone: payload.phone,
    };

    onSelectRecipient(recipient, payload.amount, payload.note);
  };

  const handlePickImage = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      try {
        const scannedResults = await scanFromURLAsync(asset.uri, ['qr']);
        if (scannedResults && scannedResults.length > 0 && scannedResults[0].data) {
          handleBarcodeScanned(scannedResults[0].data);
        } else {
          Alert.alert(
            'Không tìm thấy mã QR',
            'Không phát hiện mã QR nào trong hình ảnh đã chọn. Vui lòng chọn ảnh rõ nét hơn.'
          );
        }
      } catch {
        Alert.alert(
          'Không thể quét ảnh',
          'Thiết bị chưa hỗ trợ quét trực tiếp từ ảnh trong thư viện. Bạn có thể sử dụng Camera trực tiếp hoặc tìm kiếm người nhận bằng số điện thoại/username.'
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh lúc này.');
    }
  };

  const handleManualSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      Alert.alert('Thông báo', 'Vui lòng nhập SĐT, Username hoặc Email người nhận.');
      return;
    }

    // Check if the query is a raw JSON payload pasted into search bar
    if (q.startsWith('{') && q.includes('FinanceFlow')) {
      handleBarcodeScanned(q);
      return;
    }

    setIsSearching(true);
    try {
      const res = await p2pApi.lookupRecipient(token, q);
      if (res.success && (res.data || res.recipient)) {
        const target = res.data || res.recipient!;
        onSelectRecipient(target);
      } else {
        Alert.alert('Không tìm thấy', res.message || 'Không tìm thấy người nhận phù hợp.');
      }
    } catch {
      Alert.alert('Lỗi kết nối', 'Không thể tra cứu thông tin người nhận lúc này.');
    } finally {
      setIsSearching(false);
    }
  };

  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_BOX_SIZE - 4],
  });

  return (
    <View style={styles.container}>
      {/* Camera Viewport or Permission Request */}
      <View style={styles.cameraCard}>
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <View style={styles.permissionIconCircle}>
              <CameraOff size={36} color="#059669" />
            </View>
            <Text style={styles.permissionTitle}>Cần cấp quyền Camera</Text>
            <Text style={styles.permissionDesc}>
              FinanceFlow cần quyền truy cập camera để quét mã QR thanh toán nhanh chóng và chính xác.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Camera size={18} color="#ffffff" />
              <Text style={styles.permissionButtonText}>Cấp quyền truy cập Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={isTorchOn}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={(result) => {
                if (!isScanned && result.data) {
                  handleBarcodeScanned(result.data);
                }
              }}
            />

            {/* Dark Mask Overlay around cutout */}
            <View style={styles.overlay}>
              <View style={styles.scanTarget}>
                {/* 4 Illuminated Glowing Corners */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated Laser Beam */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      transform: [{ translateY }],
                    },
                  ]}
                />
              </View>

              <Text style={styles.scanHint}>
                Căn chỉnh mã QR vào khung ngắm để chuyển tiền
              </Text>
            </View>

            {/* Quick Tools on Camera */}
            <View style={styles.cameraToolbar}>
              <TouchableOpacity
                style={[styles.toolBtn, isTorchOn && styles.toolBtnActive]}
                onPress={() => setIsTorchOn(!isTorchOn)}
                activeOpacity={0.8}
              >
                {isTorchOn ? (
                  <Zap size={20} color="#059669" />
                ) : (
                  <ZapOff size={20} color="#ffffff" />
                )}
                <Text style={[styles.toolText, isTorchOn && styles.toolTextActive]}>
                  {isTorchOn ? 'Bật đèn' : 'Tắt đèn'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolBtn}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <ImageIcon size={20} color="#ffffff" />
                <Text style={styles.toolText}>Chọn ảnh</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Manual Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchHeader}>
          <User size={16} color="#059669" />
          <Text style={styles.searchTitle}>Hoặc tìm kiếm người nhận</Text>
        </View>

        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Nhập SĐT, Username hoặc Email..."
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            onSubmitEditing={handleManualSearch}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.searchSubmitBtn}
            onPress={handleManualSearch}
            disabled={isSearching}
            activeOpacity={0.8}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <ArrowRight size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Search Suggestions */}
        <View style={styles.quickSuggestRow}>
          <Text style={styles.quickSuggestLabel}>Gợi ý nhanh:</Text>
          {['alice', 'bob', 'demo_user'].map((name) => (
            <TouchableOpacity
              key={name}
              style={styles.suggestChip}
              onPress={() => {
                setSearchQuery(name);
              }}
            >
              <Text style={styles.suggestChipText}>@{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  cameraCard: {
    width: '100%',
    maxWidth: 420,
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  scanTarget: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#10b981',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  laserLine: {
    height: 3,
    width: '100%',
    backgroundColor: '#34d399',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  scanHint: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraToolbar: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  toolBtnActive: {
    backgroundColor: '#ffffff',
  },
  toolText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  toolTextActive: {
    color: '#059669',
  },
  searchSection: {
    width: '100%',
    maxWidth: 420,
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingLeft: 12,
    paddingRight: 6,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
  },
  searchSubmitBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  quickSuggestLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  suggestChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  suggestChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});
