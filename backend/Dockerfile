ARG NODE_VERSION=24.12.0

FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=yarn,target=/yarn/store yarn install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=yarn,target=/yarn/store yarn install --frozen-lockfile
RUN yarn run build

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
