FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

CMD ["node", "src/consumer.js"]
