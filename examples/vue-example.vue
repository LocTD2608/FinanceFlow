<template>
  <div ref="container" class="chiikawa-mascot-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineExpose } from 'vue';
import ChiikawaMascot from '../chiikawa-mascot.js';

const props = defineProps({
  size: { type: Number, default: 260 },
  mode: { type: String, default: 'inline' },
  initialPose: { type: String, default: 'hello' },
  initialText: { type: String, default: 'Xin chào! Tớ là Chiikawa AI~ 👋' },
  sound: { type: Boolean, default: true },
  assetPath: { type: String, default: '/chiikawa_poses/' }
});

const container = ref(null);
let mascot = null;

onMounted(() => {
  if (container.value) {
    mascot = new ChiikawaMascot({
      container: container.value,
      size: props.size,
      mode: props.mode,
      initialPose: props.initialPose,
      initialText: props.initialText,
      sound: props.sound,
      assetPath: props.assetPath
    });
  }
});

onUnmounted(() => {
  if (mascot) {
    mascot.destroy();
  }
});

// Expose API methods to parent component (e.g. mascotRef.value.think())
defineExpose({
  think: (msg) => mascot?.think(msg),
  load: (msg) => mascot?.load(msg),
  search: (msg) => mascot?.search(msg),
  answer: (msg) => mascot?.answer(msg),
  success: (msg) => mascot?.success(msg),
  error: (msg) => mascot?.error(msg),
  setPose: (pose, msg) => mascot?.setPose(pose, msg),
  say: (msg) => mascot?.say(msg),
  poke: () => mascot?.poke(),
  toggleSound: (val) => mascot?.toggleSound(val)
});
</script>

<style scoped>
.chiikawa-mascot-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
