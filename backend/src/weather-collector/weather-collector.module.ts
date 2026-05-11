import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { WeathercollectorService } from './weather-collector.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  providers: [WeathercollectorService],
})
export class WeathercollectorModule {}
