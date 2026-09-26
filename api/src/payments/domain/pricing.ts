export const INSTALLMENT_COEFFICIENT: Record<number, number> = {
    1: 1.0,
    3: 1.1256,
    6: 1.2436,
    12: 1.5127,
};

export const MERCHANT_FEE_RATE = 0.0179;
export const VAT_RATE = 0.21;
export const SETTLEMENT_DAYS = 10;

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

export function priceIt(amountCents: number, installments: number): Breakdown {
    const coeff = INSTALLMENT_COEFFICIENT[installments];
    if (!coeff) throw new Error(`Unsupported installments: ${installments}`);

    const customerTotalCents = Math.round(amountCents * coeff);
    const installmentCents = Math.round(customerTotalCents / installments);
    const feeCents = Math.round(amountCents * MERCHANT_FEE_RATE);
    const vatOnFeeCents = Math.round(feeCents * VAT_RATE);

    const settle = new Date();
    settle.setDate(settle.getDate() + SETTLEMENT_DAYS);

    return {
        amountCents,
        installments,
        customerTotalCents,
        installmentCents,
        feeCents,
        vatOnFeeCents,
        netToMerchantCents: amountCents - feeCents - vatOnFeeCents,
        settlementDate: settle.toISOString().slice(0, 10),
    };
}