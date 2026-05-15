FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
EXPOSE 20010 20011
CMD ["node", "server.js"]
