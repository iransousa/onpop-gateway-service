export interface Tile {
  left: number;
  right: number;
  side?: 'left' | 'right' | null | undefined;
  username?: string;
  timestamp?: number;
}
