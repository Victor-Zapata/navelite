export type PaymentStatus =
    | 'created'
    | 'pending'
    | 'authorized'
    | 'captured'
    | 'failed'
    | 'refunded';

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    created: ['pending', 'failed'],
    pending: ['authorized', 'failed'],
    authorized: ['captured', 'failed'],
    captured: ['refunded'],
    failed: [],
    refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    return TRANSITIONS[from].includes(to);
}

export interface Payment {
    id: string;
    merchantId: string;
    amountCents: number;
    currency: 'ARS';
    installments: 1 | 3 | 6 | 12;
    status: PaymentStatus;
    externalRef?: string;
    createdAt: string;
    updatedAt: string;
}