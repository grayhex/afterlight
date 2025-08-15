import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Injectable()
export class OrchestratorProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrchestratorProcessor.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private orchestrator: OrchestratorService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.error(e)), 5 * 60 * 1000);
    setTimeout(() => this.tick().catch((e) => this.logger.error(e)), 10 * 1000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const res = await this.orchestrator.processTimers(new Date());
    if (res.finalized || res.unlocked) {
      this.logger.log(`Sweep: finalized=${res.finalized} unlocked=${res.unlocked}`);
    }
  }
}
