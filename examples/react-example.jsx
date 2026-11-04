import React, { useEffect, useRef } from 'react';
import ChiikawaMascot from '../chiikawa-mascot.js';

/**
 * React Component Wrapper for Chiikawa AI Mascot
 * 
 * Usage:
 *   const mascotRef = useRef(null);
 *   <ChiikawaMascotComponent ref={mascotRef} mode="inline" size={260} />
 * 
 *   // Later in your chat handler:
 *   mascotRef.current.think("AI đang suy nghĩ...");
 *   mascotRef.current.answer("Câu trả lời của AI!");
 */
export const ChiikawaMascotComponent = React.forwardRef(({
  mode = 'inline',
  size = 260,
  initialPose = 'hello',
  initialText = 'Xin chào! Tớ là Chiikawa AI~ 👋',
  sound = true,
  assetPath = '/chiikawa_poses/',
  className = '',
  onPoseChange,
  onClick
}, ref) => {
  const containerRef = useRef(null);
  const mascotInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mascotInstanceRef.current = new ChiikawaMascot({
      container: containerRef.current,
      mode,
      size,
      initialPose,
      initialText,
      sound,
      assetPath,
      onPoseChange,
      onClick
    });

    if (ref) {
      if (typeof ref === 'function') {
        ref(mascotInstanceRef.current);
      } else {
        ref.current = mascotInstanceRef.current;
      }
    }

    return () => {
      if (mascotInstanceRef.current) {
        mascotInstanceRef.current.destroy();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`chiikawa-mascot-wrapper ${className}`}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    />
  );
});

export default ChiikawaMascotComponent;

