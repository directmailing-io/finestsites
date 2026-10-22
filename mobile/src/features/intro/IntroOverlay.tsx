import { useEvent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';

/**
 * Animiertes Logo-Intro beim Kaltstart (Daniel, 22.10.2026: „wie das Logo-Intro, 1,5-fach“).
 *
 * Ablauf: nativer Startbildschirm (leer, #FFFFFF – exakt das Weiß des Videos: Y 235 im TV-Bereich) → sobald das erste
 * Videobild steht, wird er ausgeblendet und das Intro läuft (3,1 s: „f“ zeichnet sich bunt, wird
 * schwarz, Wortmarke blendet ein) → letztes Bild bleibt stehen, bis die App bereit ist → sanftes
 * Ausblenden in die App.
 *
 * - Nur einmal pro Kaltstart (Modul-Merker), nie beim Zurückkehren aus dem Hintergrund.
 * - „Bewegung reduzieren“ an → kein Video, direkt in die App.
 * - Stumm und mischt sich nicht in laufende Musik/Podcasts (audioMixingMode mixWithOthers).
 * - Tippen überspringt. Sicherheitsnetz: lädt das Video nicht binnen 1,5 s oder meldet einen
 *   Fehler, geht es ohne Intro weiter – der Start hängt nie am Video.
 */
const INTRO = require('../../../assets/brand/intro.mp4');
const BG = '#FFFFFF';
const LOAD_TIMEOUT_MS = 1500;
const FADE_MS = 280;
/** Länge von intro.mp4 (Original 0–4,6 s, 1,5-fach) */
const INTRO_MS = 3070;

let playedThisLaunch = false;

export function IntroOverlay({ appReady, onDone }: { appReady: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'playing' | 'ended' | 'leaving'>('loading');
  const opacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const player = useVideoPlayer(INTRO, p => {
    p.muted = true;
    p.loop = false;
    p.audioMixingMode = 'mixWithOthers';
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  // Den nativen Startbildschirm blendet danach das Layout aus, sobald die App bereit ist
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  // „Bewegung reduzieren“ → ohne Intro
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (alive && reduce) finish();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sicherheitsnetz: Video lädt nicht → ohne Intro weiter
  useEffect(() => {
    if (status === 'error') {
      finish();
      return;
    }
    if (phase !== 'loading') return;
    const t = setTimeout(finish, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phase]);

  // Sicherheitsnetz: meldet der Player das Ende nicht (z. B. vom System angehalten), nach Videolänge + 1,5 s weiter
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setTimeout(() => setPhase(p => (p === 'playing' ? 'ended' : p)), INTRO_MS + 1500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setPhase(p => (p === 'leaving' ? p : 'ended')));
    return () => sub.remove();
  }, [player]);

  // Ende erreicht und App bereit → ausblenden
  useEffect(() => {
    if (phase !== 'ended' || !appReady) return;
    setPhase('leaving');
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, appReady]);

  const onFirstFrame = () => {
    if (phase !== 'loading' || finished.current) return;
    playedThisLaunch = true;
    void SplashScreen.hideAsync().catch(() => {});
    player.play();
    setPhase('playing');
  };

  const skip = () => {
    if (!appReady) return; // ohne fertige App gäbe es nur eine leere Fläche
    player.pause();
    setPhase('ended');
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity }]} pointerEvents="box-only">
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityLabel="FinestSites" accessibilityHint="Tippen zum Überspringen">
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
          onFirstFrameRender={onFirstFrame}
          pointerEvents="none"
        />
      </Pressable>
    </Animated.View>
  );
}

/** Intro nur beim ersten Start dieses Prozesses zeigen. */
export function shouldPlayIntro(): boolean {
  return !playedThisLaunch;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: BG, zIndex: 1000, elevation: 1000 },
});
