FROM node:22-slim

WORKDIR /app

COPY frontend/package*.json ./frontend/
COPY packages/design-system ./packages/design-system

WORKDIR /app/frontend

RUN npm install

COPY frontend/ .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
