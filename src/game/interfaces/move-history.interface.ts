import { Tile } from './tile.interface';

export interface MoveHistory {
  playerId: string;
  action: 'play' | 'draw' | 'pass';
  tile?: Tile;
  side?: 'left' | 'right';
}
