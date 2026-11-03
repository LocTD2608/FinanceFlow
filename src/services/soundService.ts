import { Vibration } from 'react-native';

/**
 * Bộ tạo âm thanh chuông ngân hàng chân thực (Banking Chime Synthesizer)
 * Tự tổng hợp sóng âm Sine C6 - E6 (1046.5Hz - 1318.5Hz) tạo tiếng "Ting-Ting"
 * 100% không cần tải file mp3, không phụ thuộc đường truyền internet.
 */

let audioCtx: any = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const soundService = {
  /**
   * Mở khóa AudioContext khi người dùng thao tác đầu tiên trên màn hình
   */
  unlockAudio(): void {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore
    }
  },

  /**
   * Phát âm thanh chuông biến động số dư và rung xúc giác (haptic feedback)
   * @param direction 'in' (tiền vào -> chuông ting-ting 2 nốt cao) hoặc 'out' (tiền ra -> chuông trầm thanh thoát)
   */
  playChime(direction: 'in' | 'out' = 'in'): void {
    // 1. Phản hồi rung haptic trên thiết bị thật
    try {
      if (direction === 'in') {
        Vibration.vibrate([0, 100, 80, 120]);
      } else {
        Vibration.vibrate(100);
      }
    } catch {
      // Ignore
    }

    // 2. Phát âm thanh ngân chuông qua Web Audio
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (direction === 'in') {
        // 🔔 Nốt 1: C6 (1046.5Hz) - Tiếng "Ting" đầu tiên
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1046.5, now);
        gain1.gain.setValueAtTime(0.35, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // 🔔 Nốt 2: E6 (1318.5Hz) - Tiếng "Ting" thứ hai ngân vang lảnh lót
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const t2 = now + 0.09;
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.5, t2);
        gain2.gain.setValueAtTime(0.4, t2);
        gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(t2);
        osc2.stop(t2 + 0.45);
      } else {
        // 🔔 Tiền ra (-): Nốt A5 (880Hz) xác nhận trừ tiền êm dịu
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // Bỏ qua lỗi nếu môi trường không hỗ trợ Web Audio
    }
  },
};
