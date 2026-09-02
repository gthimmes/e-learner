-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'LEARNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    "orgAdmin" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sequential" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "tags" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'ALL',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "instructorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT,
    "mediaCaption" TEXT NOT NULL DEFAULT '',
    "durationMin" INTEGER NOT NULL DEFAULT 5,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 0,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "showAnswers" BOOLEAN NOT NULL DEFAULT true,
    "timeLimitMin" INTEGER NOT NULL DEFAULT 0,
    "drawCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastLessonId" TEXT,
    "cohortId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE',
    "prompt" TEXT NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "answerText" TEXT NOT NULL DEFAULT '',
    "rubric" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Choice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Choice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GRADED',
    "deadline" TIMESTAMP(3),
    "questionIds" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER,
    "feedback" TEXT NOT NULL DEFAULT '',
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAuthor" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CourseAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseVersion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'DELIVERED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "nextAttemptAt" TIMESTAMP(3),
    "payload" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "couponCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL,
    "courseId" TEXT,
    "createdById" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPathItem" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LearningPathItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathEnrollment" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PathEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "lessons" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "courseId" TEXT NOT NULL DEFAULT '',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cohortId" TEXT,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "joinUrl" TEXT NOT NULL DEFAULT '',
    "recordingUrl" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRsvp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeHourSlot" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "bookedById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeHourSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_organizationId_idx" ON "Course"("organizationId");

-- CreateIndex
CREATE INDEX "Course_instructorId_idx" ON "Course"("instructorId");

-- CreateIndex
CREATE INDEX "Module_courseId_position_idx" ON "Module"("courseId", "position");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_enrollmentId_lessonId_key" ON "LessonProgress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "Question_lessonId_position_idx" ON "Question"("lessonId", "position");

-- CreateIndex
CREATE INDEX "Choice_questionId_position_idx" ON "Choice"("questionId", "position");

-- CreateIndex
CREATE INDEX "QuizAttempt_enrollmentId_lessonId_idx" ON "QuizAttempt"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "Cohort_courseId_idx" ON "Cohort"("courseId");

-- CreateIndex
CREATE INDEX "Comment_lessonId_createdAt_idx" ON "Comment"("lessonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAuthor_courseId_userId_key" ON "CourseAuthor"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseVersion_courseId_number_key" ON "CourseVersion"("courseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_state_nextAttemptAt_idx" ON "WebhookDelivery"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_providerSessionId_key" ON "Purchase"("providerSessionId");

-- CreateIndex
CREATE INDEX "Purchase_userId_courseId_idx" ON "Purchase"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Purchase_courseId_status_idx" ON "Purchase"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_courseId_idx" ON "Coupon"("courseId");

-- CreateIndex
CREATE INDEX "Review_courseId_createdAt_idx" ON "Review"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_courseId_key" ON "Review"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");

-- CreateIndex
CREATE INDEX "LearningPath_status_idx" ON "LearningPath"("status");

-- CreateIndex
CREATE INDEX "LearningPath_organizationId_idx" ON "LearningPath"("organizationId");

-- CreateIndex
CREATE INDEX "LearningPathItem_pathId_position_idx" ON "LearningPathItem"("pathId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathItem_pathId_courseId_key" ON "LearningPathItem"("pathId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PathEnrollment_pathId_userId_key" ON "PathEnrollment"("pathId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityDay_userId_day_key" ON "ActivityDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_userId_key_courseId_key" ON "Badge"("userId", "key", "courseId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_courseId_createdAt_idx" ON "Announcement"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveSession_courseId_startsAt_idx" ON "LiveSession"("courseId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRsvp_sessionId_userId_key" ON "SessionRsvp"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "OfficeHourSlot_courseId_startsAt_idx" ON "OfficeHourSlot"("courseId", "startsAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAuthor" ADD CONSTRAINT "CourseAuthor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAuthor" ADD CONSTRAINT "CourseAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseVersion" ADD CONSTRAINT "CourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathItem" ADD CONSTRAINT "LearningPathItem_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathItem" ADD CONSTRAINT "LearningPathItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathEnrollment" ADD CONSTRAINT "PathEnrollment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathEnrollment" ADD CONSTRAINT "PathEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityDay" ADD CONSTRAINT "ActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRsvp" ADD CONSTRAINT "SessionRsvp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRsvp" ADD CONSTRAINT "SessionRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHourSlot" ADD CONSTRAINT "OfficeHourSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

