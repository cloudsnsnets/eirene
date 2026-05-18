# EIRENE — Proxy Service
# Builds from local source — not from registry image.
# aiohttp async proxy with JWT validation, PHI stripping, DoH DNS.
#
# Cloud SNS Pty Ltd

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py .
COPY phi_stripper_prod.py .

EXPOSE 8080
EXPOSE 8079
EXPOSE 1080

CMD ["python", "proxy.py"]
