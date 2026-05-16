-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "salt" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rawText" TEXT,
    "graphData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "data" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_permissions" (
    "id" SERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL DEFAULT 'member',
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_cache" (
    "id" SERIAL NOT NULL,
    "courseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'deepseek',
    "deepseekApiKey" TEXT,
    "deepseekModel" TEXT,
    "zhipuApiKey" TEXT,
    "zhipuModel" TEXT,
    "ollamaBaseUrl" TEXT,
    "ollamaModel" TEXT,
    "qwenApiKey" TEXT,
    "qwenModel" TEXT,
    "geminiApiKey" TEXT,
    "geminiModel" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "courses_authorId_idx" ON "courses"("authorId");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "courses_createdAt_idx" ON "courses"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "progress_userId_idx" ON "progress"("userId");

-- CreateIndex
CREATE INDEX "progress_courseId_idx" ON "progress"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "progress_userId_courseId_key" ON "progress"("userId", "courseId");

-- CreateIndex
CREATE INDEX "course_permissions_courseId_idx" ON "course_permissions"("courseId");

-- CreateIndex
CREATE INDEX "course_permissions_userId_idx" ON "course_permissions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "course_permissions_courseId_userId_key" ON "course_permissions"("courseId", "userId");

-- CreateIndex
CREATE INDEX "content_cache_courseId_nodeId_type_idx" ON "content_cache"("courseId", "nodeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "content_cache_courseId_nodeId_type_key" ON "content_cache"("courseId", "nodeId", "type");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_permissions" ADD CONSTRAINT "course_permissions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_permissions" ADD CONSTRAINT "course_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_cache" ADD CONSTRAINT "content_cache_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
