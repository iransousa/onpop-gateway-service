import { Tile } from '@src/game/interfaces/tile.interface';

export function generateAllTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push({ left: i, right: j });
    }
  }
  return tiles;
}

export function generateRoomId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
