import { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent, type ViewInstance } from 'react-native';

/**
 * Tastatur-Abstand für Chat-Bildschirme – gemessen statt geraten.
 *
 * KeyboardAvoidingView braucht einen festen keyboardVerticalOffset (Statusleiste + native Kopfzeile,
 * auf dem iPad die obere Tab-Leiste bzw. ein eigener Kopf) und rechnet ihn nur bei Tastatur-Events
 * neu. Ein fester Wert (früher 90) stimmte auf iOS 26 nicht mehr (Kopfzeile ≈ 111 pt → Eingabefeld
 * ≈ 21 pt unter der Tastatur). Hier wird stattdessen im Moment des Tastatur-Events gemessen, wo der
 * eigene View im Fenster endet, und nur die tatsächliche Überlappung mit der Tastatur als Abstand
 * gesetzt – mit derselben Animation (Dauer/Kurve aus dem Event) wie KeyboardAvoidingView.
 *
 * Nutzung: `ref` auf den äußersten View des Bildschirms (ohne eigenes Padding), `inset` als
 * paddingBottom des Inhalts, `visible` = Tastatur offen.
 * Android: gleiche Messung über keyboardDidShow/DidHide. Mit Edge-to-Edge (Pflicht ab Android 15) verkleinert
 * adjustResize das Fenster nicht mehr zuverlässig; verkleinert es doch, ist die Überlappung 0 und nichts doppelt.
 */
export function useKeyboardInset() {
  const ref = useRef<ViewInstance>(null);
  const current = useRef(0);
  const [inset, setInset] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const apply = (value: number, e: KeyboardEvent) => {
      setVisible(value > 0);
      if (Math.abs(current.current - value) < 0.5) return;
      current.current = value;
      if (e.duration && e.easing) {
        const duration = Math.max(e.duration, 10);
        LayoutAnimation.configureNext({
          duration,
          update: { duration, type: LayoutAnimation.Types[e.easing as keyof typeof LayoutAnimation.Types] ?? LayoutAnimation.Types.keyboard },
        });
      }
      setInset(value);
    };
    // Feuert beim Einblenden, bei Höhenwechseln (Emoji-Tastatur, Vorschlagsleiste) und beim Ausblenden
    const change = (e: KeyboardEvent) => {
      const view = ref.current;
      if (!view) return;
      view.measureInWindow((_x, y, _w, h) => {
        const bottom = y + h;
        if (!Number.isFinite(bottom) || bottom <= 0) return;
        apply(Math.max(0, Math.round(bottom - e.endCoordinates.screenY)), e);
      });
    };
    const hide = (e: KeyboardEvent) => apply(0, e);
    const subs =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillChangeFrame', change), Keyboard.addListener('keyboardWillHide', hide)]
        : [Keyboard.addListener('keyboardDidShow', change), Keyboard.addListener('keyboardDidHide', hide)];
    return () => subs.forEach(s => s.remove());
  }, []);

  return { ref, inset, visible };
}
