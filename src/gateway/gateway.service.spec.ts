// src/gateway/gateway.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GatewayService } from './gateway.service';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from '@src/matchmaking/matchmaking.service';
import { GameService } from '@src/game/game.service';
import { AppLogger } from '@src/shared/logger/logger.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';

describe('GatewayService', () => {
  let service: GatewayService;
  let pubClient: Redis;
  let subClient: Redis;
  let server: Server;
  let client: Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        JwtService,
        MatchmakingService,
        GameService,
        GameStateManager,
        PlayerActionService,
        AppLogger,
        ConfigService,
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
    pubClient = module.get<Redis>(Redis);
    subClient = module.get<Redis>(Redis);
    server = module.get<Server>(Server);
    client = module.get<Socket>(Socket);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle player connection with valid token', async () => {
    client.handshake.query = { token: 'validToken' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    await service.handleConnection(client);
    expect(client.data.user).toEqual({
      id: 'validToken',
      username: 'validToken',
    });
  });

  it('should disconnect player with invalid token', async () => {
    client.handshake.query = { token: '' };
    const disconnectSpy = jest.spyOn(client, 'disconnect');
    await service.handleConnection(client);
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('should handle player disconnection', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    await service.handleDisconnect(client);
    expect(pubClient.hdel).toHaveBeenCalledWith('playerSocketMap', 'playerId');
  });

  it('should handle reconnection', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    await service.handleReconnection(client, 'playerId', 'roomId');
    expect(client.join).toHaveBeenCalledWith('roomId');
  });

  it('should ask player to start game and receive response', async () => {
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const response = await service.askPlayerToStart('playerId', 4);
    expect(response).toBe(true);
  });

  it('should handle start game response', async () => {
    client.data.user = { id: 'playerId' };
    await service.handleStartGameResponse(client, { response: true });
    expect(pubClient.publish).toHaveBeenCalledWith(
      'playerResponse:playerId',
      JSON.stringify({ playerId: 'playerId', response: true }),
    );
  });

  it('should handle join matchmaking', async () => {
    client.data.user = { id: 'playerId' };
    const result = await service.handleJoinMatchmaking(client, {
      betAmount: 100,
      minPlayers: 2,
    });
    expect(result).toEqual({
      message: 'Player added to matchmaking queue',
      betAmount: 100,
    });
  });

  it('should handle leave matchmaking', async () => {
    client.data.user = { id: 'playerId' };
    const result = await service.handleLeaveMatchmaking(client);
    expect(result).toEqual({
      message: 'Player removed from matchmaking queue',
    });
  });

  it('should handle play tile', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handlePlayTile(client, {
      tile: { left: 1, right: 2 },
      side: 'left',
    });
    expect(result).toEqual({ success: true });
  });

  it('should handle send message', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handleSendMessage(client, {
      roomId: 'roomId',
      message: 'Hello',
    });
    expect(result).toEqual({ success: true });
  });

  it('should handle leave game', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handleLeaveGame(client);
    expect(result).toEqual({
      success: true,
      message: `Player playerId left the game`,
    });
  });

  it('should handle get chat history', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    await service.handleGetChatHistory(client);
    expect(client.emit).toHaveBeenCalledWith('chat_history', {
      roomId: 'roomId',
      chatHistory: [],
    });
  });

  it('should handle draw tile', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handleDrawTile(client);
    expect(result).toEqual({ message: 'Tile drawn successfully' });
  });

  it('should handle pass turn', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handlePassTurn(client);
    expect(result).toEqual({ message: 'Turn passed successfully' });
  });

  it('should handle request game state', async () => {
    client.data.user = { id: 'playerId' };
    jest.spyOn(service, 'getSocketIdByPlayerId').mockResolvedValue('socketId');
    const result = await service.handleRequestGameState(client);
    expect(result).toEqual({ message: 'Game state sent' });
  });
});
