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
const LIFT_MS = 120;
const SETTLE_MS = 220;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

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

/** Animates `el` from the transform `from` to no transform, then calls `done`. */
function settle(el: HTMLElement, from: string, done: () => void) {
  const ms = reducedMotion() ? 0 : SETTLE_MS;
  el.style.transition = 'none';
  el.style.transform = from;
  el.getBoundingClientRect(); // Commit the start state before transitioning.
  el.style.transition = `transform ${ms}ms ${EASE}`;
  el.style.transform = '';
  // A timer rather than `transitionend`, which doesn't fire if nothing actually moves.
  window.setTimeout(() => {
    el.style.transition = '';
    done();
  }, ms + 20);
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
        settle(el, el.style.transform, () => {
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
        for (const [tile, first, last] of [
          [el, firstDragged, lastDragged],
          [otherEl, firstOther, lastOther],
        ] as const) {
          settle(tile, invert(first, last), () => {
            delete tile.dataset.drag;
            animating.current--;
          });
        }
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
      el.style.transition = reducedMotion() ? 'none' : `transform ${LIFT_MS}ms ${EASE}`;
      el.style.transform = `scale(${LIFT_SCALE})`;
    },
    [boardRef],
  );

  return { onPointerDown };
}
