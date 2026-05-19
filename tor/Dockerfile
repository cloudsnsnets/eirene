# EIRENE — Tor service
# Client only. SOCKS5 on :9050. Internal to eirene-net.
# No relay. No exit. No dark web.
#
# Cloud SNS Pty Ltd

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends tor && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY torrc /etc/tor/torrc

RUN mkdir -p /var/lib/tor && \
    chown -R debian-tor:debian-tor /var/lib/tor

EXPOSE 9050

USER debian-tor

CMD ["tor", "-f", "/etc/tor/torrc"]
