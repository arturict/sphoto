FROM node:20-alpine

WORKDIR /app

# Install docker CLI for managing instances
RUN apk add --no-cache docker-cli docker-compose

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3500

CMD ["npm", "start"]
