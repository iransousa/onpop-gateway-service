import { Tile } from '../interfaces/tile.interface';

export function calculateHandScore(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.left + tile.right, 0);
}
