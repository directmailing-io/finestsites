import * as Haptics from 'expo-haptics';
import { Archive, ArchiveRestore, CheckCheck, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useChatActions } from '@/api/queries';
import type { ChatConversation } from '@/api/types';
import { Text, useToast } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';

import { ChatConversationRow } from './ChatConversationRow';
import { CHAT_ACTION_FAILED, confirmDelete } from './ConversationMenu';

/** Breite einer Aktionsfläche (volle Zeilenhöhe). */
const ACTION_WIDTH = 84;
/** Ab hier gilt ein Wisch als „durchgezogen“ (Anteil der Zeilenbreite) – wie in Mail. */
const COMMIT_RATIO = 0.6;
/** Mindestabstand hinter den Flächen, bevor ein Wisch als durchgezogen gilt. */
const COMMIT_MIN_EXTRA = 64;
/** Hysterese: erst deutlich unter der Schwelle wieder „nicht durchgezogen“ (kein Flackern, kein Wettlauf beim Loslassen). */
const COMMIT_HYSTERESIS = 48;
const COMMIT_SPRING = { damping: 30, stiffness: 320, overshootClamping: true } as const;

type ActionKey = 'archive' | 'unarchive' | 'unblock' | 'delete' | 'read';

interface SwipeAction {
  key: ActionKey;
  label: string;
  icon: LucideIcon;
  color: string;
  run: () => void;
}

/** Nur eine Zeile gleichzeitig offen: Liste hält die zuletzt geöffnete Zeile und schließt sie beim Scrollen. */
export interface SwipeRegistry {
  open: SwipeableMethods | null;
}

export function useSwipeRegistry() {
  const registry = useRef<SwipeRegistry>({ open: null }).current;
  const closeOpen = useCallback(() => {
    registry.open?.close();
    registry.open = null;
  }, [registry]);
  return { registry, closeOpen };
}

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

/**
 * Wisch-Zeile im Postfach (wie WhatsApp/Mail):
 * - nach links: erste Aktion je Liste (Archivieren / Wiederherstellen / Sperre aufheben) + Löschen (mit Bestätigung)
 * - nach rechts: „Gelesen“ nur bei ungelesenen Nachrichten
 * - langer Wisch löst die erste, nicht-destruktive Aktion aus – nie Löschen
 * Die Aktionsflächen folgen dem Finger; zieht man weiter, wächst die erste Aktion und deckt Löschen ab.
 */
