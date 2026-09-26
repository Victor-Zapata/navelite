import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PaymentsModule } from './payments/payments.module';

@Module({
    imports: [
        LoggerModule.forRoot({
            pinoHttp: {
                genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
                transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
                redact: ['req.headers.authorization', 'req.headers["idempotency-key"]'],
            },
        }),
        PaymentsModule,
    ],
})
export class AppModule { }