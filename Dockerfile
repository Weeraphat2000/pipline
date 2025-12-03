############################################
# BUILD STAGE
############################################
# ใช้ Node.js 22 บน Alpine (เบาและเร็ว) สำหรับ build
FROM node:22-alpine AS builder

# Install pnpm (v8 for lockfileVersion 6.0 compatibility)
# เปิดใช้ Corepack และติดตั้ง pnpm เวอร์ชัน 8
# (รองรับ lockfileVersion 6 ของ pnpm)
RUN corepack enable && corepack prepare pnpm@8 --activate

# ตั้งโฟลเดอร์ทำงานใน container
WORKDIR /app

# Copy package files
# คัดลอกไฟล์ที่เกี่ยวกับ dependencies ก่อน
# เพื่อช่วยให้ Docker cache ใช้ซ้ำได้
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# ติดตั้ง dependencies ทั้งหมด (รวม devDependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
# คัดลอก source code ทั้งหมดเข้า container
COPY . .

# Build the application
# สร้าง build ของแอพ (ไฟล์จะอยู่ใน /app/dist)
RUN pnpm build

############################################
# PRODUCTION STAGE
############################################
# ใช้ Node.js 22 บน Alpine สำหรับ runtime จริง
FROM node:22-alpine AS production

# Install pnpm (v8 for lockfileVersion 6.0 compatibility)
# ติดตั้ง pnpm เวอร์ชัน 8 สำหรับ production stage
RUN corepack enable && corepack prepare pnpm@8 --activate

# ตั้งโฟลเดอร์ทำงาน
WORKDIR /app

# Copy package files
# คัดลอก package.json และ lockfile สำหรับ install prod deps
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
# ติดตั้งเฉพาะ production dependencies เพื่อให้ image เบา
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
# คัดลอกผลลัพธ์การ build จาก stage builder
COPY --from=builder /app/dist ./dist

# Expose port
# เปิด Port 3000 เพื่อให้ container รับ traffic ได้
EXPOSE 3000

# Start the application
# คำสั่งเริ่มต้นเมื่อ container ถูกรัน
CMD ["node", "dist/main"]