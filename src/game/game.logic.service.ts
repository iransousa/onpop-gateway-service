// game/game-logic.service.ts

import { Injectable } from '@nestjs/common';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { Tile } from '@src/game/interfaces/tile.interface';
import { calculateHandScore } from '@src/game/utils/score.util';
import { GameError } from '@src/game/errors/game-error';
import { AppLogger } from '@src/shared/logger/logger.service';

@Injectable()
export class GameLogicService {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(GameLogicService.name);
  }

  isValidMove(
    gameState: GameState,
    tile: Tile,
    side: 'left' | 'right' = 'left',
  ): boolean {
    this.logger.debug(
      `Checking if move is valid for player ${gameState.players[gameState.turnIndex]} | Tile(${JSON.stringify(tile)}) | Side(${side}) | Board length: ${gameState.board.length} | Board ends: ${JSON.stringify(gameState.boardEnds)}`,
    );

    if (gameState.board.length === 0) {
      // Verifica se a primeira jogada é válida de acordo com as regras
      return this.isValidFirstMove(gameState, tile);
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
      const numberOfPlayers = gameState.players.length;
      const playerHand = gameState.hands[playerId];

      if (numberOfPlayers === 4) {
        // Para 4 jogadores, apenas o jogador com [6:6] pode jogar
        return playerHand.some((tile) => tile.left === 6 && tile.right === 6);
      } else if (numberOfPlayers === 2 || numberOfPlayers === 3) {
        // Para 2 ou 3 jogadores, determinar a maior dupla
        let highestDouble = -1;
        let playerWithHighestDouble: string | null = null;

        for (let pip = 6; pip >= 0; pip--) {
          for (const id of gameState.players) {
            if (
              gameState.hands[id].some((t) => t.left === pip && t.right === pip)
            ) {
              highestDouble = pip;
              playerWithHighestDouble = id;
              break;
            }
          }
          if (highestDouble !== -1) {
            break;
          }
        }

        if (highestDouble === -1) {
          // Nenhum jogador tem dupla, qualquer jogador pode jogar
          return true;
        } else {
          // Apenas o jogador com a maior dupla pode jogar
          if (playerId === playerWithHighestDouble) {
            return true;
          } else {
            return false;
          }
        }
      } else {
        // Para outros números de jogadores, permitir qualquer jogador
        return true;
      }
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
    if (gameState.drawPile.length > 0) {
      this.logger.debug('Draw pile is not empty. Game is not blocked.');
      return false;
    }

    if (gameState.isFirstPlay) {
      this.logger.debug('First play has not been made. Game is not blocked.');
      return false;
    }

    const leftEnd = gameState.boardEnds.left;
    const rightEnd = gameState.boardEnds.right;

    const allPlayersCannotPlay = gameState.players.every((playerId) => {
      const playerTiles = gameState.hands[playerId];
      const canPlayerPlay = playerTiles.some(
        (tile) =>
          tile.left === leftEnd ||
          tile.right === leftEnd ||
          tile.left === rightEnd ||
          tile.right === rightEnd,
      );
      this.logger.debug(`Player ${playerId} can play: ${canPlayerPlay}`);
      return !canPlayerPlay;
    });

    if (allPlayersCannotPlay) {
      this.logger.debug('All players cannot play. Game is blocked.');
    }

    return allPlayersCannotPlay;
  }

  checkWinner(gameState: GameState): string | null {
    // this.logger.debug('Checking winner by hand size ');
    for (const playerId of gameState.players) {
      if (gameState.hands[playerId].length === 0) {
        return playerId;
      }
    }
    return null;
  }

  determineWinnerByLowestTile(gameState: GameState): string | null {
    let lowestSum = Infinity;
    let winners: string[] = [];

    for (const playerId of gameState.players) {
      const sum = calculateHandScore(gameState.hands[playerId]);
      if (sum < lowestSum) {
        lowestSum = sum;
        winners = [playerId]; // Atualiza a lista de vencedores com o jogador atual
      } else if (sum === lowestSum) {
        winners.push(playerId); // Adiciona o jogador ao grupo dos que têm a menor pontuação
      }
    }

    // Se houver mais de um jogador com a mesma pontuação mínima, é possível desempatar de acordo com quem jogou a última peça
    if (winners.length > 1) {
      // Verifica quem jogou a última peça (baseado no histórico de jogadas)
      const lastPlayerId = gameState.moveHistory[gameState.moveHistory.length - 1].playerId;

      if (winners.includes(lastPlayerId)) {
        return lastPlayerId; // O último jogador que jogou, entre os empatados, é o vencedor
      } else {
        // Retorna o primeiro jogador dos empatados, como critério de desempate simples
        return winners[0];
      }
    }

    return winners[0]; // Retorna o vencedor com a menor pontuação
  }

  calculateFinalScores(gameState: GameState): Record<string, number> {
    const scores: Record<string, number> = {};
    gameState.players.forEach((playerId) => {
      scores[playerId] = calculateHandScore(gameState.hands[playerId]);
    });
    return scores;
  }

  private isValidFirstMove(gameState: GameState, tile: Tile): boolean {
    const numberOfPlayers = gameState.players.length;

    if (numberOfPlayers === 4) {
      // Para 4 jogadores, a primeira pedra deve ser [6:6]
      return tile.left === 6 && tile.right === 6;
    } else if (numberOfPlayers === 2 || numberOfPlayers === 3) {
      // Para 2 ou 3 jogadores, determinar a maior dupla
      let highestDouble = -1;
      let playerWithHighestDouble: string | null = null;

      for (let pip = 6; pip >= 0; pip--) {
        for (const playerId of gameState.players) {
          if (
            gameState.hands[playerId].some(
              (t) => t.left === pip && t.right === pip,
            )
          ) {
            highestDouble = pip;
            playerWithHighestDouble = playerId;
            break;
          }
        }
        if (highestDouble !== -1) {
          break;
        }
      }

      if (highestDouble === -1) {
        // Nenhum jogador tem dupla, qualquer pedra pode ser jogada
        return true;
      } else {
        // O jogador deve jogar a maior dupla encontrada
        return tile.left === highestDouble && tile.right === highestDouble;
      }
    } else {
      // Para outros números de jogadores, permitir qualquer jogada
      return true;
    }
  }
}
