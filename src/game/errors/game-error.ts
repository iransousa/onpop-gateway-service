export class GameError extends Error {
  public statusCode: number;

  constructor(
    public code: string,
    message: string,
    statusCode = 400, // Define um status padrão para erros do jogo
  ) {
    super(message);
    this.name = 'GameError';
    this.statusCode = statusCode;

    // Preserva o stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GameError);
    }
  }
}
