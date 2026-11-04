# 🐻 Chiikawa AI Chat Mascot SDK

> Bộ Mascot tương tác cho ứng dụng Chat AI với 12 biểu cảm cảm xúc chuẩn, vật lý chuyển động tự nhiên (nhún nhảy, thở, nghiêng đầu theo chuột), hiệu ứng âm thanh Web Audio và hào quang thích ứng theo trạng thái AI.

![Mascot Preview](chiikawa_poses/hello.png)

---

## 📁 Cấu trúc thư mục

```
Mascot/
├── chiikawa-mascot.js       # Core SDK độc lập (Vanilla JS, 0 dependencies)
├── chiikawa-mascot.css      # Stylesheet giao diện, hào quang, bong bóng thoại
├── chiikawa_poses/          # 12 ảnh biểu cảm gốc (thân trắng đặc 100%, nền trong suốt)
│   ├── hello.png            # Xin chào
│   ├── welcome.png          # Chào mừng
│   ├── start.png            # Quyết tâm / Bắt đầu
│   ├── loading.png          # Đang tải / Chạy vòng quanh
│   ├── search.png           # Tìm kiếm / Kính lúp
│   ├── announce.png         # Thông báo / Trả lời
│   ├── awesome.png          # Khen ngợi / Tuyệt vời
│   ├── wait.png             # Chờ chút / Suy nghĩ
│   ├── success.png          # Thành công / Nhảy mừng
│   ├── error.png            # Lỗi / Mếu máo
│   ├── thanks.png           # Cảm ơn / Biết ơn
│   └── bye.png              # Tạm biệt
├── examples/                # Code mẫu tích hợp
│   ├── react-example.jsx    # React / Next.js Component
│   ├── vue-example.vue      # Vue 3 Component
│   └── vanilla-chat-embed.html # Ví dụ HTML/JS thuần
├── index.html               # Trang demo trực quan
└── README.md                # Tài liệu hướng dẫn cho thành viên
```

---

## 🚀 Cách tích hợp nhanh vào App

### 1. Dùng trực tiếp với HTML / JavaScript thuần

Nhúng 2 tệp vào dự án của bạn:
```html
<link rel="stylesheet" href="chiikawa-mascot.css">
<script src="chiikawa-mascot.js"></script>

<!-- Nơi hiển thị mascot -->
<div id="mascot-box"></div>

<script>
  const mascot = new ChiikawaMascot({
    container: '#mascot-box',
    size: 260,
    initialPose: 'hello',
    initialText: 'Xin chào! Tớ là Chiikawa AI~! 👋',
    assetPath: 'chiikawa_poses/' // Đường dẫn tới thư mục ảnh
  });
</script>
```

---

### 2. Dùng trong dự án React / Next.js

Import component từ `examples/react-example.jsx`:
```jsx
import React, { useRef } from 'react';
import ChiikawaMascotComponent from './examples/react-example';

export default function ChatApp() {
  const mascotRef = useRef(null);

  const handleSend = async (question) => {
    // 1. Khi người dùng gửi câu hỏi
    mascotRef.current.think("Đang suy nghĩ...");

    // 2. Gọi API Chat AI
    mascotRef.current.load("Đang tổng hợp dữ liệu...");
    const res = await fetch('/api/chat', { 
      method: 'POST', 
      body: JSON.stringify({ prompt: question }) 
    });
    const data = await res.json();

    // 3. Hiển thị câu trả lời
    mascotRef.current.answer(data.reply);
  };

  return (
    <div className="chat-page">
      <ChiikawaMascotComponent ref={mascotRef} size={240} />
      {/* Giao diện chat của bạn */}
    </div>
  );
}
```

---

### 3. Dùng trong dự án Vue 3

Import component từ `examples/vue-example.vue`:
```vue
<template>
  <div class="chat-app">
    <ChiikawaMascot ref="mascot" :size="240" />
    <button @click="testAI">Thử hỏi AI</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ChiikawaMascot from './examples/vue-example.vue';

const mascot = ref(null);

function testAI() {
  mascot.value.think("Đang xử lý...");
  setTimeout(() => {
    mascot.value.answer("Xong rồi nè bạn ơi!");
  }, 2000);
}
</script>
```

---

## 🤖 Các phương thức điều khiển AI (API Methods)

