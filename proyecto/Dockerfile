FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=compilacion /app/node_modules ./node_modules
COPY --from=compilacion /app/dist ./dist
COPY package*.json ./
COPY scripts ./scripts
USER node
EXPOSE 8080
CMD ["sh", "-c", "npm run migration:run:prod && npm start"]
