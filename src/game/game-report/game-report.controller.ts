import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { GameReportService } from '@src/game/game-report/service/game-report.service/game-report.service.service';

// import * as puppeteer from 'puppeteer';

@Controller('game-report')
export class GameReportController {
  constructor(private readonly gameReportService: GameReportService) {}

  @Get(':gameId')
  async getGameReport(@Param('gameId') gameId: string): Promise<any> {
    return this.gameReportService.generateGameReport(gameId);
  }

  @Get('html/:gameId')
  async getGameReportHtml(
    @Param('gameId') gameId: string,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.gameReportService.generateGameReport(gameId);
    const html = this.gameReportService.generateHtmlReport(report);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // @Get(':gameId/pdf')
  // async getGameReportPdf(
  //   @Param('gameId') gameId: string,
  //   @Res() res: Response,
  // ): Promise<void> {
  //   const report = await this.gameReportService.generateGameReport(gameId);
  //   const html = this.gameReportService.generateHtmlReport(report);
  //
  //   const browser = await puppeteer.launch();
  //   const page = await browser.newPage();
  //   await page.setContent(html);
  //   const pdf = await page.pdf({ format: 'A4' });
  //   await browser.close();
  //
  //   res.setHeader('Content-Type', 'application/pdf');
  //   res.setHeader(
  //     'Content-Disposition',
  //     'attachment; filename=game_report.pdf',
  //   );
  //   res.send(pdf);
  // }
}
