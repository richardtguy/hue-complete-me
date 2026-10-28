import { needsDarkInk, toCss, type Oklab } from '../game/colour.ts';
import { type Board as BoardState, isCorner, isCorrect, rowCol } from '../game/puzzle.ts';
import Tile from './Tile.tsx';
import './Board.css';

interface BoardProps {
  board: BoardState;
  /** Solved colour of each tile, indexed by tile id. */
  colours: readonly Oklab[];
}

export default function Board({ board, colours }: BoardProps) {
  // Render tiles in tile-id order and place them with grid coordinates, so a tile's DOM
  // element stays the same when it moves. Dragging and swap animations rely on this.
  const positionOf: number[] = [];
  board.forEach((tile, pos) => {
    positionOf[tile] = pos;
  });

  return (
    <div className="board" role="group" aria-label="Puzzle board">
      {colours.map((colour, tile) => {
        const pos = positionOf[tile]!;
        const { row, col } = rowCol(pos);
        return (
          <Tile
            key={tile}
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
