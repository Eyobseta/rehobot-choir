-- CreateTable
CREATE TABLE "birthday_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "birthdayDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birthday_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "birthday_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birthday_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birthday_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birthday_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "birthday_posts_year_idx" ON "birthday_posts"("year");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_posts_userId_year_key" ON "birthday_posts"("userId", "year");

-- CreateIndex
CREATE INDEX "birthday_comments_postId_idx" ON "birthday_comments"("postId");

-- CreateIndex
CREATE INDEX "birthday_comments_parentCommentId_idx" ON "birthday_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "birthday_comment_likes_commentId_idx" ON "birthday_comment_likes"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_comment_likes_commentId_userId_key" ON "birthday_comment_likes"("commentId", "userId");

-- CreateIndex
CREATE INDEX "birthday_reactions_postId_idx" ON "birthday_reactions"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "birthday_reactions_postId_userId_key" ON "birthday_reactions"("postId", "userId");

-- AddForeignKey
ALTER TABLE "birthday_posts" ADD CONSTRAINT "birthday_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_comments" ADD CONSTRAINT "birthday_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "birthday_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_comments" ADD CONSTRAINT "birthday_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_comments" ADD CONSTRAINT "birthday_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "birthday_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_comment_likes" ADD CONSTRAINT "birthday_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "birthday_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_comment_likes" ADD CONSTRAINT "birthday_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_reactions" ADD CONSTRAINT "birthday_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "birthday_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "birthday_reactions" ADD CONSTRAINT "birthday_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
