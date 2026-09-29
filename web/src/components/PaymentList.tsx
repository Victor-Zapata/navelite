import { useEffect, useState } from 'react';
import { api, money, type Payment } from '../lib/api';

const STATUS_LABEL: Record<string, string> = {
    created: 'Creado',
    pending: 'Pendiente',
    authorized: 'Autorizado',
    captured: 'Acreditado',
    failed: 'Fallido',
    refunded: 'Devuelto',
};

export function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`badge badge--${status}`}>
            {STATUS_LABEL[status] ?? status}
        </span>
    );
}

export function PaymentList({
    merchantId,
    selectedId,
    onSelect,
    refreshKey,
}: {
    merchantId: string;
    selectedId: string | null;
    onSelect: (id: string) => void;
    refreshKey: number;
}) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            try {
                const data = await api.listPayments(merchantId);
                if (alive) {
                    setPayments(data);
                    setError(null);
                }
            } catch (e) {
                if (alive) setError((e as Error).message);
            } finally {
                if (alive) setLoading(false);
            }
        };

        load();
        const timer = setInterval(load, 5000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [merchantId, refreshKey]);

    if (loading) return <p className="muted">Cargando pagos…</p>;
    if (error) return <p className="error">No se pudo cargar: {error}</p>;
    if (payments.length === 0) return <p className="muted">Todavía no hay pagos.</p>;

    return (
        <table className="table">
            <thead>
                <tr>
                    <th>Orden</th>
                    <th>Monto</th>
                    <th>Cuotas</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                {payments.map((p) => (
                    <tr
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        className={p.id === selectedId ? 'row row--active' : 'row'}
                    >
                        <td>
                            <strong>{p.orderId ?? '—'}</strong>
                            <div className="muted small">{p.id}</div>
                        </td>
                        <td>{money(p.amountCents)}</td>
                        <td>{p.installments}x</td>
                        <td><StatusBadge status={p.status} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}