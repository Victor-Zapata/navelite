import { TransactWriteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { ddb, TABLE } from '../infra/dynamo.client';
import { PaymentStatus } from './domain/payment';

export interface OutboxEvent {
    pk: string;
    sk: string;
    eventType: string;
    paymentId: string;
    payload: Record<string, unknown>;
    attempts: number;
    createdAt: string;
}

export async function transitionAndEmit(
    paymentId: string,
    from: PaymentStatus,
    to: PaymentStatus,
    eventType: string,
    payload: Record<string, unknown>,
): Promise<void> {
    const now = new Date().toISOString();
    const sk = `EVT#${now}#${randomUUID().slice(0, 8)}`;

    await ddb.send(
        new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: TABLE,
                        Key: { pk: `PAY#${paymentId}`, sk: 'META' },
                        UpdateExpression: 'SET #s = :to, updatedAt = :now',
                        ConditionExpression: 'attribute_exists(pk) AND #s = :from',
                        ExpressionAttributeNames: { '#s': 'status' },
                        ExpressionAttributeValues: { ':to': to, ':from': from, ':now': now },
                    },
                },
                {
                    Put: {
                        TableName: TABLE,
                        Item: {
                            pk: `PAY#${paymentId}`,
                            sk,
                            gsi1pk: 'OUTBOX#PENDING',
                            gsi1sk: now,
                            eventType,
                            paymentId,
                            payload,
                            attempts: 0,
                            createdAt: now,
                        },
                    },
                },
            ],
        }),
    );
}

export async function fetchPending(limit = 10): Promise<OutboxEvent[]> {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :p',
            ExpressionAttributeValues: { ':p': 'OUTBOX#PENDING' },
            ScanIndexForward: true,
            Limit: limit,
        }),
    );
    return (res.Items ?? []) as OutboxEvent[];
}

export async function markPublished(pk: string, sk: string): Promise<void> {
    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { pk, sk },
            UpdateExpression: 'SET publishedAt = :now REMOVE gsi1pk, gsi1sk',
            ExpressionAttributeValues: { ':now': new Date().toISOString() },
        }),
    );
}

export async function markFailed(pk: string, sk: string, error: string): Promise<void> {
    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { pk, sk },
            UpdateExpression: 'SET attempts = if_not_exists(attempts, :z) + :one, lastError = :e',
            ExpressionAttributeValues: { ':one': 1, ':z': 0, ':e': error },
        }),
    );
}