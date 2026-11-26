FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY public ./public
COPY src ./src
COPY seed ./seed

ENV PORT=8080
ENV DATA_DIR=/data
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "src/server.js"]
