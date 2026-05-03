FROM node:20

WORKDIR /app

ENV TZ=Europe/Warsaw

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]