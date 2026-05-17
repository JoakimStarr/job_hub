FROM node:20-alpine AS deps
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org

RUN echo "http://mirrors.aliyun.com/alpine/v3.23/main" > /etc/apk/repositories && \
    echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache libc6-compat python3 make g++ && \
    rm -rf /var/cache/apk/*

COPY package.json package-lock.json ./

RUN echo "registry=${NPM_REGISTRY}" > .npmrc && \
    npm ci && \
    npm cache clean --force && \
    rm -rf /root/.npm

FROM node:20-alpine AS builder
WORKDIR /app

RUN echo "http://mirrors.aliyun.com/alpine/v3.23/main" > /etc/apk/repositories && \
    echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache libc6-compat python3 make g++ && \
    rm -rf /var/cache/apk/*

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && \
    rm -rf /root/.npm && \
    rm -rf /tmp/*

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/data /app/log /app/output && \
    chown -R nextjs:nodejs /app/data /app/log /app/output

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
