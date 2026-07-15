FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Tạm thời chạy chế độ dev hoặc giữ container sống khi chưa có source code Next.js thật
CMD ["npm", "run", "dev"]
