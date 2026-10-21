import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * Konfetti wie im Web-Feierfenster (canvas-confetti in PublishCelebrationModal):
 * gleiche Farben, ein Stoß aus der Mitte (60 Teile, 60° Streuung), 150 ms später je 20 Teile von
 * links und rechts. Leichtgewichtig mit Animated (native driver), ohne zusätzliches Paket.
 * Bei „Bewegung reduzieren“ gibt es kein Konfetti.
 */
const COLORS = ['#8060b0', '#a78bfa', '#22c55e', '#fbbf24', '#f472b6', '#60a5fa', '#34d399'];
const DURATION = 2600;
const GRAVITY = 1100; // pt/s²

interface Burst {
  count: number;
  angle: number; // Grad, 90 = nach oben (wie canvas-confetti)
  spread: number;
  velocity: number; // pt/s
  x: number; // 0–1
  y: number; // 0–1
  delay: number;
  scale: number;
}

const BURSTS: Burst[] = [
  { count: 60, angle: 90, spread: 60, velocity: 900, x: 0.5, y: 0.65, delay: 0, scale: 0.9 },
  { count: 20, angle: 70, spread: 40, velocity: 820, x: 0.1, y: 0.7, delay: 150, scale: 0.8 },
  { count: 20, angle: 110, spread: 40, velocity: 820, x: 0.9, y: 0.7, delay: 150, scale: 0.8 },
];

interface Particle {
  key: string;
  color: string;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  spin: number;
  delay: number;
  round: boolean;
}

function makeParticles(width: number, height: number): Particle[] {
  const out: Particle[] = [];
  // größere Fenster (iPad) → kräftigerer Stoß, damit das Konfetti ähnlich hoch fliegt
  const boost = Math.sqrt(Math.max(1, height / 874));
  BURSTS.forEach((b, bi) => {
    for (let i = 0; i < b.count; i++) {
      const a = ((b.angle + (Math.random() - 0.5) * b.spread) * Math.PI) / 180;
      const v = b.velocity * boost * (0.55 + Math.random() * 0.6);
      const size = (6 + Math.random() * 5) * b.scale;
      out.push({
        key: `${bi}-${i}`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        x0: b.x * width,
        y0: b.y * height,
        vx: Math.cos(a) * v,
        vy: -Math.sin(a) * v,
        w: size,
        h: size * (Math.random() < 0.5 ? 0.6 : 1),
        spin: (Math.random() - 0.5) * 1440,
        delay: b.delay,
        round: Math.random() < 0.3,
      });
    }
  });
  return out;
}

export function Confetti() {
  const { width, height } = useWindowDimensions();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const particles = useMemo(() => makeParticles(width, height), [width, height]);
  const progress = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => alive && setEnabled(!reduce))
      .catch(() => alive && setEnabled(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const anims = progress.map((p, i) =>
      Animated.timing(p, { toValue: 1, duration: DURATION, delay: particles[i].delay, easing: Easing.linear, useNativeDriver: true }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, [enabled, progress, particles]);

  if (!enabled) return null;

  // Wurfparabel als Stützstellen (Luftwiderstand grob über abnehmende Geschwindigkeit)
  const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const T = DURATION / 1000;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((pt, i) => {
        const p = progress[i];
        const drag = (s: number) => (1 - Math.exp(-2.2 * s * T)) / 2.2; // gebremste Strecke
        const tx = p.interpolate({ inputRange: STEPS, outputRange: STEPS.map(s => pt.vx * drag(s)) });
        const ty = p.interpolate({ inputRange: STEPS, outputRange: STEPS.map(s => pt.vy * drag(s) + 0.5 * GRAVITY * 0.35 * (s * T) ** 2) });
        const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${pt.spin}deg`] });
        const opacity = p.interpolate({ inputRange: [0, 0.05, 0.75, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={pt.key}
            style={{
              position: 'absolute',
              left: pt.x0 - pt.w / 2,
              top: pt.y0 - pt.h / 2,
              width: pt.w,
              height: pt.h,
              borderRadius: pt.round ? pt.w / 2 : 1.5,
              backgroundColor: pt.color,
              opacity,
              transform: [{ translateX: tx }, { translateY: ty }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
