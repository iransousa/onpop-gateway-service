import { Injectable } from '@nestjs/common';

@Injectable()
export class TimerService {
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private warningTimers: Map<string, NodeJS.Timeout> = new Map();

  setTurnTimer(roomId: string, timer: NodeJS.Timeout) {
    this.turnTimers.set(roomId, timer);
  }

  clearTurnTimer(roomId: string) {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  setWarningTimer(roomId: string, timer: NodeJS.Timeout) {
    this.warningTimers.set(roomId, timer);
  }

  clearWarningTimer(roomId: string) {
    const timer = this.warningTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.warningTimers.delete(roomId);
    }
  }
}
