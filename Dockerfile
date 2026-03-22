# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build the application
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:22-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S sveltekit && \
    adduser -S sveltekit -u 1001

COPY --from=deps --chown=sveltekit:sveltekit /app/node_modules ./node_modules
COPY --from=build --chown=sveltekit:sveltekit /app/build ./build
COPY --from=build --chown=sveltekit:sveltekit /app/package.json ./

USER sveltekit

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "build"]
