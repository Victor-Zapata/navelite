import { Module } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';

@Module({ providers: [DispatcherService] })
export class WorkerModule { }