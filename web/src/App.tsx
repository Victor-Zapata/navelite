import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { PaymentList } from './components/PaymentList';
import { PaymentDetail } from './components/PaymentDetail';
import { CreatePayment } from './components/CreatePayment';
import './App.css';

const MERCHANT = 'm_001';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () =>
      api.health().then(() => setOnline(true)).catch(() => setOnline(false));
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>NaveLite</h1>
          <p className="muted small">Pasarela de pagos · comercio {MERCHANT}</p>
        </div>
        <span className={`dot dot--${online === null ? 'idle' : online ? 'up' : 'down'}`}>
          {online === null ? 'conectando' : online ? 'API en línea' : 'API caída'}
        </span>
      </header>

      <CreatePayment
        merchantId={MERCHANT}
        onCreated={(id) => { setSelectedId(id); refresh(); }}
      />

      <div className="columns">
        <section className="card">
          <h2>Cobros</h2>
          <PaymentList
            merchantId={MERCHANT}
            selectedId={selectedId}
            onSelect={setSelectedId}
            refreshKey={refreshKey}
          />
        </section>

        <section>
          {selectedId ? (
            <PaymentDetail id={selectedId} onChanged={refresh} />
          ) : (
            <div className="card empty">
              <p className="muted">Elegí un cobro para ver el detalle.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="footer muted small">
        Los webhooks del procesador se simulan desde esta interfaz, firmados con HMAC
        y entrando por el mismo endpoint público que usaría un procesador real.
      </footer>
    </div>
  );
}