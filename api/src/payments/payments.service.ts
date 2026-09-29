import { Injectable, NotFoundException } from '@nestjs/common';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ddb, TABLE } from '../infra/dynamo.client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Payment } from './domain/payment';
import { priceIt } from './domain/pricing';

@Injectable()
export class PaymentsService {
    async create(dto: CreatePaymentDto) {
        const now = new Date().toISOString();
        const id = `pay_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
        const breakdown = priceIt(dto.amountCents, dto.installments);

        const payment: Payment = {
            id,
            merchantId: dto.merchantId,
            amountCents: dto.amountCents,
            currency: 'ARS',
            installments: dto.installments,
            status: 'created',
            createdAt: now,
            updatedAt: now,
        };

        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: {
                    pk: `PAY#${id}`,
                    sk: 'META',
                    gsi1pk: `MERCHANT#${dto.merchantId}`,
                    gsi1sk: `CREATED#${now}`,
                    ...payment,
                    orderId: dto.orderId,
                    breakdown,
                },
                ConditionExpression: 'attribute_not_exists(pk)',
            }),
        );

        return {
            ...payment,
            breakdown,
            qr: `00020101021243650016ar.com.navelite0111${id}`,
            checkoutUrl: `${process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173'}/checkout/${id}`,
        };
    }

    async findOne(id: string) {
        const res = await ddb.send(
            new GetCommand({ TableName: TABLE, Key: { pk: `PAY#${id}`, sk: 'META' } }),
        );
        if (!res.Item) throw new NotFoundException(`Payment ${id} not found`);
        return res.Item;
    }

    async listByMerchant(merchantId: string, limit = 25) {
        const res = await ddb.send(
            new QueryCommand({
                TableName: TABLE,
                IndexName: 'gsi1',
                KeyConditionExpression: 'gsi1pk = :m',
                ExpressionAttributeValues: { ':m': `MERCHANT#${merchantId}` },
                ScanIndexForward: false,
                Limit: limit,
            }),
        );
        return res.Items ?? [];
    }
    async timeline(id: string) {
        const res = await ddb.send(
            new QueryCommand({
                TableName: TABLE,
                KeyConditionExpression: 'pk = :p AND begins_with(sk, :e)',
                ExpressionAttributeValues: { ':p': `PAY#${id}`, ':e': 'EVT#' },
                ScanIndexForward: true,
            }),
        );
        return (res.Items ?? []).map((i) => ({
            id: i.sk,
            type: i.eventType,
            createdAt: i.createdAt,
            publishedAt: i.publishedAt ?? null,
            attempts: i.attempts ?? 0,
            lastError: i.lastError ?? null,
        }));
    }
}