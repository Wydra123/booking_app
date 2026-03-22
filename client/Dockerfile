FROM node:20

WORKDIR /app

ENV TZ=Europe/Warsaw

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]