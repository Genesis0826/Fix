import { Module } from '@nestjs/common';
import { PillarService } from './pillar.service';

@Module({
  providers: [PillarService],
  exports: [PillarService],
})
export class PillarModule {}
