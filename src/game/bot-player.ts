// game/bot-player.ts

import { GameState } from '@src/game/interfaces/game-state.interface';
import { Tile } from '@src/game/interfaces/tile.interface';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export class BotPlayer {
  constructor(
    public botId: string,
    public difficulty: BotDifficulty = 'medium',
  ) {}

  decideTurn(gameState: GameState): {
    action: 'play' | 'draw' | 'pass';
    tile?: Tile;
    side?: 'left' | 'right';
  } {
    const hand = gameState.hands[this.botId];
    const { left, right } = gameState.boardEnds;

    // Strategy based on difficulty
    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(hand, left, right);
      case 'medium':
        return this.mediumStrategy(hand, left, right, gameState);
      case 'hard':
        return this.hardStrategy(hand, left, right, gameState);
      default:
        return this.mediumStrategy(hand, left, right, gameState);
    }
  }

  private easyStrategy(
    hand: Tile[],
    left: number,
    right: number,
  ): {
    action: 'play' | 'draw' | 'pass';
    tile?: Tile;
    side?: 'left' | 'right';
  } {
    // Plays the first valid tile found
    for (const tile of hand) {
      if (tile.left === left || tile.right === left) {
        return { action: 'play', tile, side: 'left' };
      }
      if (tile.left === right || tile.right === right) {
        return { action: 'play', tile, side: 'right' };
      }
    }
    return { action: 'draw' };
  }

  private mediumStrategy(
    hand: Tile[],
    left: number,
    right: number,
    gameState: GameState,
  ): {
    action: 'play' | 'draw' | 'pass';
    tile?: Tile;
    side?: 'left' | 'right';
  } {
    // Prioritizes playing double tiles and tiles with numbers that have appeared frequently on the board
    const boardNumbers = this.countBoardNumbers(gameState.board);
    const sortedHand = hand.slice().sort((a, b) => {
      const aScore = this.getTileScore(a, boardNumbers);
      const bScore = this.getTileScore(b, boardNumbers);
      return bScore - aScore;
    });

    for (const tile of sortedHand) {
      if (tile.left === left || tile.right === left) {
        return { action: 'play', tile, side: 'left' };
      }
      if (tile.left === right || tile.right === right) {
        return { action: 'play', tile, side: 'right' };
      }
    }
    return { action: 'draw' };
  }

  private hardStrategy(
    hand: Tile[],
    left: number,
    right: number,
    gameState: GameState,
  ): {
    action: 'play' | 'draw' | 'pass';
    tile?: Tile;
    side?: 'left' | 'right';
  } {
    // Implements a more complex strategy, considering opponents' possible tiles
    // For simplicity, we'll enhance the medium strategy
    const opponentNumbers = this.countOpponentNumbers(gameState);
    const sortedHand = hand.slice().sort((a, b) => {
      const aScore = this.getTileScoreHard(a, opponentNumbers);
      const bScore = this.getTileScoreHard(b, opponentNumbers);
      return bScore - aScore;
    });

    for (const tile of sortedHand) {
      if (tile.left === left || tile.right === left) {
        return { action: 'play', tile, side: 'left' };
      }
      if (tile.left === right || tile.right === right) {
        return { action: 'play', tile, side: 'right' };
      }
    }
    if (gameState.drawPile.length > 0) {
      return { action: 'draw' };
    } else {
      return { action: 'pass' };
    }
  }

  private getTileScore(
    tile: Tile,
    boardNumbers: Record<number, number>,
  ): number {
    let score = 0;
    if (tile.left === tile.right) score += 5; // Prioritize doubles
    score += (boardNumbers[tile.left] || 0) + (boardNumbers[tile.right] || 0);
    return score;
  }

  private getTileScoreHard(
    tile: Tile,
    opponentNumbers: Record<number, number>,
  ): number {
    let score = 0;
    if (tile.left === tile.right) score += 5; // Prioritize doubles
    // Avoid numbers that opponents might have
    score -=
      (opponentNumbers[tile.left] || 0) + (opponentNumbers[tile.right] || 0);
    return score;
  }

  private countBoardNumbers(board: Tile[]): Record<number, number> {
    const count: Record<number, number> = {};
    for (const tile of board) {
      count[tile.left] = (count[tile.left] || 0) + 1;
      count[tile.right] = (count[tile.right] || 0) + 1;
    }
    return count;
  }

  private countOpponentNumbers(gameState: GameState): Record<number, number> {
    // Estimate opponents' possible tiles based on tiles not yet played
    const allTiles = this.generateAllTiles();
    const playedTiles = [...gameState.board, ...gameState.hands[this.botId]];
    const remainingTiles = allTiles.filter(
      (tile) => !this.tileInArray(tile, playedTiles),
    );

    const count: Record<number, number> = {};
    for (const tile of remainingTiles) {
      count[tile.left] = (count[tile.left] || 0) + 1;
      count[tile.right] = (count[tile.right] || 0) + 1;
    }
    return count;
  }

  private generateAllTiles(): Tile[] {
    const tiles: Tile[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        tiles.push({ left: i, right: j });
      }
    }
    return tiles;
  }

  private tileInArray(tile: Tile, array: Tile[]): boolean {
    return array.some(
      (t) =>
        (t.left === tile.left && t.right === tile.right) ||
        (t.left === tile.right && t.right === tile.left),
    );
  }
}
