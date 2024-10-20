import { Test, TestingModule } from '@nestjs/testing';
import { GameReportController } from './game-report.controller';

describe('GameReportController', () => {
  let controller: GameReportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameReportController],
    }).compile();

    controller = module.get<GameReportController>(GameReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
