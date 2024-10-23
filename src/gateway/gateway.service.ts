import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from '@src/matchmaking/matchmaking.service';
import { GameService } from '@src/game/game.service';
import { GameError } from '@src/game/errors/game-error';
import { AppLogger } from '@src/shared/logger/logger.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { createAdapter } from '@socket.io/redis-adapter';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { instrument, RedisStore } from '@socket.io/admin-ui';

interface PlayerResponse {
  playerId: string;
  response: boolean;
}

@WebSocketGateway({ cors: { origin: '*' }, transports: ['websocket'] })
@Injectable()
export class GatewayService
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private pubClient: Redis; // Cliente para operações de cache e publicação
  private subClient: Redis; // Cliente dedicado para subscrição

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => MatchmakingService))
    private readonly matchmakingService: MatchmakingService,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly gameStateManager: GameStateManager,
    private readonly playerActionService: PlayerActionService,
    private readonly logger: AppLogger,
    @Inject(forwardRef(() => ConfigService))
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(GatewayService.name);
  }

  public async afterInit() {
    await this.initializeRedisAdapter();
    instrument(this.server, {
      auth: false,
      mode: 'development',
      store: new RedisStore(this.pubClient),
    });
  }

  async getSocketIdByPlayerId(playerId: string): Promise<string | null> {
    const socketId = await this.pubClient.hget('playerSocketMap', playerId);
    return socketId || null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        client.disconnect();
        return;
      }

      // For testing purposes, we're generating a user from the token
      const decoded = { id: token, username: token };
      client.data.user = decoded;
      this.logger.log(
        `Client connected: ${client.id} - User: ${decoded.username}`,
      );

      await this.pubClient.hset('playerSocketMap', decoded.id, client.id);

      // Check if the player is in an active game
      const roomId = await this.gameStateManager.getRoomIdByPlayerId(
        decoded.id,
      );
      if (roomId) {
        await this.handleReconnection(client, decoded.id, roomId);
        return;
      }
      client.join(roomId);
    } catch (error) {
      this.logger.error('Authentication failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const playerId = client.data.user?.id;

    if (playerId) {
      await this.pubClient.hdel('playerSocketMap', playerId);
      const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
      this.logger.log(`Player ${playerId} disconnected from room ${roomId}`);

      if (roomId) {
        await this.gameService.handlePlayerDisconnect(roomId, playerId);
      }

      // Remove the player from matchmaking if necessary
      await this.matchmakingService.handlePlayerDisconnect(playerId);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  async handleReconnection(client: Socket, playerId: string, roomId: string) {
    this.logger.log(`Player ${playerId} reconnecting to room ${roomId}`);

    // Reconnect the player to the room
    client.join(roomId);

    // Notify the GameService about the reconnection
    await this.gameService.handlePlayerReconnect(roomId, playerId);

    // Notify the player about the successful reconnection
    this.notifyPlayer(playerId, 'reconnection_successful', { roomId });

    // Notify other players in the room about the reconnection
    this.notifyRoom(roomId, 'player_reconnected', { playerId });
  }

  async askPlayerToStart(
    playerId: string,
    playerCount: number,
  ): Promise<boolean> {
    const socketId = await this.getSocketIdByPlayerId(playerId);
    if (!socketId) {
      this.logger.log(`Player ${playerId} is not connected`);
      return false;
    }

    // Envia a solicitação para o player
    this.server.to(socketId).emit('askToStartGame', { playerCount });
    this.logger.log(
      `Sent 'askToStartGame' to player ${playerId} with playerCount ${playerCount}`,
    );

    // Define o canal de resposta
    const responseChannel = `playerResponse:${playerId}`;

    return new Promise<boolean>((resolve, reject) => {
      const timeoutMs = 15000; // 15 segundos

      // Configura um timeout
      const timeoutHandle = setTimeout(async () => {
        this.logger.log(`Player ${playerId} did not respond in time`);
        this.notifyPlayer(playerId, 'timeout_notification', {
          message: 'You did not respond in time, proceeding without you',
        });
        try {
          await this.subClient.unsubscribe(responseChannel);
          this.logger.log(
            `Unsubscribed from channel ${responseChannel} due to timeout`,
          );
        } catch (err) {
          this.logger.error(
            `Error unsubscribing from ${responseChannel}: ${err.message}`,
          );
        }
        resolve(false);
      }, timeoutMs);

      // Handler para mensagens recebidas
      const messageHandler = async (data: PlayerResponse | null) => {
        if (!data) {
          this.logger.warn(
            `Received null or undefined data on channel ${responseChannel}`,
          );
          return;
        }

        if (data.playerId === playerId) {
          this.logger.log(
            `Received valid response from player ${playerId}: ${data.response}`,
          );
          clearTimeout(timeoutHandle);
          resolve(data.response);
          try {
            await this.subClient.unsubscribe(responseChannel);
            this.logger.log(
              `Unsubscribed from channel ${responseChannel} after receiving response`,
            );
          } catch (err) {
            this.logger.error(
              `Error unsubscribing from ${responseChannel}: ${err.message}`,
            );
          }
        } else {
          this.logger.warn(
            `Received message for different player on ${responseChannel}: ${data.playerId}`,
          );
        }
      };

      this.subClient.subscribe(responseChannel, (err: Error, count: number) => {
        if (err) {
          this.logger.error(
            `Failed to subscribe to ${responseChannel}: ${err.message}`,
          );
          return;
        }
        this.logger.log(`Subscribed to channel ${responseChannel}`);
        this.subClient.on('message', (channel: string, message: string) => {
          if (channel === responseChannel) {
            try {
              const data: PlayerResponse = JSON.parse(message);
              messageHandler(data);
            } catch (error) {
              this.logger.error(
                `Failed to parse message on ${responseChannel}: ${error.message}`,
              );
            }
          }
        });
      });
    });
  }

  @SubscribeMessage('start_game_response')
  async handleStartGameResponse(client: Socket, data: { response: boolean }) {
    const playerId = client.data.user.id;
    const responseChannel = `playerResponse:${playerId}`;
    this.logger.log(
      `Player ${playerId} responded to start game with response: ${data.response}`,
    );

    // Verificar se pubClient está conectado antes de publicar
    if (!this.pubClient || this.pubClient.status !== 'ready') {
      this.logger.error('PubClient não está conectado ou não está pronto');
      return;
    }

    // Publica a resposta no canal Redis
    try {
      await this.pubClient.publish(
        responseChannel,
        JSON.stringify({ playerId, response: data.response }),
      );
      this.logger.log(`Published response to channel ${responseChannel}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish message to ${responseChannel}: ${error.message}`,
      );
    }
  }

  @SubscribeMessage('join_matchmaking')
  async handleJoinMatchmaking(
    client: Socket,
    data: { betAmount: number; minPlayers: number; isBot: boolean },
  ) {
    const playerId = client.data.user.id;
    this.logger.log(
      `Player ${playerId} joined matchmaking with bet ${data.betAmount}`,
    );
    try {
      await this.matchmakingService.addPlayerToQueue(
        playerId,
        data.betAmount,
        500,
        data.minPlayers,
        true,
      );
      return {
        message: 'Player added to matchmaking queue',
        betAmount: data.betAmount,
      };
    } catch (error) {
      return { message: error.message };
    }
  }

  @SubscribeMessage('leave_matchmaking')
  async handleLeaveMatchmaking(client: Socket) {
    const playerId = client.data.user.id;
    this.logger.log(`Player ${playerId} left matchmaking`);
    try {
      await this.matchmakingService.removePlayerFromQueue(playerId);
      return { message: 'Player removed from matchmaking queue' };
    } catch (error) {
      return { message: error.message };
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, data: { roomId: string }) {
    this.logger.log(`Player ${client.data.user.id} joined game ${data.roomId}`);
    client.join(data.roomId);
  }

  @SubscribeMessage('play_tile')
  async handlePlayTile(
    client: Socket,
    data: { tile: any; side: 'left' | 'right' },
  ) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
    if (!roomId) {
      return { error: 'Player not in a game' };
    }
    try {
      await this.playerActionService.playTile(
        roomId,
        playerId,
        data.tile,
        data.side,
      );
      return { success: true };
    } catch (error) {
      if (error instanceof GameError) {
        return { error: error.message, code: error.code };
      }
      this.logger.error(`Unexpected error: ${error}`);
      return { error: 'An unexpected error occurred', details: error.message };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    client: Socket,
    data: { roomId: string; message: string },
  ) {
    const playerId = client.data.user.id;
    const message = data.message;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
    // Verifique se o jogador está na sala

    this.logger.log(
      `Player ${client.data.user.id} sent message: ${data.message} roomId: ${roomId}`,
    );

    if (!roomId) {
      return { error: 'Player not in a game' };
    }

    // Salvar a mensagem de chat no Redis
    await this.gameStateManager.addChatMessage(roomId, playerId, message);

    // Criar o objeto de mensagem
    const chatMessage = {
      playerId,
      message,
      timestamp: new Date(),
    };

    this.logger.log(
      `Player ${client.data.user.id} sent message: ${data.message}`,
    );

    // Enviar a mensagem para todos na sala
    // this.notifyRoom(roomId, 'receive_message', chatMessage);

    const game = await this.gameStateManager.getGameState(roomId);
    if (game && game.players) {
      for (const player of game.players) {
        this.notifyPlayer(player, 'receive_message', chatMessage);
      }
    }

    return { success: true };
  }

  @SubscribeMessage('leave_game')
  async handleLeaveGame(client: Socket) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);

    if (!roomId) {
      return { error: 'Player not in a game' };
    }

    // Handle player leaving the game
    await this.gameService.handlePlayerLeaveGame(roomId, playerId);

    // Remove the player from the Socket.IO room
    client.leave(roomId);

    return { success: true, message: `Player ${playerId} left the game` };
  }

  @SubscribeMessage('get_chat_history')
  async handleGetChatHistory(client: Socket) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);

    if (!roomId) {
      return { error: 'Player not in a game' };
    }

    // Recuperar o histórico de mensagens do Redis
    const chatHistory = await this.gameStateManager.getChatMessages(roomId);

    // Enviar o histórico de mensagens de volta ao cliente
    client.emit('chat_history', { roomId, chatHistory });
  }

  @SubscribeMessage('draw_tile')
  async handleDrawTile(client: Socket) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
    if (!roomId) {
      return { error: 'Player not in a game' };
    }
    try {
      await this.playerActionService.drawTile(roomId, playerId);
      return { message: 'Tile drawn successfully' };
    } catch (error) {
      if (error instanceof GameError) {
        return { error: error.message, code: error.code };
      }
      this.logger.error(`Unexpected error: ${error}`);
      return { error: 'An unexpected error occurred', details: error.message };
    }
  }

  @SubscribeMessage('pass_turn')
  async handlePassTurn(client: Socket) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
    if (!roomId) {
      return { error: 'Player not in a game' };
    }
    try {
      await this.playerActionService.passTurn(roomId, playerId);
      return { message: 'Turn passed successfully' };
    } catch (error) {
      if (error instanceof GameError) {
        return { error: error.message, code: error.code };
      }
      this.logger.error(`Unexpected error: ${error}`);
      return { error: 'An unexpected error occurred', details: error.message };
    }
  }

  @SubscribeMessage('request_game_state')
  async handleRequestGameState(client: Socket) {
    const playerId = client.data.user.id;
    const roomId = await this.gameStateManager.getRoomIdByPlayerId(playerId);
    if (!roomId) {
      return { error: 'Player not in a game' };
    }
    try {
      const gameState = await this.gameStateManager.getPlayerGameState(
        roomId,
        playerId,
      );
      this.notifyPlayer(playerId, 'game_state_update', gameState);
      return { message: 'Game state sent' };
    } catch (error) {
      this.logger.error(`Error fetching game state: ${error.message}`);
      return { error: 'Failed to retrieve game state' };
    }
  }

  /**
   * Notifies a specific player via Socket.IO.
   */
  notifyPlayer(playerId: string, event: string, message: any) {
    this.getSocketIdByPlayerId(playerId).then((socketId) => {
      if (socketId) {
        this.server.to(socketId).emit(event, message);
      } else {
        this.logger.log(`Player ${playerId} is not connected`);
      }
    });
  }

  /**
   * Notifies all players in a room.
   */
  notifyRoom(roomId: string, event: string, message: any) {
    this.server.to(roomId).emit(event, message);
  }

  private async initializeRedisAdapter() {
    try {
      // Cliente para cache e publicação
      this.pubClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST'),
        port: parseInt(this.configService.get<string>('REDIS_PORT'), 10),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        username: this.configService.get<string>('REDIS_USERNAME'),
      });

      this.pubClient.on('connect', () => {
        this.logger.log('Redis PubClient connected');
      });

      this.pubClient.on('ready', () => {
        this.logger.log('Redis PubClient is ready to use');
      });

      this.pubClient.on('error', (err) => {
        this.logger.error(`Redis PubClient Error: ${err.message}`);
      });

      // Cliente dedicado para subscrição
      this.subClient = new Redis({
        host: this.configService.get<string>('REDIS_HOST'),
        port: parseInt(this.configService.get<string>('REDIS_PORT'), 10),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        username: this.configService.get<string>('REDIS_USERNAME'),
      });

      this.subClient.on('connect', () => {
        this.logger.log('Redis SubClient connected');
      });

      this.subClient.on('ready', () => {
        this.logger.log('Redis SubClient is ready to use');
      });

      this.subClient.on('error', (err) => {
        this.logger.error(`Redis SubClient Error: ${err.message}`);
      });

      // Aguarda as conexões
      await this.pubClient.connect();
      await this.subClient.connect();

      // Configura o adaptador do Socket.IO com os clientes Redis
      this.server.adapter(createAdapter(this.pubClient, this.subClient));
      this.logger.log('Redis adapter initialized for Socket.IO');
    } catch (error) {
      this.logger.error(`Failed to initialize Redis adapter: ${error.message}`);
    }
  }
}
