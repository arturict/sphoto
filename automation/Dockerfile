FROM oven/bun:1-debian
RUN apt-get update && apt-get install -y --no-install-recommends zip curl ca-certificates \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.4.1.tgz | tar xz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker \
    && curl -fsSL https://github.com/docker/compose/releases/download/v2.32.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose \
    && chmod +x /usr/local/bin/docker-compose /usr/local/bin/docker \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
