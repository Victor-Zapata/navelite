import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WorkerModule } from './worker/worker.module';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({
            pinoHttp: {
                genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
                transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
                redact: ['req.headers.authorization', 'req.headers["idempotency-key"]'],
            },
        }),
        PaymentsModule,
        WebhooksModule,
        WorkerModule
    ],
    controllers: [HealthController],
})
export class AppModule { }