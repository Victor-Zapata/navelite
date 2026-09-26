import {
    Body,
    Controller,
    Headers,
    HttpCode,
    Logger,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { verifySignature } from './signature';
import { transitionAndEmit } from '../payments/outbox';
import { PaymentStatus } from '../payments/domain/payment';

const TRANSITIONS: Record<string, [PaymentStatus, PaymentStatus]> = {
    'payment.authorized': ['created', 'authorized'],
    'payment.captured': ['authorized', 'captured'],
    'payment.failed': ['created', 'failed'],
    'payment.refunded': ['captured', 'refunded'],
};

@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
    private readonly logger = new Logger('Webhooks');

    @Post('processor')
    @HttpCode(200)
    async receive(
        @Req() req: any,
        @Body() body: any,
        @Headers('x-navelite-signature') signature: string,
    ) {
        const secret = process.env.WEBHOOK_SECRET ?? 'whsec_dev_only_change_me';
        const check = verifySignature(req.rawBody, signature, secret);

        if (!check.ok) {
            this.logger.warn({ msg: 'webhook rejected', reason: check.reason });
            throw new UnauthorizedException(check.reason);
        }

        const { paymentId, event } = body ?? {};
        if (!paymentId || !event) {
            return { received: true, ignored: 'missing paymentId or event' };
        }

        const transition = TRANSITIONS[event];
        if (!transition) {
            this.logger.log({ msg: 'unknown event ignored', event });
            return { received: true, ignored: event };
        }

        try {
            await transitionAndEmit(paymentId, transition[0], transition[1], event, body);
            this.logger.log({ msg: 'webhook applied', paymentId, event });
            return { received: true, applied: true };
        } catch (e: any) {
            if (e.name === 'TransactionCanceledException') {
                this.logger.log({ msg: 'webhook ignored, state already advanced', paymentId, event });
                return { received: true, duplicate: true };
            }
            throw e;
        }
    }

    @Post('sink')
    @HttpCode(200)
    sink(@Body() body: any) {
        this.logger.log({ msg: 'merchant sink received', type: body?.type, paymentId: body?.paymentId });
        return { ok: true };
    }
}