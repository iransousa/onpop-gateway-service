import { Tile } from '@src/game/interfaces/tile.interface';

export function calculateHandScore(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.left + tile.right, 0);
}
