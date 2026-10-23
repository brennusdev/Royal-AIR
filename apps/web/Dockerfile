FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @platform/shared

ENV NODE_ENV=development
EXPOSE 5173

CMD ["npm", "run", "dev:web"]
