FROM node:24-alpine AS builder

# Ensure all packages in the base image are up-to-date, including security patches
RUN apk upgrade --no-cache

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
RUN corepack enable && corepack prepare pnpm@8.15.8 --activate
RUN pnpm install --frozen-lockfile
COPY . /app
RUN pnpm run build

FROM node:24-alpine

# Ensure all packages in the base image are up-to-date in the final stage as well
RUN apk upgrade --no-cache

WORKDIR /app
COPY --from=builder /app/.output /app
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT [ "node", "./server/index.mjs" ]