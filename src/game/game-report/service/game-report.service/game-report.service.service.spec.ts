import { Test, TestingModule } from '@nestjs/testing';
import { GameReportService } from '@src/game/game-report/service/game-report.service/game-report.service.service';

describe('GameReportServiceService', () => {
  let service: GameReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameReportService],
    }).compile();

    service = module.get<GameReportService>(GameReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
