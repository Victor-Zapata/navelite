import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.DYNAMO_ENDPOINT;

export const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
        ...(endpoint ? { endpoint } : {}),
    }),
    { marshallOptions: { removeUndefinedValues: true } },
);

export const TABLE = process.env.TABLE_NAME ?? 'navelite';