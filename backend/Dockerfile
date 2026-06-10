# build stage — compile TypeScript
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# runtime stage — production deps only
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3001
# run pending migrations, then start the api
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/data-source.js migration:run && node dist/main"]
