// Import necessary testing tools and modules
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { GatewayService } from '@src/gateway/gateway.service';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from '@src/matchmaking/matchmaking.service';
import { GameService } from '@src/game/game.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { AppLogger } from '@src/shared/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';

// Mocks for dependencies
jest.mock('@src/matchmaking/matchmaking.service');
jest.mock('@src/game/game.service');
jest.mock('@src/game/game.state.manager');
jest.mock('@src/game/player.action.service');
jest.mock('@src/shared/logger/logger.service');

describe('GatewayService (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let socketClient;

  beforeAll(async () => {
    // Create a testing module with all the necessary providers
    console.log('Setting up testing module...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        JwtService,
        MatchmakingService,
        GameService,
        GameStateManager,
        PlayerActionService,
        AppLogger,
        ConfigService,
        {
          provide: 'Redis',
          useValue: new Redis(), // Mock Redis instance for testing
        },
      ],
    }).compile();

    // Initialize Nest application
    console.log('Initializing Nest application...');
    app = moduleFixture.createNestApplication();
    await app.init();

    // Start WebSocket server
    console.log('Starting WebSocket server on port 3001...');
    server = app.get(GatewayService).server;
    server.listen(3001); // Listen on port 3001 for WebSocket connections

    // Initialize client socket for testing, connecting to the server
    console.log('Initializing client socket...');
    socketClient = io('http://localhost:3001', {
      transports: ['websocket'],
      query: { token: 'test-token' }, // Pass a test token for authentication
    });
  });

  afterAll(async () => {
    // Disconnect the client socket after all tests are done
    console.log('Disconnecting client socket...');
    if (socketClient) {
      socketClient.disconnect();
    }
    // Close the Nest application
    console.log('Closing Nest application...');
    await app.close();
  });

  it('should connect successfully and join matchmaking', (done) => {
    // Listen for the client to connect to the WebSocket server
    console.log('Waiting for client to connect to WebSocket server...');
    socketClient.on('connect', () => {
      console.log('Client connected to WebSocket server.');
      // Verify that the client is connected
      expect(socketClient.connected).toBeTruthy();

      // Emit an event to join matchmaking with specific parameters
      console.log('Emitting join_matchmaking event...');
      socketClient.emit('join_matchmaking', { betAmount: 100, minPlayers: 2 });

      // Listen for the server response to confirm the player joined matchmaking
      socketClient.on('matchmaking_response', (response) => {
        console.log('Received matchmaking_response:', response);
        expect(response.message).toBe('Player added to matchmaking queue');
        expect(response.betAmount).toBe(100);
        done(); // Indicate that the test is complete
      });
    });
  });

  it('should handle reconnection', (done) => {
    const playerId = 'test-player';
    const roomId = 'test-room';

    // Listen for the client to connect to the WebSocket server
    console.log(
      'Waiting for client to connect to WebSocket server for reconnection...',
    );
    socketClient.on('connect', () => {
      console.log(
        'Client connected to WebSocket server. Attempting to join game room...',
      );
      // Emit an event to join a game room
      socketClient.emit('joinGame', { roomId });

      // Listen for the server response indicating successful reconnection
      socketClient.on('reconnection_successful', (data) => {
        console.log('Received reconnection_successful:', data);
        expect(data.roomId).toBe(roomId);
        done(); // Indicate that the test is complete
      });
    });
  });

  it('should allow player to play a tile', (done) => {
    const playerId = 'test-player';
    const roomId = 'test-room';
    const tile = { value: [1, 2] }; // Define a tile to be played

    // Listen for the client to connect to the WebSocket server
    console.log(
      'Waiting for client to connect to WebSocket server to play a tile...',
    );
    socketClient.on('connect', () => {
      console.log(
        'Client connected to WebSocket server. Emitting play_tile event...',
      );
      // Emit an event to play a tile on the specified side
      socketClient.emit('play_tile', { tile, side: 'right' });

      // Listen for the server response confirming the tile was played
      socketClient.on('play_tile_response', (response) => {
        console.log('Received play_tile_response:', response);
        expect(response.success).toBe(true);
        done(); // Indicate that the test is complete
      });
    });
  });

  it('should notify players on chat message', (done) => {
    const roomId = 'test-room';
    const message = 'Hello, team!';

    // Listen for the client to connect to the WebSocket server
    console.log(
      'Waiting for client to connect to WebSocket server to send a chat message...',
    );
    socketClient.on('connect', () => {
      console.log(
        'Client connected to WebSocket server. Emitting send_message event...',
      );
      // Emit an event to send a chat message to the specified room
      socketClient.emit('send_message', { roomId, message });

      // Listen for the server to broadcast the chat message to all players
      socketClient.on('receive_message', (chatMessage) => {
        console.log('Received chat message:', chatMessage);
        expect(chatMessage.message).toBe(message);
        expect(chatMessage.timestamp).toBeDefined(); // Verify timestamp is included
        done(); // Indicate that the test is complete
      });
    });
  });
});
