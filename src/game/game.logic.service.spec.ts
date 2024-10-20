// src/game/game.logic.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GameLogicService } from './game.logic.service';
import { AppLogger } from '@src/shared/logger/logger.service';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { Tile } from '@src/game/interfaces/tile.interface';

describe('GameLogicService', () => {
  let service: GameLogicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameLogicService, AppLogger],
    }).compile();

    service = module.get<GameLogicService>(GameLogicService);
  });

  it('isValidMove should return true for a valid move on the left side', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: [],
      hands: {},
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 6, right: 5 };
    expect(service.isValidMove(gameState, tile, 'left')).toBe(true);
  });

  it('deve permitir que o jogador com a dupla [0:0] inicie o jogo se for a maior dupla disponível', () => {
    const gameState: GameState = {
      isFirstPlay: true,
      players: ['player1', 'player2'],
      hands: {
        player1: [
          { left: 0, right: 0 },
          { left: 1, right: 2 },
        ],
        player2: [
          { left: 1, right: 3 },
          { left: 2, right: 4 },
        ],
      },
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
      boardEnds: { left: -1, right: -1 },
      board: [],
      lastAction: null,
      moveHistory: [],
    };

    const canPlayer1Play = service.canPlayTile(gameState, 'player1');
    const canPlayer2Play = service.canPlayTile(gameState, 'player2');

    expect(canPlayer1Play).toBe(true); // Jogador 1 tem a maior dupla [0:0]
    expect(canPlayer2Play).toBe(false);
  });

  it('isValidMove should return false for an invalid move on the left side', () => {
    const gameState: GameState = {
      board: [{ left: 6, right: 1 }],
      boardEnds: { left: 6, right: 1 },
      players: ['player3'],
      hands: {},
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 4, right: 5 };
    expect(service.isValidMove(gameState, tile, 'left')).toBe(false);
  });

  it('isValidMove should return true for a valid move on the right side', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: [],
      hands: {},
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 1, right: 2 };
    expect(service.isValidMove(gameState, tile, 'right')).toBe(true);
  });

  it('isValidMove should return false for an invalid move on the right side', () => {
    const gameState: GameState = {
      board: [{ left: 6, right: 1 }],
      boardEnds: { left: 6, right: 1 },
      players: [],
      hands: {},
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 3, right: 4 };
    expect(service.isValidMove(gameState, tile, 'right')).toBe(false);
  });

  it('isValidMove should return true for the first move if the tile is a double', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: -1, right: -1 },
      players: [],
      hands: {},
      isFirstPlay: true,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 6, right: 6 };
    expect(service.isValidMove(gameState, tile)).toBe(true);
  });

  it('isValidMove should return false for the first move if the tile is not a double', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: -1, right: -1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [
          {
            left: 1,
            right: 5,
          },
          {
            left: 2,
            right: 3,
          },
        ],
        player2: [
          {
            left: 3,
            right: 2,
          },
          {
            left: 1,
            right: 2,
          },
        ],
      },
      isFirstPlay: true,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 2,
      roomId: '',
      drawPileCount: 0,
    };
    const tile: Tile = { left: 6, right: 5 };
    expect(service.isValidMove(gameState, tile)).toBe(false);
  });

  it('canPlayTile should return true if the player has a valid move', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1'],
      hands: { player1: [{ left: 6, right: 5 }] },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.canPlayTile(gameState, 'player1')).toBe(true);
  });

  it('canPlayTile should return false if the player does not have a valid move', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1'],
      hands: { player1: [{ left: 4, right: 5 }] },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.canPlayTile(gameState, 'player1')).toBe(false);
  });

  it('isGameBlocked should return true if no player can play a tile', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [{ left: 4, right: 5 }],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.isGameBlocked(gameState)).toBe(true);
  });

  it('isGameBlocked should return false if at least one player can play a tile', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [{ left: 6, right: 5 }],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.isGameBlocked(gameState)).toBe(false);
  });

  it('checkWinner should return the player ID if a player has no tiles left', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.checkWinner(gameState)).toBe('player1');
  });

  it('checkWinner should return null if no player has won yet', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [{ left: 4, right: 5 }],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.checkWinner(gameState)).toBeNull();
  });

  it('determineWinnerByLowestTile should return the player with the lowest tile sum', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [{ left: 4, right: 5 }],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    expect(service.determineWinnerByLowestTile(gameState)).toBe('player2');
  });

  it('calculateFinalScores should return the correct scores for each player', () => {
    const gameState: GameState = {
      board: [],
      boardEnds: { left: 6, right: 1 },
      players: ['player1', 'player2'],
      hands: {
        player1: [{ left: 4, right: 5 }],
        player2: [{ left: 2, right: 3 }],
      },
      isFirstPlay: false,
      lastAction: null,
      moveHistory: [],
      betAmount: 100,
      turnIndex: 0,
      drawPile: [],
      scores: {},
      currentTurn: '',
      turnStartTime: 0,
      disconnectedPlayers: new Set<string>(),
      otherPlayersHandCounts: {},
      yourPosition: 0,
      totalPlayers: 0,
      roomId: '',
      drawPileCount: 0,
    };
    const scores = service.calculateFinalScores(gameState);
    expect(scores).toEqual({ player1: 9, player2: 5 });
  });
});
