FROM node:22-slim

WORKDIR /app

COPY packages/design-system/package*.json ./packages/design-system/

WORKDIR /app/packages/design-system

RUN npm install

COPY packages/design-system/ .

EXPOSE 6006

CMD ["npm", "run", "storybook", "--", "--host", "0.0.0.0", "--no-open"]
