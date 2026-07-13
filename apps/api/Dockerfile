FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# --include=dev: el builder necesita devDependencies (nest CLI, tsc) aunque
# el entorno inyecte NODE_ENV=production en build time
RUN npm install --include=dev
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
RUN mkdir -p uploads

EXPOSE 3000
CMD ["node", "dist/main"]
