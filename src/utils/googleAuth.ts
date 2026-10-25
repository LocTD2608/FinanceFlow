import { Platform } from 'react-native';
import { SocialLoginPayload } from '../api/auth';

const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  '425687829053-ndepsge905k73icobl5243i1hupq1uf4.apps.googleusercontent.com';

/**
 * Mở cửa sổ popup Google OAuth 2.0 thật để người dùng đăng nhập bằng tài khoản Google cá nhân.
 */
export async function startGoogleOAuthFlow(): Promise<SocialLoginPayload> {
  if (Platform.OS !== 'web') {
    throw new Error('Chế độ popup OAuth hiện hỗ trợ trực tiếp trên trình duyệt Web.');
  }

  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin;
    const width = 500;
    const height = 620;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token&scope=${encodeURIComponent('openid profile email')}&prompt=select_account`;

    const popup = window.open(
      authUrl,
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup) {
      reject(new Error('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép popup để tiếp tục đăng nhập Google.'));
      return;
    }

    let resolved = false;

    // Lắng nghe popup chuyển hướng về kèm access_token trong URL hash
    const checkPopupInterval = setInterval(async () => {
      try {
        if (!popup || popup.closed) {
          clearInterval(checkPopupInterval);
          if (!resolved) {
            reject(new Error('Cửa sổ đăng nhập Google đã bị đóng.'));
          }
          return;
        }

        const popupUrl = popup.location.href;
        if (popupUrl && popupUrl.includes('access_token=')) {
          resolved = true;
          clearInterval(checkPopupInterval);

          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const idToken = params.get('id_token') || undefined;

          popup.close();

          if (!accessToken) {
            reject(new Error('Không nhận được mã xác thực từ Google.'));
            return;
          }

          // Gọi Google API lấy profile thật
          const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!userinfoRes.ok) {
            reject(new Error('Không thể tải thông tin tài khoản Google.'));
            return;
          }

          const profile = await userinfoRes.json();

          resolve({
            provider: 'google',
            oauthId: profile.sub,
            email: profile.email,
            username: profile.name || profile.email.split('@')[0],
            avatar: profile.picture,
            idToken,
          });
        }
      } catch {
        // Lỗi Cross-origin khi popup đang ở trang google.com là bình thường, tiếp tục chờ
      }
    }, 500);

    // Timeout sau 2 phút nếu không thao tác
    setTimeout(() => {
      if (!resolved) {
        clearInterval(checkPopupInterval);
        try {
          if (popup && !popup.closed) popup.close();
        } catch {}
        reject(new Error('Hết thời gian chờ đăng nhập Google (Timeout).'));
      }
    }, 120000);
  });
}