export const SwipeableConversationRow = memo(function SwipeableConversationRow({
  c,
  selected,
  onPress,
  registry,
  onDeleted,
}: {
  c: ChatConversation;
  selected?: boolean;
  onPress: () => void;
  registry: SwipeRegistry;
  /** Nach erfolgreichem Löschen (iPad: Auswahl zurücksetzen). */
  onDeleted?: (id: string) => void;
}) {
  const actions = useChatActions();
  const toast = useToast();
  const ref = useRef<SwipeableMethods>(null);
  const rowWidth = useSharedValue(0);
  // „durchgezogen“ je Seite (0/1) + Wachstum der ersten Fläche (0→1); hold hält beides, bis die Zeile nach einer Aktion zu ist
  const commitRight = useSharedValue(0);
  const commitLeft = useSharedValue(0);
  const growRight = useSharedValue(0);
  const growLeft = useSharedValue(0);
  const hold = useSharedValue(false);

  const close = useCallback(() => ref.current?.close(), []);
  const failed = useCallback(() => toast.show(CHAT_ACTION_FAILED, 'error'), [toast]);

  useEffect(() => {
    const mine = ref.current;
    return () => {
      if (mine && registry.open === mine) registry.open = null;
    };
  }, [registry]);

  const right = useMemo<SwipeAction[]>(() => {
    const done = (message: string) => () => {
      success();
      toast.show(message, 'success');
    };
    const simple = (m: ReturnType<typeof useChatActions>['archive'], message: string) => () => {
      close();
      m.mutate(c.id, { onSuccess: done(message), onError: failed });
    };
    const primary: SwipeAction =
      c.status === 'archived'
        ? { key: 'unarchive', label: 'Wiederherstellen', icon: ArchiveRestore, color: colors.neutralPill, run: simple(actions.unarchive, 'Wiederhergestellt') }
        : c.status === 'blocked'
          ? { key: 'unblock', label: 'Sperre aufheben', icon: ShieldCheck, color: colors.success, run: simple(actions.unblock, 'Sperre aufgehoben') }
          : { key: 'archive', label: 'Archivieren', icon: Archive, color: colors.neutralPill, run: simple(actions.archive, 'Archiviert') };
    const remove: SwipeAction = {
      key: 'delete',
      label: 'Löschen',
      icon: Trash2,
      color: colors.dangerStrong,
      run: () =>
        confirmDelete(c, actions, toast, {
          onCancel: close,
          onError: close,
          onSuccess: () => {
            success();
            onDeleted?.(c.id);
          },
        }),
    };
    return [primary, remove];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, actions.archive.mutate, actions.unarchive.mutate, actions.unblock.mutate, actions.remove.mutate, close, failed, onDeleted]);

  const left = useMemo<SwipeAction[]>(() => {
    if (c.unread <= 0) return [];
    return [
      {
        key: 'read',
        label: 'Gelesen',
        icon: CheckCheck,
        color: colors.accent,
        run: () => {
          close();
          actions.read.mutate(c.id, {
            onSuccess: () => {
              success();
              toast.show('Als gelesen markiert', 'success');
            },
            onError: failed,
          });
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.unread, actions.read.mutate, close, failed]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      rowWidth.value = e.nativeEvent.layout.width;
    },
    [rowWidth],
  );

  const renderRight = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <ActionStrip side="right" actions={right} translation={translation} rowWidth={rowWidth} committed={commitRight} grow={growRight} hold={hold} />
    ),
    [right, rowWidth, commitRight, growRight, hold],
  );
  const renderLeft = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <ActionStrip side="left" actions={left} translation={translation} rowWidth={rowWidth} committed={commitLeft} grow={growLeft} hold={hold} />
    ),
    [left, rowWidth, commitLeft, growLeft, hold],
  );

  // Beim Loslassen: andere Zeile schließen; war der Wisch durchgezogen → erste Aktion, Zeile schließen
  const onWillOpen = useCallback(
    (direction: SwipeDirection) => {
      const mine = ref.current;
      if (registry.open && registry.open !== mine) registry.open.close();
      registry.open = mine;
      const committed = direction === SwipeDirection.LEFT ? commitRight.value : commitLeft.value;
      const action = direction === SwipeDirection.LEFT ? right[0] : left[0];
      if (!committed || !action || action.key === 'delete') {
        tick();
        return;
      }
      hold.value = true;
      action.run();
      mine?.close();
    },
    [registry, commitRight, commitLeft, hold, right, left],
  );

  const onClose = useCallback(() => {
    if (registry.open === ref.current) registry.open = null;
    hold.value = false;
    commitRight.value = 0;
    commitLeft.value = 0;
    growRight.value = 0;
    growLeft.value = 0;
  }, [registry, hold, commitRight, commitLeft, growRight, growLeft]);

  // Tipp auf eine Zeile, während eine andere offen ist: nur die offene schließen (wie Mail)
  const handlePress = useCallback(() => {
    if (registry.open && registry.open !== ref.current) {
      registry.open.close();
      registry.open = null;
      return;
    }
    onPress();
  }, [registry, onPress]);

  const a11yActions = useMemo(() => [...right, ...left].map(a => ({ name: a.key, label: a.label })), [right, left]);
  const onA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      [...right, ...left].find(a => a.key === e.nativeEvent.actionName)?.run();
    },
    [right, left],
  );

  return (
    <View onLayout={onLayout}>
      <ReanimatedSwipeable
        ref={ref}
        friction={1}
        overshootFriction={1}
        rightThreshold={ACTION_WIDTH * 0.7}
        leftThreshold={ACTION_WIDTH * 0.7}
        enableTrackpadTwoFingerGesture
        containerStyle={styles.container}
        renderRightActions={renderRight}
        renderLeftActions={left.length > 0 ? renderLeft : undefined}
        onSwipeableWillOpen={onWillOpen}
        onSwipeableClose={onClose}>
        <View style={styles.rowBackground}>
          <ChatConversationRow c={c} selected={selected} onPress={handlePress} accessibilityActions={a11yActions} onAccessibilityAction={onA11yAction} />
        </View>
      </ReanimatedSwipeable>
    </View>
  );
});