| Phương thức | Trạng thái Mascot | Mô tả |
| :--- | :--- | :--- |
| `mascot.think(msg)` | 🤔 **wait** | Bé ngồi chống cằm suy nghĩ, hào quang tím |
| `mascot.load(msg)` | ⏳ **loading** | Bé chạy vòng quanh toát mồ hôi, chấm typing nhấp nháy |
| `mascot.search(msg)` | 🔍 **search** | Bé cầm kính lúp soi tìm thông tin |
| `mascot.answer(msg)` | 📢 **announce** | Bé cầm loa phát biểu kèm câu trả lời của AI |
| `mascot.success(msg)`| 🎊 **success** | Bé nhảy cẫng mừng rỡ kèm pháo hoa |
| `mascot.error(msg)`  | 😭 **error** | Bé mếu máo rơi lệ khi API lỗi |
| `mascot.say(text)`   | Giữ nguyên pose | Chỉ thay đổi nội dung bóng thoại |
| `mascot.poke()`      | Squish bounce | Giả lập hành vi người dùng ấn/chạm vào bé |
| `mascot.setPose(id, msg)` | Tùy chọn 12 pose | Đặt biểu cảm trực tiếp theo `id` |
| `mascot.toggleSound()` | Bật / Tắt | Chuyển đổi âm thanh Web Audio |
| `mascot.destroy()`   | Hủy bỏ | Dọn dẹp DOM và requestAnimationFrame |

---

## 🎭 12 Biểu cảm có sẵn (`poseId`)

1. `hello`: 👋 Xin chào tươi tắn, vẫy tay
2. `welcome`: 🎉 Đón chào nồng nhiệt, dang rộng hai tay
3. `start`: 🦸 Quyết tâm, thắt khăn đỏ, nắm chặt tay
4. `loading`: ⏳ Đang tải, chạy quanh toát mồ hôi
5. `search`: 🔍 Tìm kiếm, cầm kính lúp soi dấu vết
6. `announce`: 📢 Phát biểu, cầm loa thông báo to
7. `awesome`: 👍 Tuyệt vời, mắt lấp lánh sao, ngón tay cái
8. `wait`: 🤔 Suy nghĩ, ngồi chống cằm đăm chiêu
9. `success`: 🎊 Thành công, nhảy bật tưng bừng
10. `error`: 😭 Thất bại / Lỗi mạng, quẹt nước mắt
11. `thanks`: 🙏 Biết ơn, chắp hai tay mắt cún con
12. `bye`: 🍂 Tạm biệt quyến luyến trong gió thu

---

## ⚙️ Các thông số khởi tạo (`options`)

```javascript
const mascot = new ChiikawaMascot({
  container: '#my-div',        // Selector hoặc HTMLElement
  mode: 'inline',              // 'inline' hoặc 'floating' (widget góc màn hình)
  position: 'bottom-right',    // 'bottom-right' hoặc 'bottom-left' (khi mode: 'floating')
  size: 260,                   // Chiều rộng & cao (px)
  initialPose: 'hello',        // Biểu cảm ban đầu
  initialText: 'Xin chào!',    // Câu thoại ban đầu
  assetPath: './chiikawa_poses/', // Đường dẫn thư mục ảnh
  sound: true,                 // Bật/tắt Web Audio SFX
  interactive: true,           // Cho phép bấm vào bé để cưng/nựng
  onPoseChange: (pose, msg) => {}, // Callback khi đổi biểu cảm
  onClick: (e) => {}           // Callback khi người dùng click
});
```

---

## 💡 Ví dụ tích hợp với Streaming Chat AI (OpenAI / Gemini / Claude)

```javascript
async function sendToAI(prompt) {
  // 1. Chuyển sang trạng thái suy nghĩ
  mascot.think("Đang tiếp nhận câu hỏi...");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      })
    });

    // 2. Chuyển sang đang xử lý dữ liệu
    mascot.load();

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // 3. Trả lời kết quả
    mascot.answer(reply);

  } catch (err) {
    // 4. Báo lỗi nếu kết nối thất bại
    mascot.error("Không thể kết nối đến máy chủ AI!");
  }
}
```

---

## 🛠️ Bản quyền & Tài nguyên
- Biểu cảm được trích xuất và xử lý nền trong suốt, thân trắng đặc từ bộ sticker Chiikawa chính thức.
- Tương thích 100% với mọi trình duyệt hiện đại (Chrome, Edge, Safari, Firefox, iOS, Android).

