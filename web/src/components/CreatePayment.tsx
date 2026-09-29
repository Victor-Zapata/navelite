import { useState } from 'react';
import { api } from '../lib/api';

export function CreatePayment({
    merchantId,
    onCreated,
}: {
    merchantId: string;
    onCreated: (id: string) => void;
}) {
    const [amount, setAmount] = useState('5000');
    const [installments, setInstallments] = useState(3);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        const pesos = Number(amount);
        if (!pesos || pesos < 1) {
            setError('Ingresá un monto mayor a $1');
            return;
        }

        setBusy(true);
        setError(null);
        try {
            const p = await api.createPayment({
                merchantId,
                orderId: `ORD-${Date.now().toString().slice(-6)}`,
                amountCents: Math.round(pesos * 100),
                installments,
            });
            onCreated(p.id);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="card">
            <h2>Nuevo cobro</h2>
            <div className="form-row">
                <label>
                    Monto (ARS)
                    <input
                        type="number"
                        value={amount}
                        min={1}
                        onChange={(e) => { setAmount(e.target.value); setError(null); }}
                    />
                </label>
                <label>
                    Cuotas
                    <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                        {[1, 3, 6, 12].map((n) => (
                            <option key={n} value={n}>{n} {n === 1 ? 'pago' : 'cuotas'}</option>
                        ))}
                    </select>
                </label>
                <button onClick={submit} disabled={busy}>
                    {busy ? 'Creando…' : 'Crear cobro'}
                </button>
            </div>
            {error && <p className="error">{error}</p>}
        </div>
    );
}