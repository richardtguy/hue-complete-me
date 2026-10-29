import { useRef } from 'react';
import { needsDarkInk, toCss, type Oklab } from '../game/colour.ts';
import { type Board as BoardState, isCorner, isCorrect, rowCol } from '../game/puzzle.ts';
import { useDragSwap } from '../hooks/useDragSwap.ts';
import Tile from './Tile.tsx';
import './Board.css';

interface BoardProps {
  board: BoardState;
  /** Solved colour of each tile, indexed by tile id. */
  colours: readonly Oklab[];
  onSwap: (a: number, b: number) => void;
  /** Plays the win sequence and locks the board. */
  solved: boolean;
  /** Tiles that become correct play the placement pulse. */
  live: boolean;
  /** Hides the colours and locks the board until the player presses Start. */
  concealed: boolean;
}

export default function Board({ board, colours, onSwap, solved, live, concealed }: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const disabled = solved || concealed;
  const { onPointerDown } = useDragSwap({ boardRef, board, onSwap, disabled });

  // Render tiles in tile-id order and place them with grid coordinates, so a tile's DOM
  // element stays the same when it moves. Dragging and swap animations rely on this.
  const positionOf: number[] = [];
  board.forEach((tile, pos) => {
    positionOf[tile] = pos;
  });

  return (
    <div
      ref={boardRef}
      className={[
        'board',
        live && 'board--live',
        solved && 'board--solved',
        concealed && 'board--concealed',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Puzzle board"
      onPointerDown={onPointerDown}
    >
      {colours.map((colour, tile) => {
        const pos = positionOf[tile]!;
        const { row, col } = rowCol(pos);
        return (
          <Tile
            key={tile}
            id={tile}
            colour={toCss(colour)}
            row={row}
            col={col}
            fixed={isCorner(pos)}
            correct={isCorrect(board, pos)}
            darkInk={needsDarkInk(colour)}
          />
        );
      })}
    </div>
  );
}
