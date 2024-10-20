import { Injectable } from '@nestjs/common';
import { GameStateManager } from 'src/game/game.state.manager';

@Injectable()
export class GameReportService {
  constructor(private readonly gameStateManager: GameStateManager) {}

  async generateGameReport(gameId: string): Promise<any> {
    const gameData = await this.fetchGameData(gameId); // Simulated fetch, replace with actual data fetching

    if (!gameData) {
      throw new Error('Game not found');
    }

    const moves = gameData.moveHistory.map((move, index) => ({
      number: index + 1,
      playerId: move.playerId,
      action: move.action,
      tile: move.tile,
      side: move.side,
      timestamp: move.timestamp,
    }));

    const report: any = {
      gameId: gameData.roomId,
      players: gameData.players,
      winner: gameData.winner,
      reason: gameData.reason,
      moves,
      betAmount: gameData.betAmount,
      boardState: gameData.board,
      totalPlays: moves.length,
      disconnectedPlayers: gameData.disconnectedPlayers,
      createdAt: gameData.createdAt,
      finishedAt: gameData.finishedAt,
      hands: gameData.hands,
      drawPile: gameData.drawPile,
      drawPileCount: gameData.drawPileCount,
      scores: gameData.scores,
    };

    return report;
  }

  generateHtmlReport(report: any): string {
    return `
      <html>
        <head>
          <title>Game Report</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            table, th, td { border: 1px solid black; }
            th, td { padding: 10px; text-align: center; }
            .board { display: flex; flex-wrap: wrap; margin-top: 20px; justify-content: center; }
            .tile { display: flex; align-items: center; justify-content: center; border: 2px solid black; width: 60px; height: 30px; margin: 2px; font-weight: bold; }
            .tile.horizontal { flex-direction: row; }
            .tile.vertical { flex-direction: column; }
          </style>
        </head>
        <body>
          <h1>Game Report for ${report.gameId}</h1>
          <p><strong>Gameid:</strong> ${report.gameId}</p>
          <p><strong>Players:</strong> ${report.players.join(', ')}</p>
          <p><strong>Winner:</strong> ${report.winner}</p>
          <p><strong>How they won:</strong> ${report.reason}</p>
          <p><strong>Bet Amount:</strong> ${report.betAmount}</p>
          <p><strong>Total Plays:</strong> ${report.totalPlays}</p>
          <p><strong>Draw Pile Count:</strong> ${report.drawPileCount}</p>
          <p><strong>Created At:</strong> ${report.createdAt}</p>
          <p><strong>Finished At:</strong> ${report.finishedAt}</p>
          <h2>Final Hands:</h2>
          <table>
            <thead>
              <tr>
                <th>Player ID</th>
                <th>Hand</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(report.hands)
                .map(
                  ([playerId, hand]) => `
                <tr>
                  <td>${playerId}</td>
                  <td>${Array.isArray(hand) ? hand.map((tile) => `${tile.left} | ${tile.right}`).join(', ') : ''}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>          
          <h2>Draw Pile:</h2>
          <table>
            <thead>
              <tr>
                <th>Left</th>
              </tr>
            </thead>
            <tbody>
              ${report.drawPile
                .map(
                  (draw) => `
                <tr>
                  <td>${draw.left} | ${draw.right}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>              
          <h2>Scores:</h2>
          <table>
            <thead>
              <tr>
                <th>Left</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(report.scores)
                .map(
                  ([playerId, score]) => `
                <tr>
                  <td>${playerId}</td>
                  <td>${score}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>                  
          <h2>Moves:</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player ID</th>
                <th>Action</th>
                <th>Tile</th>
                <th>Side</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${report.moves
                .map(
                  (move) => `
                <tr>
                  <td>${move.number}</td>
                  <td>${move.playerId}</td>
                  <td>${move.action}</td>
                  <td>${move.tile?.left} | ${move.tile?.right}</td>
                  <td>${move.side ? move.side : '--'}</td>
                  <td>${move.action === 'play' ? new Date(move.tile?.timestamp).toLocaleString() : new Date(move.timestamp).toLocaleString()}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
          <h2>Board State:</h2>
          <div class="board">
            ${report.boardState
              .sort((a, b) => a.timestamp - b.timestamp)
              .map(
                (tile) => `
              <div class="tile ${tile.left === tile.right ? 'vertical' : tile.side === 'left' || tile.side === 'right' ? 'horizontal' : 'vertical'}">
                ${tile.left} | ${tile.right}
              </div>
            `,
              )
              .join('')}
          </div>
        </body>
      </html>
    `;
  }

  private async fetchGameData(gameId: string): Promise<any> {
    return this.gameStateManager.getGameState(gameId);
  }
}
