// game/game-logic.service.ts

import { Injectable } from '@nestjs/common';
import { GameState } from './interfaces/game-state.interface';
import { Tile } from './interfaces/tile.interface';
import { calculateHandScore } from './utils/score.util';
import { GameError } from './errors/game-error';

@Injectable()
export class GameLogicService {
  isValidMove(
    gameState: GameState,
    tile: Tile,
    side: 'left' | 'right',
  ): boolean {
    if (gameState.board.length === 0) {
      return true;
    }

    const { left: boardLeft, right: boardRight } = gameState.boardEnds;

    // Garantir que as extremidades não tenham valores inválidos
    if (boardLeft === -1 || boardRight === -1) {
      throw new GameError(
        'INVALID_BOARD_STATE',
        'Estado inválido do tabuleiro',
      );
    }

    if (side === 'left') {
      return tile.left === boardLeft || tile.right === boardLeft;
    } else {
      return tile.left === boardRight || tile.right === boardRight;
    }
  }

  canPlayTile(gameState: GameState, playerId: string): boolean {
    if (gameState.isFirstPlay) {
      if (gameState.players.length === 4) {
        return gameState.hands[playerId].some(
          (tile) => tile.left === 6 && tile.right === 6,
        );
      }
      return true;
    }

    const { left, right } = gameState.boardEnds;
    const playerHand = gameState.hands[playerId];

    return playerHand.some(
      (tile) =>
        tile.left === left ||
        tile.right === left ||
        tile.left === right ||
        tile.right === right,
    );
  }

  playerHasTile(gameState: GameState, playerId: string, tile: Tile): boolean {
    return gameState.hands[playerId].some(
      (t) =>
        (t.left === tile.left && t.right === tile.right) ||
        (t.left === tile.right && t.right === tile.left), // Verifica também a peça invertida
    );
  }

  isGameBlocked(gameState: GameState): boolean {
    const leftEnd = gameState.boardEnds.left;
    const rightEnd = gameState.boardEnds.right;

    return gameState.players.every((playerId) => {
      const playerTiles = gameState.hands[playerId];
      return !playerTiles.some(
        (tile) =>
          tile.left === leftEnd ||
          tile.right === leftEnd ||
          tile.left === rightEnd ||
          tile.right === rightEnd,
      );
    });
  }

  checkWinner(gameState: GameState): string | null {
    for (const playerId of gameState.players) {
      if (gameState.hands[playerId].length === 0) {
        return playerId;
      }
    }
    return null;
  }

  determineWinnerByLowestTile(gameState: GameState): string {
    let lowestSum = Infinity;
    let winner: string = gameState.players[0];

    for (const playerId of gameState.players) {
      const sum = calculateHandScore(gameState.hands[playerId]);
      if (sum < lowestSum) {
        lowestSum = sum;
        winner = playerId;
      }
    }

    return winner;
  }

  calculateFinalScores(gameState: GameState): Record<string, number> {
    const scores: Record<string, number> = {};
    gameState.players.forEach((playerId) => {
      scores[playerId] = calculateHandScore(gameState.hands[playerId]);
    });
    return scores;
  }
}
