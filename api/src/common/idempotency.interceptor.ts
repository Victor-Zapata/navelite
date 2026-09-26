import {
    BadRequestException,
    CallHandler,
    ConflictException,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'node:crypto';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { ddb, TABLE } from '../infra/dynamo.client';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();

        const key = req.headers['idempotency-key'];
        if (!key) throw new BadRequestException('Idempotency-Key header is required');

        const merchantId = req.body?.merchantId ?? 'anon';
        const pk = `IDEM#${merchantId}#${key}`;

        const fingerprint = createHash('sha256')
            .update(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})))
            .digest('hex');

        return from(
            ddb.send(new GetCommand({ TableName: TABLE, Key: { pk, sk: 'META' } })),
        ).pipe(
            switchMap((existing) => {
                if (existing.Item) {
                    if (existing.Item.fingerprint !== fingerprint) {
                        throw new ConflictException(
                            'Idempotency-Key already used with a different request body',
                        );
                    }
                    res.setHeader('Idempotent-Replay', 'true');
                    return of(existing.Item.response);
                }

                return next.handle().pipe(
                    tap(async (response) => {
                        await ddb.send(
                            new PutCommand({
                                TableName: TABLE,
                                Item: {
                                    pk,
                                    sk: 'META',
                                    fingerprint,
                                    response,
                                    ttl: Math.floor(Date.now() / 1000) + 86400,
                                },
                                ConditionExpression: 'attribute_not_exists(pk)',
                            }),
                        );
                    }),
                );
            }),
        );
    }
}