import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { fetchPending, markPublished, markFailed } from '../payments/outbox';
import { CircuitBreaker, withRetry } from '../common/resilience';
import { sign } from '../webhooks/signature';

const MAX_ATTEMPTS = 5;

@Injectable()
export class DispatcherService implements OnModuleInit {
    private readonly logger = new Logger('Dispatcher');
    private readonly breakers = new Map<string, CircuitBreaker>();
    private running = false;

    onModuleInit() {
        setInterval(() => this.tick(), 3000);
    }

    private breakerFor(url: string): CircuitBreaker {
        const host = new URL(url).host;
        if (!this.breakers.has(host)) {
            this.breakers.set(host, new CircuitBreaker(host));
        }
        return this.breakers.get(host)!;
    }

    async tick() {
        if (this.running) return;
        this.running = true;

        try {
            const events = await fetchPending(10);
            for (const evt of events) {
                if (evt.attempts >= MAX_ATTEMPTS) {
                    this.logger.error({ msg: 'event moved to dead letter', sk: evt.sk, attempts: evt.attempts });
                    await markPublished(evt.pk, evt.sk);
                    continue;
                }
                await this.deliver(evt);
            }
        } catch (e: any) {
            this.logger.error({ msg: 'dispatcher tick failed', detail: e.message });
        } finally {
            this.running = false;
        }
    }

    private async deliver(evt: any) {
        const url = process.env.MERCHANT_WEBHOOK_URL ?? 'http://127.0.0.1:3000/v1/webhooks/sink';
        const secret = process.env.MERCHANT_SECRET ?? 'whsec_merchant_dev';

        const payload = JSON.stringify({
            id: evt.sk,
            type: evt.eventType,
            paymentId: evt.paymentId,
            createdAt: evt.createdAt,
            data: evt.payload,
        });

        try {
            await withRetry(
                () =>
                    this.breakerFor(url).exec(async () => {
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'content-type': 'application/json',
                                'x-navelite-signature': sign(payload, secret),
                            },
                            body: payload,
                            signal: AbortSignal.timeout(5000),
                        });
                        if (!res.ok) throw new Error(`merchant returned ${res.status}`);
                    }),
                { attempts: 3, baseMs: 300 },
            );

            await markPublished(evt.pk, evt.sk);
            this.logger.log({ msg: 'event delivered', type: evt.eventType, paymentId: evt.paymentId });
        } catch (e: any) {
            await markFailed(evt.pk, evt.sk, e.message);
            this.logger.warn({
                msg: 'delivery failed',
                paymentId: evt.paymentId,
                detail: e.message,
                breaker: this.breakerFor(url).status,
            });
        }
    }
}