import { Tile } from '@src/game/interfaces/tile.interface';
import { MoveHistory } from '@src/game/interfaces/move-history.interface';

export interface BoardEnds {
  left: number;
  right: number;
}

export interface GameState {
  roomId: string;
  players: string[]; // IDs dos jogadores
  hands: { [playerId: string]: Tile[] }; // Peças nas mãos de cada jogador
  board: Tile[]; // Peças na mesa
  turnIndex: number; // Índice do jogador que deve jogar
  betAmount: number;
  drawPile: Tile[]; // Monte de peças para compra
  lastAction: { playerId: string; action: 'play' | 'draw' | 'pass' };
  boardEnds: BoardEnds;
  currentTurn: string;
  scores: { [playerId: string]: number };
  drawPileCount: number;
  turnStartTime: number;
  disconnectedPlayers: Set<string>;
  otherPlayersHandCounts: { [playerId: string]: number };
  moveHistory: MoveHistory[];
  isFirstPlay: boolean;
  yourPosition: number;
  totalPlayers: number;
  createdAt?: Date;
  finishedAt?: Date;
  isFinished?: boolean;
  winner?: string;
}
