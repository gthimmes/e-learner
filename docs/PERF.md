# Performance baseline

Measured 2026-09-02 with `npm run loadtest` (dependency-free, `scripts/loadtest.mjs`) against a
production build (`next start`, one Node process) on a Windows 11 dev laptop, seeded demo data,
50 concurrent connections for 15 s per run. The tool and the server shared the machine, so treat
these as a **floor**, not a ceiling.

## SQLite (dev default)

| Mix | req/s | p50 | p95 | p99 | errors |
| --- | --- | --- | --- | --- | --- |
| Anonymous (catalog, search, landing, paths, health) | **184** | 269 ms | 363 ms | 716 ms | 0 |
| Signed-in (adds lesson player, My Learning) | **153** | 335 ms | 420 ms | 508 ms | 0 |

## PostgreSQL 16 (Docker, same machine)

| Mix | req/s | p50 | p95 | p99 | errors |
| --- | --- | --- | --- | --- | --- |
| Anonymous | **142** | 358 ms | 497 ms | 568 ms | 0 |
| Signed-in | **105** | 500 ms | 619 ms | 672 ms | 0 |

## Reading the numbers

- Zero errors at 50 concurrent connections in every run; latency is flat across the window (no
  degradation over time), so the bottleneck is CPU on the shared machine, not leaks or lock-ups.
- Postgres is ~25–30 % slower here because it runs in a container on the same laptop and every
  page does several round-trips; with a real DB host and connection pooling the gap narrows.
- **Against goal G4 ("10 k concurrent learners")**: 10 k *concurrent connections* on one process is
  not what these numbers show. What they support: at ~150 req/s and a realistic pacing of one
  request per learner per 30–60 s, one process on a laptop sustains roughly **4 500–9 000 active
  learners**. The app is stateless (sessions in cookies, uploads in S3, rate limits in Redis), so
  horizontal scaling is a load-balancer away — but a multi-instance load test on server hardware
  is still an open item before claiming G4 outright.

## Reproduce

```bash
npm run build && SESSION_SECRET=any-non-dev-secret npm start -- --port 3100
node scripts/loadtest.mjs --conc 50 --seconds 15 [--signed-in] [--base http://localhost:3100]
```

Obvious next optimisations if the read paths need to go faster: cache `getBrand`/`unreadCount`
per request (already request-cached) and per user with a short TTL; denormalise course stats
(`Enrollment.progressPct`); put the catalog behind `revalidate`-based ISR for anonymous traffic.
