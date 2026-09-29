import { useCallback, useEffect, useState } from 'react';
import { api, money, type Payment, type TimelineEvent } from '../lib/api';
import { StatusBadge } from './PaymentList';

const NEXT_EVENT: Record<string, { event: string; label: string } | null> = {
    created: { event: 'authorized', label: 'Simular autorización' },
    authorized: { event: 'captured', label: 'Simular acreditación' },
    captured: { event: 'refunded', label: 'Simular devolución' },
    failed: null,
    refunded: null,
};

export function PaymentDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
    const [payment, setPayment] = useState<Payment | null>(null);
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [p, e] = await Promise.all([api.getPayment(id), api.getEvents(id)]);
            setPayment(p);
            setEvents(e);
            setError(null);
        } catch (err) {
            setError((err as Error).message);
        }
    }, [id]);

    useEffect(() => {
        load();
        const timer = setInterval(load, 3000);
        return () => clearInterval(timer);
    }, [load]);

    if (error) return <p className="error">{error}</p>;
    if (!payment) return <p className="muted">Cargando…</p>;

    const next = NEXT_EVENT[payment.status];
    const b = payment.breakdown;

    const simulate = async () => {
        if (!next) return;
        setBusy(true);
        try {
            await api.simulate(id, next.event);
            await load();
            onChanged();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card">
            <div className="detail-head">
                <div>
                    <h2>{payment.orderId ?? payment.id}</h2>
                    <p className="muted small">{payment.id}</p>
                </div>
                <StatusBadge status={payment.status} />
            </div>

            {b && (
                <table className="breakdown">
                    <tbody>
                        <tr><td>Monto del cobro</td><td>{money(b.amountCents)}</td></tr>
                        <tr>
                            <td>Paga el cliente ({b.installments}x {money(b.installmentCents)})</td>
                            <td>{money(b.customerTotalCents)}</td>
                        </tr>
                        <tr><td>Arancel</td><td className="neg">−{money(b.feeCents)}</td></tr>
                        <tr><td>IVA sobre arancel</td><td className="neg">−{money(b.vatOnFeeCents)}</td></tr>
                        <tr className="total">
                            <td>Neto a acreditar el {b.settlementDate}</td>
                            <td>{money(b.netToMerchantCents)}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            {next && (
                <button onClick={simulate} disabled={busy} className="primary">
                    {busy ? 'Enviando…' : next.label}
                </button>
            )}

            <h3>Eventos</h3>
            {events.length === 0 ? (
                <p className="muted small">Sin eventos todavía.</p>
            ) : (
                <ul className="timeline">
                    {events.map((e) => (
                        <li key={e.id}>
                            <strong>{e.type}</strong>
                            <span className="muted small">
                                {new Date(e.createdAt).toLocaleString('es-AR')}
                            </span>
                            <span className={e.publishedAt ? 'ok' : 'pending'}>
                                {e.publishedAt
                                    ? `entregado al comercio`
                                    : `en cola${e.attempts ? ` · ${e.attempts} intentos` : ''}`}
                            </span>
                            {e.lastError && <span className="error small">{e.lastError}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}