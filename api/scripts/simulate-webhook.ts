import { sign } from '../src/webhooks/signature';

async function main() {
    const [paymentId, event] = process.argv.slice(2);

    if (!paymentId || !event) {
        console.error('uso: npx tsx scripts/simulate-webhook.ts <paymentId> <event>');
        console.error('eventos: payment.authorized | payment.captured | payment.failed | payment.refunded');
        process.exit(1);
    }

    const secret = process.env.WEBHOOK_SECRET ?? 'whsec_dev_only_change_me';
    const body = JSON.stringify({
        paymentId,
        event,
        processorRef: `proc_${Date.now()}`,
        occurredAt: new Date().toISOString(),
    });

    const res = await fetch('http://127.0.0.1:3000/v1/webhooks/processor', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-navelite-signature': sign(body, secret),
        },
        body,
    });

    console.log(res.status, await res.text());
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});