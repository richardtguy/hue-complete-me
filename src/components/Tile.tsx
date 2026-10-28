import type { CSSProperties } from 'react';
import './Tile.css';

interface TileProps {
  /** CSS colour of the tile. */
  colour: string;
  row: number;
  col: number;
  /** Fixed corner tile: never moves and shows no dot. */
  fixed: boolean;
  correct: boolean;
  /** Draw the dot dark (for light tiles) rather than light. */
  darkInk: boolean;
}

export default function Tile({ colour, row, col, fixed, correct, darkInk }: TileProps) {
  const style = {
    '--tile-colour': colour,
    gridRow: row + 1,
    gridColumn: col + 1,
  } as CSSProperties;

  const where = `row ${row + 1}, column ${col + 1}`;
  const label = fixed
    ? `Fixed corner, ${where}`
    : `Tile at ${where}, ${correct ? 'in place' : 'not in place'}`;

  const className = [
    'tile',
    fixed && 'tile--fixed',
    correct && !fixed && 'tile--correct',
    darkInk ? 'tile--dark-ink' : 'tile--light-ink',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={style} role="img" aria-label={label}>
      {correct && !fixed && <span className="tile__dot" aria-hidden="true" />}
    </div>
  );
}
