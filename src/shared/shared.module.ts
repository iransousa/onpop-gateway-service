import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { AppLogger } from './logger/logger.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    AppLogger,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const client = createClient({
          url: `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          username: configService.get<string>('REDIS_USERNAME') || undefined,
        });

        client.on('error', (err) => console.error('Redis Client Error', err));

        await client.connect();

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [AppLogger, 'REDIS_CLIENT'],
})
export class SharedModule {}
