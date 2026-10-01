export const THEME = {
  colors: {
    primary: '#BAE6FD',         // Xanh nhạt Pastel (Button chuẩn Figma)
    primaryHover: '#7DD3FC',
    primaryText: '#0F172A',     // Màu chữ nút
    background: '#FFFFFF',      // Nền trắng tinh khôi
    cardBg: '#FFFFFF',
    cardTint: '#E0F2FE',        // Nền thẻ xanh nhạt màn thành công
    cardBorder: '#E2E8F0',
    inputBg: '#F1F5F9',         // Nền ô input xám nhạt
    textPrimary: '#0F172A',     // Chữ đen đậm
    textSecondary: '#64748B',   // Chữ phụ
    linkText: '#0284C7',        // Chữ liên kết
    error: '#EF4444',           // Lỗi đỏ
    success: '#10B981',         // Thành công xanh lá
  },
  borderRadius: {
    input: 16,
    card: 28,
    button: 30,                 // Nút bo tròn dạng pill
  },
  typography: {
    title: {
      fontSize: 26,
      fontWeight: '700' as const,
      color: '#0F172A',
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: '#64748B',
      lineHeight: 22,
    },
    label: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: '#1E293B',
      marginBottom: 6,
    },
    button: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: '#0F172A',
    },
  },
  shadow: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
};
