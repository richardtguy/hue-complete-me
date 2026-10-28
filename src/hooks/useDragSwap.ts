import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';
import { type Board, isCorner, positionAt } from '../game/puzzle.ts';

const LIFT_SCALE = 1.08;
const LIFT_MS = 160;
const LIFT_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
// Swap timings are long enough to follow by eye: the displaced tile is what tells the player
// a swap happened, so it travels the longest, with an easing that keeps it visibly moving
// rather than jumping most of the way in the first frames.
/** The dragged tile settling into its new slot from under the finger. */
const SETTLE_MS = 300;
/** The other tile travelling to the vacated slot. */
const DISPLACED_MS = 420;
/** A refused drop returning home. */
const SNAP_BACK_MS = 320;
const MOVE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
/** How much the displaced tile lifts mid-flight, so it reads as moving over the board. */
const DISPLACED_LIFT = 1.06;

interface Options {
  boardRef: RefObject<HTMLElement | null>;
  board: Board;
  /** Called with the two positions to exchange. Must update `board` synchronously. */
  onSwap: (a: number, b: number) => void;
  disabled: boolean;
}

interface Drag {
  pointerId: number;
  el: HTMLElement;
  fromPos: number;
  startX: number;
  startY: number;
  boardRect: DOMRect;
  target: { pos: number; el: HTMLElement } | null;
  removeListeners: () => void;
}

/*
 * Drag state is shown through data attributes rather than classes, because React rewrites
 * `className` when a tile re-renders (for example when it becomes correct mid-swap):
 *   data-drag="lifted"    following the pointer
 *   data-drag="settling"  animating into its slot after release
 *   data-drag="displaced" the other tile in a swap, gliding to the vacated slot
 *   data-target           the tile that will be swapped if the pointer is released now
 */

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates `el` from the transform `from` to its laid-out position, then calls `done`.
 * `lift` scales the tile up mid-flight.
 */
function settle(el: HTMLElement, from: string, ms: number, done: () => void, lift = 1) {
  // Removing transform from the transition list cancels any running CSS transition (such as
  // the drop target's shrink), which would otherwise override the animation.
  el.style.transition = 'none';
  el.style.transform = '';
  const keyframes: Keyframe[] =
    lift === 1
      ? [{ transform: from }, { transform: 'none' }]
      : [
          { transform: from, scale: 1 },
          { scale: lift, offset: 0.5 },
          { transform: 'none', scale: 1 },
        ];
  const animation = el.animate(keyframes, {
    duration: reducedMotion() ? 0 : ms,
    easing: MOVE_EASE,
  });
  // `finished` resolves even when nothing moves (unlike `transitionend`), and rejects if the
  // animation is cancelled, for example when the tile is removed.
  const finish = () => {
    el.style.transition = '';
    done();
  };
  animation.finished.then(finish, finish);
}

/** The transform that makes an element laid out at `last` appear at `first`. */
function invert(first: DOMRect, last: DOMRect): string {
  const dx = first.left + first.width / 2 - (last.left + last.width / 2);
  const dy = first.top + first.height / 2 - (last.top + last.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${first.width / last.width})`;
}

/**
 * Drag-to-swap for the board. Tiles must carry `data-tile={tileId}` and keep the same DOM
 * element when they move. Returns a pointerdown handler for the board element.
 */
export function useDragSwap({ boardRef, board, onSwap, disabled }: Options) {
  const latest = useRef({ board, onSwap, disabled });
  useLayoutEffect(() => {
    latest.current = { board, onSwap, disabled };
  });

  const drag = useRef<Drag | null>(null);
  const animating = useRef(0);

  useEffect(() => () => drag.current?.removeListeners(), []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const boardEl = boardRef.current;
      if (!boardEl || e.button !== 0 || drag.current || animating.current > 0) return;
      if (latest.current.disabled) return;
      const el = (e.target as Element).closest<HTMLElement>('[data-tile]');
      if (!el) return;
      const fromPos = latest.current.board.indexOf(Number(el.dataset.tile));
      if (isCorner(fromPos)) return;

      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      const tileAt = (pos: number) =>
        boardEl.querySelector<HTMLElement>(`[data-tile="${latest.current.board[pos]}"]`);

      const setTarget = (pos: number | null) => {
        const d = drag.current!;
        if (d.target?.pos === pos) return;
        if (d.target) delete d.target.el.dataset.target;
        const targetEl = pos === null ? null : tileAt(pos);
        d.target = pos === null || !targetEl ? null : { pos, el: targetEl };
        if (targetEl) targetEl.dataset.target = '';
      };

      const onMove = (ev: PointerEvent) => {
        const d = drag.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${LIFT_SCALE})`;
        const { left, top, width, height } = d.boardRect;
        const pos = positionAt((ev.clientX - left) / width, (ev.clientY - top) / height);
        setTarget(pos === null || pos === d.fromPos || isCorner(pos) ? null : pos);
      };

      const end = (commit: boolean) => (ev: PointerEvent) => {
        const d = drag.current;
        if (!d || ev.pointerId !== d.pointerId) return;
        d.removeListeners();
        drag.current = null;
        if (el.hasPointerCapture(d.pointerId)) el.releasePointerCapture(d.pointerId);
        if (d.target) delete d.target.el.dataset.target;
        if (commit && d.target) swapAnimated(d.fromPos, d.target.pos, d.target.el);
        else snapBack();
      };

      const snapBack = () => {
        animating.current++;
        el.dataset.drag = 'settling';
        settle(el, el.style.transform, SNAP_BACK_MS, () => {
          delete el.dataset.drag;
          animating.current--;
        });
      };

      const swapAnimated = (from: number, to: number, otherEl: HTMLElement) => {
        // FLIP: measure both tiles, commit the swap, measure again, then animate each tile
        // from where it was to its new slot.
        const firstDragged = el.getBoundingClientRect();
        const firstOther = otherEl.getBoundingClientRect();
        flushSync(() => latest.current.onSwap(from, to));
        el.style.transition = 'none';
        el.style.transform = '';
        const lastDragged = el.getBoundingClientRect();
        const lastOther = otherEl.getBoundingClientRect();

        animating.current += 2;
        el.dataset.drag = 'settling';
        otherEl.dataset.drag = 'displaced';
        const finish = (tile: HTMLElement) => () => {
          delete tile.dataset.drag;
          animating.current--;
        };
        settle(el, invert(firstDragged, lastDragged), SETTLE_MS, finish(el));
        settle(
          otherEl,
          invert(firstOther, lastOther),
          DISPLACED_MS,
          finish(otherEl),
          DISPLACED_LIFT,
        );
      };

      const onUp = end(true);
      const onCancel = end(false);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);
      el.addEventListener('lostpointercapture', onCancel);

      drag.current = {
        pointerId: e.pointerId,
        el,
        fromPos,
        startX: e.clientX,
        startY: e.clientY,
        boardRect: boardEl.getBoundingClientRect(),
        target: null,
        removeListeners: () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onCancel);
          el.removeEventListener('lostpointercapture', onCancel);
        },
      };

      el.dataset.drag = 'lifted';
      el.style.transition = reducedMotion() ? 'none' : `transform ${LIFT_MS}ms ${LIFT_EASE}`;
      el.style.transform = `scale(${LIFT_SCALE})`;
    },
    [boardRef],
  );

  return { onPointerDown };
}
