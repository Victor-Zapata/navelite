# NaveLite

Pasarela de pagos para comercios argentinos: QR, cuotas, webhooks firmados y
conciliación. Node.js + TypeScript + NestJS en el backend, React en el panel,
DynamoDB como almacenamiento.

**Demo:** https://navelite.vercel.app
**API:** https://navelite-api.fly.dev/health

---

## Qué problema resuelve

Un comercio necesita cobrar. Eso parece una operación simple y no lo es:

- El cobro se inicia en el comercio, pero **se confirma en otro sistema** al que
  no controlás y que puede tardar, fallar o avisarte dos veces.
- El comercio puede reintentar el mismo cobro si se le corta la conexión. Cobrar
  dos veces es un incidente, no un bug menor.
- El dinero que paga el cliente **no es el que recibe el comercio**: hay
  coeficiente de cuotas, arancel, IVA sobre el arancel y un plazo de acreditación.
- Cuando el pago cambia de estado, hay que avisarle al comercio. Si su servidor
  está caído, no podés perder el aviso ni quedarte colgado esperándolo.

NaveLite resuelve esas cuatro cosas.

---

## Probar la demo en 30 segundos

1. Abrí https://navelite.vercel.app
2. Creá un cobro (monto y cuotas).
3. Seleccionalo: vas a ver el desglose completo — lo que paga el cliente, el
   arancel, el IVA y el neto a acreditar con su fecha.
4. Apretá **Simular autorización**. Eso dispara un webhook **firmado con HMAC**
   que entra por el mismo endpoint público que usaría un procesador real.
5. Esperá unos segundos sin tocar nada: el evento pasa de *en cola* a
   *entregado al comercio*. Ese cambio es el patrón outbox y el worker de
   entrega funcionando.

---

## Decisiones de diseño

### Idempotencia persistida, no en memoria

Cada `POST /v1/payments` exige un header `Idempotency-Key`. La clave se guarda
en DynamoDB junto al **hash del cuerpo** de la petición y a la respuesta emitida.

- Misma clave + mismo cuerpo → devuelve la respuesta original con
  `Idempotent-Replay: true`. No se cobra de nuevo.
- Misma clave + cuerpo distinto → `409 Conflict`. Devolver la respuesta vieja
  taparía un bug del que integra.
- La escritura usa `ConditionExpression: attribute_not_exists(pk)`, así dos
  peticiones simultáneas no se pisan.
- Las claves expiran a las 24 h con el TTL nativo de DynamoDB.

Está en DynamoDB y no en un `Map` porque un `Map` muere con el proceso y no se
comparte entre instancias: con dos réplicas, el mismo cobro entraría dos veces.

### Máquina de estados aplicada en la base

`created → pending → authorized → captured → settled`, con `failed` y `refunded`
como salidas. Las transiciones válidas están declaradas explícitamente.

La validación **no** es un `if` en TypeScript: es un `ConditionExpression` sobre
el estado actual dentro de la transacción de DynamoDB. Un `if` no protege contra
dos webhooks que llegan al mismo milisegundo a dos instancias distintas; la
condición en la base sí.

### Webhooks firmados en las dos direcciones

Entrantes y salientes usan el mismo esquema HMAC-SHA256 sobre `timestamp.body`:

- **`timingSafeEqual`** en lugar de `===`: comparar strings corta en la primera
  diferencia, y midiendo ese tiempo se puede deducir la firma carácter por
  carácter (*timing attack*).
- **Timestamp dentro de la firma**, con tolerancia de 5 minutos: firmar solo el
  cuerpo permitiría grabar un webhook legítimo y reenviarlo mañana
  (*replay attack*).
- **Cuerpo crudo**, byte por byte: firmar el objeto ya parseado rompe la firma
  ante cualquier cambio en el orden de las claves.

### Patrón outbox

Actualizar el estado del pago y registrar el evento a publicar ocurren en una
**única transacción**. O pasan las dos cosas, o ninguna.

Sin esto hay dos fallas posibles: guardar el pago y caerse antes de publicar
(el comercio nunca se entera), o publicar y fallar al guardar (avisás de un
pago que no existe).

Un worker lee los pendientes cada 3 segundos, los entrega firmados y los marca
como publicados. Al marcarlos, **borra sus claves del índice secundario**: el
GSI contiene solo pendientes, así que la consulta es siempre pequeña sin
importar cuántos eventos históricos haya acumulados (*sparse index*).

### Resiliencia: reintentos y circuit breaker

- **Backoff exponencial con jitter.** Sin el componente aleatorio, mil entregas
  que fallan juntas reintentan todas al mismo milisegundo y golpean en oleadas
  sincronizadas al servicio que ya estaba caído (*thundering herd*).
- **Circuit breaker por host de destino**, con los tres estados: `closed`,
  `open` y `half-open`. El breaker envuelve **cada intento individual**, no el
  grupo de reintentos: si lo envolviera por fuera contaría llamadas agrupadas y
  nunca vería la cantidad real de fallos.
- **Dead letter** a los 5 intentos. Reintentar para siempre hace que un evento
  envenenado bloquee a todos los que vienen detrás.

### Modelo de datos: tabla única

