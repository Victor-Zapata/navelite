import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const endpoint = 'http://127.0.0.1:8000';

const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

async function main() {
    console.log(`\n→ probando ${endpoint}\n`);

    let tables: string[] = [];
    try {
        const res = await client.send(new ListTablesCommand({}));
        tables = res.TableNames ?? [];
        console.log('✓ conexión OK');
        console.log('  tablas:', tables.length ? tables.join(', ') : '(ninguna)');
    } catch (e: any) {
        console.error('✗ NO se pudo conectar');
        console.error('  name   :', e.name);
        console.error('  message:', e.message);
        console.error('  code   :', e.$metadata?.httpStatusCode ?? e.code);
        console.error('\n→ docker compose ps  /  docker compose up -d');
        process.exit(1);
    }

    if (!tables.includes('navelite')) {
        console.error('\n✗ la tabla "navelite" NO existe');
        console.error('→ npx tsx scripts/create-table.ts');
        process.exit(1);
    }

    const d = await client.send(new DescribeTableCommand({ TableName: 'navelite' }));
    console.log('✓ tabla navelite:', d.Table?.TableStatus);
    console.log('  índices:', d.Table?.GlobalSecondaryIndexes?.map((i) => `${i.IndexName}=${i.IndexStatus}`).join(', ') ?? '(ninguno)');
    console.log('\n✓ todo en orden\n');
}

main();