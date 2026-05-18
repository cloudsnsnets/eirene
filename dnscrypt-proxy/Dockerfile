# EIRENE — dnscrypt-proxy
# Cloudflare DoH resolver for the Eirene proxy.
# Tiny Alpine image. No bloat.
#
# Cloud SNS Pty Ltd

FROM alpine:3.19

RUN apk add --no-cache dnscrypt-proxy bind-tools \
    && mkdir -p /var/cache/dnscrypt-proxy \
    && chown nobody:nobody /var/cache/dnscrypt-proxy

COPY dnscrypt-proxy.toml /etc/dnscrypt-proxy/dnscrypt-proxy.toml

EXPOSE 5300/udp
EXPOSE 5300/tcp

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD dig @127.0.0.1 -p 5300 cloudflare.com +short +time=3 | grep -q '.' || exit 1

USER nobody

CMD ["dnscrypt-proxy", "-config", "/etc/dnscrypt-proxy/dnscrypt-proxy.toml"]