Una sola tabla con claves compuestas:

| Item | `pk` | `sk` |
|---|---|---|
| Pago | `PAY#<id>` | `META` |
| Clave de idempotencia | `IDEM#<merchant>#<key>` | `META` |
| Evento del outbox | `PAY#<id>` | `EVT#<timestamp>` |

Un pago y todos sus eventos comparten la misma `pk`, así que la línea de tiempo
sale con **una sola consulta**. En un modelo relacional serían dos tablas y un
join.

El índice `gsi1` sirve para dos accesos distintos: listar los pagos de un
comercio por fecha, y levantar los eventos pendientes de publicar.

### Dinero en centavos enteros

Ningún importe se guarda como decimal. `0.1 + 0.2` en JavaScript da
`0.30000000000000004`, y en un sistema de pagos eso es un descuadre. Todo se
almacena en centavos, como entero, y se formatea en la capa de presentación con
`Intl.NumberFormat('es-AR')`.

---

## Realismo argentino

El desglose de un cobro de $5.000 en 3 cuotas:

| Concepto | Monto |
|---|---|
| Monto del cobro | $5.000,00 |
| Paga el cliente (3× $1.876,00) | $5.628,00 |
| Arancel (1,79 %) | −$89,50 |
| IVA sobre arancel (21 %) | −$18,80 |
| **Neto a acreditar (T+10)** | **$4.891,70** |

Los coeficientes de cuotas, la tasa de arancel y el plazo de acreditación están
centralizados en `src/payments/domain/pricing.ts` y documentados como supuestos.
Son valores plausibles de mercado, no datos de un procesador real.

---

## Arquitectura

```
Comercio ──POST /v1/payments──▶ API NestJS ──▶ DynamoDB
                                    │            (pago + clave + outbox
                                    │             en una transacción)
Procesador ──webhook firmado──▶ API │
                                    ▼
                          Outbox worker (cada 3 s)
                                    │
                   reintentos + circuit breaker
                                    ▼
                         Webhook al comercio
```

## Stack

| Capa | Herramienta | Por qué |
|---|---|---|
| API | NestJS + TypeScript | Inyección de dependencias, validación declarativa, versionado nativo |
| Datos | DynamoDB | Transacciones, escrituras condicionales, TTL, índices dispersos |
| Panel | React + Vite | Build rápido, sin framework de servidor porque no hace falta |
| Logs | pino | JSON estructurado con trace ID por petición |
| Deploy API | Fly.io | Docker nativo y máquina siempre viva para el worker |
| Deploy panel | Vercel | Deploy automático en cada push |

---

## Correr en local

```bash
git clone https://github.com/Victor-Zapata/navelite
cd navelite

# infraestructura local (DynamoDB + LocalStack)
docker compose up -d

# backend
cd api
cp .env.example .env     # completar los valores
npm install
npx tsx scripts/create-table.ts
npm run start:dev

# panel, en otra terminal
cd ../web
cp .env.example .env.local   # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

`scripts/doctor.ts` verifica la conexión a DynamoDB y el estado de la tabla.

Los secretos nunca están en el repositorio: en local van en `.env` (ignorado por
git, con `.env.example` como plantilla) y en producción en el gestor de secretos
de cada plataforma.

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Estado del servicio, sin versionar |
| `POST` | `/v1/payments` | Crea un cobro. Requiere `Idempotency-Key` |
| `GET` | `/v1/payments?merchantId=` | Lista los cobros de un comercio |
| `GET` | `/v1/payments/:id` | Detalle de un cobro |
| `GET` | `/v1/payments/:id/events` | Línea de tiempo de eventos |
| `POST` | `/v1/webhooks/processor` | Recibe webhooks firmados del procesador |
| `POST` | `/v1/webhooks/simulate/:id/:event` | Firma y dispara un webhook de prueba |

La versión va en la URI (`/v1/`) para poder romper el contrato sin romper a los
comercios que ya integraron.

---

## Límites conocidos

Un proyecto acotado a tres días. Lo que haría distinto con más tiempo:

- **El webhook responde en ~150 ms** porque la transacción de DynamoDB corre
  antes de contestar. En producción encolaría el webhook crudo y respondería en
  menos de 20 ms, procesándolo aparte.
- **El worker corre dentro del proceso de la API.** Debería ser un servicio
  aparte, escalable de forma independiente, consumiendo de SQS con visibility
  timeout en vez de un intervalo.
- **La política IAM es `AmazonDynamoDBFullAccess`.** Debería ser una política a
  medida sobre el ARN de la tabla, con las acciones mínimas.
- **Los logs no tienen rate limiting.** Con la base caída, el worker escribe un
  error cada 3 segundos indefinidamente. Correspondería registrar el primero,
  muestrear el resto y registrar la recuperación.
- **Sin rotación de secretos con ventana de solapamiento.** Hoy rotar un secreto
  de webhook requiere cambiarlo en los dos extremos a la vez. Lo correcto es
  aceptar el secreto anterior durante unos días.
- **Sin tests automatizados.** Las pruebas fueron manuales y están documentadas.
  Lo primero a cubrir sería el motor de firma y la máquina de estados.

---

Victor Zapata · Córdoba, Argentina