/**
 * Aktionsflächen einer Seite. Der Streifen hängt an der Zeilenkante und folgt dem Finger; die äußere Fläche
 * (Löschen) sitzt am Rand. Beim langen Wisch schiebt sich Löschen hinaus und die erste Aktion füllt alles.
 */
function ActionStrip({
  side,
  actions,
  translation,
  rowWidth,
  committed,
  grow,
  hold,
}: {
  side: 'left' | 'right';
  actions: SwipeAction[];
  translation: SharedValue<number>;
  rowWidth: SharedValue<number>;
  committed: SharedValue<number>;
  grow: SharedValue<number>;
  hold: SharedValue<boolean>;
}) {
  const sign = side === 'right' ? -1 : 1;
  const stripWidth = actions.length * ACTION_WIDTH;
  const outerWidth = actions.length > 1 ? ACTION_WIDTH : 0;

  useAnimatedReaction(
    () => {
      const t = sign * translation.value;
      const at = Math.max(rowWidth.value * COMMIT_RATIO, stripWidth + COMMIT_MIN_EXTRA);
      return t > at ? 1 : t < at - COMMIT_HYSTERESIS ? 0 : -1;
    },
    state => {
      if (state === -1 || state === committed.value) return;
      if (state === 0 && hold.value) return;
      committed.value = state;
      grow.value = withSpring(state, COMMIT_SPRING);
      if (state === 1) scheduleOnRN(tick);
    },
  );

  // Streifen so breit wie die Zeile, Kante an Kante mit der Zeile (folgt exakt dem Finger)
  const strip = useAnimatedStyle(() => ({
    width: rowWidth.value,
    transform: [{ translateX: side === 'right' ? rowWidth.value + translation.value : translation.value - rowWidth.value }],
  }));
  // Äußere Fläche (Löschen) bleibt am Bildschirmrand, beim Durchziehen schiebt sie sich hinaus
  const outer = useAnimatedStyle(() => {
    const t = sign * translation.value;
    const edge = Math.max(t, stripWidth) - ACTION_WIDTH + grow.value * ACTION_WIDTH;
    return { transform: [{ translateX: side === 'right' ? edge : -edge }] };
  });

  if (actions.length === 0) return null;
  const [primary, ...rest] = actions;
  const outerAction = rest[0];
  return (
    <>
      {/* Platzhalter bestimmt die Öffnungsbreite für ReanimatedSwipeable (misst das Layout) */}
      <View style={{ width: stripWidth, pointerEvents: 'none' }} />
      <Animated.View style={[styles.strip, strip]}>
        <Pressable
          onPress={primary.run}
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          style={({ pressed }) => [styles.primary, side === 'right' ? styles.primaryRight : styles.primaryLeft, { backgroundColor: primary.color, opacity: pressed ? 0.85 : 1 }]}>
          <ActionContent action={primary} />
        </Pressable>
        {outerAction && (
          <Animated.View style={[styles.outer, side === 'right' ? styles.outerRight : styles.outerLeft, { width: outerWidth }, outer]}>
            <Pressable
              onPress={outerAction.run}
              accessibilityRole="button"
              accessibilityLabel={outerAction.label}
              style={({ pressed }) => [styles.outerPress, { backgroundColor: outerAction.color, opacity: pressed ? 0.85 : 1 }]}>
              <ActionContent action={outerAction} />
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </>
  );
}

function ActionContent({ action }: { action: SwipeAction }) {
  const Icon = action.icon;
  return (
    <View style={styles.content} accessibilityElementsHidden>
      <Icon size={20} color={colors.white} strokeWidth={2} />
      <Text style={styles.label} numberOfLines={1}>
        {action.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.button },
  rowBackground: { backgroundColor: colors.background },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.button, overflow: 'hidden', pointerEvents: 'box-none' },
  primary: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'stretch' },
  primaryRight: { justifyContent: 'flex-start' },
  primaryLeft: { justifyContent: 'flex-end' },
  outer: { position: 'absolute', top: 0, bottom: 0 },
  outerRight: { left: 0 },
  outerLeft: { right: 0 },
  outerPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.white },
});
