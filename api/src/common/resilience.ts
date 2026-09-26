export async function withRetry<T>(
    fn: () => Promise<T>,
    opts: { attempts?: number; baseMs?: number; maxMs?: number } = {},
): Promise<T> {
    const { attempts = 5, baseMs = 200, maxMs = 8000 } = opts;
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (i === attempts - 1) break;
            const backoff = Math.min(maxMs, baseMs * 2 ** i);
            const jitter = Math.random() * backoff * 0.5;
            await new Promise((r) => setTimeout(r, backoff + jitter));
        }
    }
    throw lastError;
}

type State = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
    private state: State = 'closed';
    private failures = 0;
    private openedAt = 0;

    constructor(
        private readonly name: string,
        private readonly threshold = 5,
        private readonly cooldownMs = 30_000,
    ) { }

    async exec<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.openedAt < this.cooldownMs) {
                throw new Error(`circuit open for ${this.name}: refusing to call downstream`);
            }
            this.state = 'half-open';
        }

        try {
            const result = await fn();
            this.failures = 0;
            this.state = 'closed';
            return result;
        } catch (err) {
            this.failures++;
            if (this.state === 'half-open' || this.failures >= this.threshold) {
                this.state = 'open';
                this.openedAt = Date.now();
            }
            throw err;
        }
    }

    get status() {
        return { name: this.name, state: this.state, failures: this.failures };
    }
}