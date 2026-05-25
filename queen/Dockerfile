FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY db.py attestation.py crypto.py queen.py .
CMD ["python", "queen.py"]
