FROM python:3.11.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates libgomp1 && rm -rf /var/lib/apt/lists/*

ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh

ENV PATH="/root/.local/bin/:$PATH"

COPY . .

RUN uv sync --locked

EXPOSE 8000

ENTRYPOINT ["bash", "-c", "uv run uvicorn main:app --host 0.0.0.0 --port 8000"]
