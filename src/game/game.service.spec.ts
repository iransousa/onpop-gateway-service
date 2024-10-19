// src/game/game.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';
import { GameStateManager } from './game.state.manager';
import { PlayerActionService } from './player.action.service';
import { AppLogger } from '../shared/logger/logger.service';

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        GameStateManager,
        PlayerActionService,
        AppLogger,
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // describe('GameService - findFirstPlayer', () => {
  //   let gameService: GameService;
  //
  //   beforeEach(() => {
  //     // Inicialize o GameService com dependências mockadas, se necessário
  //     gameService = new GameService(/* dependências */);
  //   });
  //
  //   it('deve selecionar o jogador com a maior dupla em jogo de 2 jogadores', () => {
  //     const gameState: GameState = {
  //       players: ['player1', 'player2'],
  //       hands: {
  //         player1: [{ left: 4, right: 4 }, { left: 2, right: 3 }],
  //         player2: [{ left: 5, right: 5 }, { left: 1, right: 6 }],
  //       },
  //       // ... outros atributos necessários
  //     };
  //
  //     const firstPlayerIndex = gameService['findFirstPlayer'](gameState);
  //     expect(firstPlayerIndex).toBe(1); // player2 tem a dupla [5:5]
  //   });
  //
  //   it('deve selecionar o jogador com [6:6] em jogo de 4 jogadores', () => {
  //     const gameState: GameState = {
  //       players: ['player1', 'player2', 'player3', 'player4'],
  //       hands: {
  //         player1: [{ left: 3, right: 3 }, { left: 2, right: 3 }],
  //         player2: [{ left: 6, right: 6 }, { left: 1, right: 6 }],
  //         player3: [{ left: 5, right: 5 }, { left: 4, right: 4 }],
  //         player4: [{ left: 0, right: 0 }, { left: 2, right: 2 }],
  //       },
  //       // ... outros atributos necessários
  //     };
  //
  //     const firstPlayerIndex = gameService['findFirstPlayer'](gameState);
  //     expect(firstPlayerIndex).toBe(1); // player2 tem a [6:6]
  //   });
  //
  //   it('deve selecionar aleatoriamente se ninguém tem dupla em jogo de 2 jogadores', () => {
  //     const gameState: GameState = {
  //       players: ['player1', 'player2'],
  //       hands: {
  //         player1: [{ left: 1, right: 2 }, { left: 2, right: 3 }],
  //         player2: [{ left: 3, right: 4 }, { left: 4, right: 5 }],
  //       },
  //       // ... outros atributos necessários
  //     };
  //
  //     const firstPlayerIndex = gameService['findFirstPlayer'](gameState);
  //     expect(firstPlayerIndex).toBeGreaterThanOrEqual(0);
  //     expect(firstPlayerIndex).toBeLessThan(2);
  //     // Como é aleatório, apenas verificamos se o índice está dentro do intervalo válido
  //   });
  // });

  // Adicione mais testes unitários aqui
});
