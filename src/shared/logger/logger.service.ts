// shared/logger/logger.service.ts

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import {
  createLogger,
  Logger as WinstonLogger,
  transports,
  format,
} from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context?: string;
  private winstonLogger: WinstonLogger;

  constructor() {
    this.winstonLogger = createLogger({
      level: 'debug',
      format: format.combine(
        format.timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
        format.colorize({
          all: true,
        }),
        format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `[App] - ${timestamp} [${level}]${context ? ` [${context}]` : ''} ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        }),
      ),
      transports: [new transports.Console()],
      exitOnError: false,
    });
  }

  public setContext(context: string): void {
    this.context = context;
  }

  log(message: string, ...optionalParams: any[]): void {
    this.winstonLogger.info(message, {
      context: this.context,
      ...optionalParams,
    });
  }

  error(message: string, ...optionalParams: any[]): void {
    this.winstonLogger.error(message, {
      context: this.context,
      ...optionalParams,
    });
  }

  warn(message: string, ...optionalParams: any[]): void {
    this.winstonLogger.warn(message, {
      context: this.context,
      ...optionalParams,
    });
  }

  debug?(message: string, ...optionalParams: any[]): void {
    this.winstonLogger.debug(message, {
      context: this.context,
      ...optionalParams,
    });
  }

  verbose?(message: string, ...optionalParams: any[]): void {
    this.winstonLogger.verbose(message, {
      context: this.context,
      ...optionalParams,
    });
  }
}
