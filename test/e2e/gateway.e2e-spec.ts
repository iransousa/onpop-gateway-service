// test/e2e/gateway.e2e-spec.ts

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '@src/app.module';
import * as http from 'http';

describe('GatewayService (e2e)', () => {
  let app: INestApplication;
  let server: http.Server;
  let port: number;

  // beforeAll(async () => {
  //   const moduleFixture = await Test.createTestingModule({
  //     imports: [AppModule], // Importe seu módulo principal
  //   }).compile();
  //
  //   app = moduleFixture.createNestApplication();
  //   await app.init();
  //
  //   // Crie um servidor HTTP para o Socket.IO
  //   server = http.createServer(app.getHttpAdapter().getInstance());
  //   server.listen(0); // Porta aleatória
  //   port = (server.address() as any).port;
  // });
  //
  // afterAll(async () => {
  //   await app.close();
  //   server.close();
  // });

  // function createSocketConnection(token: string): Socket {
  //   return io(`http://localhost:${port}`, {
  //     transports: ['websocket'],
  //     forceNew: true,
  //     query: {
  //       token,
  //     },
  //   });
  // }

  // it('Simula uma partida com 2 jogadores', (done) => {
  //   const player1Socket = createSocketConnection('player1');
  //   const player2Socket = createSocketConnection('player2');
  //
  //   let player1Ready = false;
  //   let player2Ready = false;
  //
  //   function checkIfDone() {
  //     if (player1Ready && player2Ready) {
  //       // Simule ações dos jogadores aqui
  //       // Por exemplo, emitir 'play_tile' ou 'draw_tile'
  //
  //       // Após as ações, desconecte os sockets e finalize o teste
  //       setTimeout(() => {
  //         player1Socket.disconnect();
  //         player2Socket.disconnect();
  //         done();
  //       }, 5000);
  //     }
  //   }
  //
  //   player1Socket.on('connect', () => {
  //     console.log('Player 1 conectado');
  //     player1Socket.emit('join_matchmaking', {
  //       betAmount: 100,
  //       minPlayers: 2,
  //     });
  //     player1Ready = true;
  //     checkIfDone();
  //   });
  //
  //   player2Socket.on('connect', () => {
  //     console.log('Player 2 conectado');
  //     player2Socket.emit('join_matchmaking', {
  //       betAmount: 100,
  //       minPlayers: 2,
  //     });
  //     player2Ready = true;
  //     checkIfDone();
  //   });
  // });
  //
  // it('Simula uma partida com 3 jogadores', (done) => {
  //   const player1Socket = createSocketConnection('player1');
  //   const player2Socket = createSocketConnection('player2');
  //   const player3Socket = createSocketConnection('player3');
  //
  //   let readyCount = 0;
  //
  //   function checkIfDone() {
  //     if (readyCount === 3) {
  //       // Simule ações dos jogadores aqui
  //
  //       // Após as ações, desconecte os sockets e finalize o teste
  //       setTimeout(() => {
  //         player1Socket.disconnect();
  //         player2Socket.disconnect();
  //         player3Socket.disconnect();
  //         done();
  //       }, 5000);
  //     }
  //   }
  //
  //   [player1Socket, player2Socket, player3Socket].forEach((socket, index) => {
  //     socket.on('connect', () => {
  //       console.log(`Player ${index + 1} conectado`);
  //       socket.emit('join_matchmaking', {
  //         betAmount: 100,
  //         minPlayers: 3,
  //       });
  //       readyCount++;
  //       checkIfDone();
  //     });
  //   });
  // });
  //
  // it('Simula uma partida bloqueada com 4 jogadores', (done) => {
  //   const player1Socket = createSocketConnection('player1');
  //   const player2Socket = createSocketConnection('player2');
  //   const player3Socket = createSocketConnection('player3');
  //   const player4Socket = createSocketConnection('player4');
  //
  //   let readyCount = 0;
  //
  //   function checkIfDone() {
  //     if (readyCount === 4) {
  //       // Simule ações que levam ao bloqueio do jogo
  //
  //       // Por exemplo, manipule o estado interno do jogo para forçar o bloqueio
  //
  //       // Verifique se o jogador com a menor soma de pedras é declarado vencedor
  //       player1Socket.on('game_over', (result) => {
  //         expect(result.winnerId).toBeDefined();
  //         console.log(`Jogador vencedor: ${result.winnerId}`);
  //         player1Socket.disconnect();
  //         player2Socket.disconnect();
  //         player3Socket.disconnect();
  //         player4Socket.disconnect();
  //         done();
  //       });
  //
  //       // Após as ações, desconecte os sockets e finalize o teste
  //       // setTimeout(() => {
  //       //   player1Socket.disconnect();
  //       //   player2Socket.disconnect();
  //       //   player3Socket.disconnect();
  //       //   player4Socket.disconnect();
  //       //   done();
  //       // }, 5000);
  //     }
  //   }
  //
  //   [player1Socket, player2Socket, player3Socket, player4Socket].forEach(
  //     (socket, index) => {
  //       socket.on('connect', () => {
  //         console.log(`Player ${index + 1} conectado`);
  //         socket.emit('join_matchmaking', {
  //           betAmount: 100,
  //           minPlayers: 4,
  //         });
  //         readyCount++;
  //         checkIfDone();
  //       });
  //     },
  //   );
  // });
});
