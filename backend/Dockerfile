FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npm run prisma:generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000
CMD ["npm", "run", "dev"]
