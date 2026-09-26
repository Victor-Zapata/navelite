import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const isLocal = process.env.NODE_ENV !== 'production';

export const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
        ...(isLocal && {
            endpoint: 'http://localhost:8000',
            credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }),
    }),
    { marshallOptions: { removeUndefinedValues: true } },
);

export const TABLE = process.env.TABLE_NAME ?? 'navelite';