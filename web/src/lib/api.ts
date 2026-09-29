const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface Breakdown {
    amountCents: number;
    installments: number;
    customerTotalCents: number;
    installmentCents: number;
    feeCents: number;
    vatOnFeeCents: number;
    netToMerchantCents: number;
    settlementDate: string;
}

export interface Payment {
    id: string;
    merchantId: string;
    orderId?: string;
    amountCents: number;
    currency: string;
    installments: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    breakdown?: Breakdown;
}

export interface TimelineEvent {
    id: string;
    type: string;
    createdAt: string;
    publishedAt: string | null;
    attempts: number;
    lastError: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`${res.status}: ${detail}`);
    }
    return res.json();
}

export const api = {
    health: () => req<{ status: string; uptimeSeconds: number }>('/health'),

    listPayments: (merchantId: string) =>
        req<Payment[]>(`/v1/payments?merchantId=${encodeURIComponent(merchantId)}`),

    getPayment: (id: string) => req<Payment>(`/v1/payments/${id}`),

    getEvents: (id: string) => req<TimelineEvent[]>(`/v1/payments/${id}/events`),

    createPayment: (body: {
        merchantId: string;
        orderId: string;
        amountCents: number;
        installments: number;
    }) =>
        req<Payment>('/v1/payments', {
            method: 'POST',
            headers: { 'idempotency-key': crypto.randomUUID() },
            body: JSON.stringify(body),
        }),

    simulate: (paymentId: string, event: string) =>
        req<{ simulated: boolean; result: unknown }>(
            `/v1/webhooks/simulate/${paymentId}/${event}`,
            { method: 'POST' },
        ),
};

export const money = (cents: number) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(cents / 100);