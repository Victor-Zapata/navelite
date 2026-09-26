import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

async function main() {
    try {
        await client.send(
            new CreateTableCommand({
                TableName: 'navelite',
                BillingMode: 'PAY_PER_REQUEST',
                AttributeDefinitions: [
                    { AttributeName: 'pk', AttributeType: 'S' },
                    { AttributeName: 'sk', AttributeType: 'S' },
                    { AttributeName: 'gsi1pk', AttributeType: 'S' },
                    { AttributeName: 'gsi1sk', AttributeType: 'S' },
                ],
                KeySchema: [
                    { AttributeName: 'pk', KeyType: 'HASH' },
                    { AttributeName: 'sk', KeyType: 'RANGE' },
                ],
                GlobalSecondaryIndexes: [
                    {
                        IndexName: 'gsi1',
                        KeySchema: [
                            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
                            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
                        ],
                        Projection: { ProjectionType: 'ALL' },
                    },
                ],
            }),
        );
        console.log('Tabla creada con éxito');
    } catch (error) {
        console.error('Error al crear la tabla:', error);
    }
}

main();