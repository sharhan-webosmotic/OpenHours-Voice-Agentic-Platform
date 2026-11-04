# Deploying the API: runbook

The API runs on one Lightsail instance in ap-south-1 (D-020). This runbook is not complete yet.
For now it holds the rule that must be read before anyone changes what the instance exposes to
the network.

## Network exposure: read this before opening a port

**`TRUST_PROXY=1` is safe only while the API's port can be reached through the reverse proxy
and nothing else.**

With `TRUST_PROXY=1` the API believes the right-most `X-Forwarded-For` entry is the caller's
address. Behind the proxy that is true, because the proxy writes that entry itself. A client
that reaches the API's port directly writes the header itself, so it can claim any address.
Two controls rest on that address:

- the Sarvam webhook's source-address allow-list (D-006), which would let a forged webhook
  through from anywhere
- every rate limit keyed by address: sign-in, the webhook, and the voice tools' backstop, which
  would give an attacker a fresh allowance with every request

The API listens on **all interfaces** (`app.listen(config.PORT)` in `apps/api/src/server.ts`,
with no host). So the only thing keeping its port private is the instance's firewall.

Before changing the Lightsail firewall, or anything else in front of the instance:

1. Open to the internet only the proxy's ports (443, and 80 if it redirects to HTTPS). **Never
   open `PORT`**, the API's own port.
2. If the API's port must be reachable for a reason (debugging, a health check from outside),
   set `TRUST_PROXY=false` for as long as it is reachable, and accept that the webhook
   allow-list and the address-keyed limits see the proxy's address meanwhile. Do not leave the
   port open with `TRUST_PROXY=1`.
3. If a second proxy or a load balancer is added in front of the first, the hop count changes.
   `TRUST_PROXY` must equal the number of proxies a request passes through, never more, and
   never `true` (refused at startup).

After any change, check from a machine outside the instance that the API's port does not
answer, for example `curl --max-time 5 http://<instance public ip>:<PORT>/health`, which must
time out or be refused.

The same rule applies to a local run behind a tunnel: see
`docs/operations/sarvam-configuration.md`, section 4.
