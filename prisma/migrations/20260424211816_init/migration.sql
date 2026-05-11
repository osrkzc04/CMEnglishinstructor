-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DIRECTOR', 'COORDINATOR', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProgramStructure" AS ENUM ('SEQUENTIAL', 'MODULAR', 'SINGLE');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('VIRTUAL', 'PRESENCIAL', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FILL_IN');

-- CreateEnum
CREATE TYPE "TestPurpose" AS ENUM ('PLACEMENT', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "TestSessionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT', 'REVIEWED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TestEventType" AS ENUM ('FOCUS_LOST', 'FOCUS_REGAINED', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'SESSION_RESUMED', 'QUESTION_VIEWED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CLOSED', 'PAID');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('WEEKLY_SCHEDULE_TEACHER', 'WEEKLY_SCHEDULE_STUDENT', 'MONTHLY_SCHEDULE_TEACHER', 'MONTHLY_SCHEDULE_STUDENT', 'CLASS_REMINDER', 'CLASS_CANCELLED', 'CLASS_RESCHEDULED', 'ENROLLMENT_CONFIRMATION', 'TEST_INVITATION', 'TEST_RESULT_READY', 'TEST_RESULT_STUDENT', 'TEACHER_APPLICATION_RECEIVED', 'TEACHER_APPLICATION_APPROVED', 'TEACHER_APPLICATION_REJECTED', 'PAYROLL_CLOSED', 'PASSWORD_RESET', 'GENERIC');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "bio" TEXT,
    "cvStorageKey" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherApplicationLevel" (
    "applicationId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "TeacherApplicationLevel_pkey" PRIMARY KEY ("applicationId","levelId")
);

-- CreateTable
CREATE TABLE "ApplicationAvailability" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ApplicationAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "userId" TEXT NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TeacherLevel" (
    "teacherId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,

    CONSTRAINT "TeacherLevel_pkey" PRIMARY KEY ("teacherId","levelId")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherUnavailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "TeacherUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudentPreferredSchedule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "StudentPreferredSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CefrLevel" (
    "id" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CefrLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseHours" INTEGER NOT NULL,
    "classDuration" INTEGER NOT NULL DEFAULT 45,
    "pricePerHour" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "platformName" TEXT,
    "platformUrl" TEXT,
    "description" TEXT,
    "structureType" "ProgramStructure" NOT NULL DEFAULT 'SEQUENTIAL',
    "baseHoursOverride" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramLevel" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "cefrLevelCode" TEXT,
    "hasPlatformAccess" BOOLEAN NOT NULL DEFAULT true,
    "hasPdfMaterial" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgramLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBundle" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceOverride" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgramBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBundleLevel" (
    "bundleId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgramBundleLevel_pkey" PRIMARY KEY ("bundleId","levelId")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programLevelId" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "contractedHours" INTEGER NOT NULL,
    "consumedHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "placementTestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraHours" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "reason" TEXT,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "modality" "Modality" NOT NULL,
    "meetingUrl" TEXT,
    "location" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "hoursCounted" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "rateSnapshot" DECIMAL(10,2),
    "notes" TEXT,

    CONSTRAINT "ClassParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "activities" TEXT NOT NULL,
    "homework" TEXT,
    "materialsUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "programLevelId" TEXT,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "points" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFillAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "acceptedAnswer" TEXT NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionFillAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "TestPurpose" NOT NULL,
    "levelId" TEXT,
    "languageId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL,
    "passingScore" INTEGER,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestTemplateTopic" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "TestTemplateTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "candidateDocument" TEXT,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSession" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "status" "TestSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "autoScore" INTEGER,
    "maxAutoScore" INTEGER,
    "manualScore" INTEGER,
    "finalScore" INTEGER,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,

    CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionId" TEXT,
    "promptSnapshot" TEXT NOT NULL,
    "typeSnapshot" "QuestionType" NOT NULL,
    "pointsSnapshot" INTEGER NOT NULL,
    "optionsSnapshot" JSONB,
    "acceptedAnswersSnapshot" JSONB,
    "selectedOptionId" TEXT,
    "textAnswer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "isCorrect" BOOLEAN,
    "pointsAwarded" INTEGER,
    "reviewerComment" TEXT,

    CONSTRAINT "TestSessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "TestEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalHours" DECIMAL(8,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SettingType" NOT NULL DEFAULT 'STRING',
    "category" TEXT,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "templateData" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "sessionId" TEXT,
    "inviteId" TEXT,
    "payrollId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_document_key" ON "User"("document");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherApplication_userId_key" ON "TeacherApplication"("userId");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_idx" ON "TeacherApplication"("status");

-- CreateIndex
CREATE INDEX "TeacherApplication_email_idx" ON "TeacherApplication"("email");

-- CreateIndex
CREATE INDEX "TeacherProfile_isActive_idx" ON "TeacherProfile"("isActive");

-- CreateIndex
CREATE INDEX "TeacherAvailability_teacherId_dayOfWeek_idx" ON "TeacherAvailability"("teacherId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TeacherUnavailability_teacherId_startDate_idx" ON "TeacherUnavailability"("teacherId", "startDate");

-- CreateIndex
CREATE INDEX "StudentPreferredSchedule_studentId_dayOfWeek_idx" ON "StudentPreferredSchedule"("studentId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "CefrLevel_languageId_order_idx" ON "CefrLevel"("languageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CefrLevel_languageId_code_key" ON "CefrLevel"("languageId", "code");

-- CreateIndex
CREATE INDEX "Course_languageId_isActive_idx" ON "Course"("languageId", "isActive");

-- CreateIndex
CREATE INDEX "Program_courseId_isActive_idx" ON "Program"("courseId", "isActive");

-- CreateIndex
CREATE INDEX "ProgramLevel_programId_order_idx" ON "ProgramLevel"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramLevel_programId_code_key" ON "ProgramLevel"("programId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_placementTestId_key" ON "Enrollment"("placementTestId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_status_idx" ON "Enrollment"("studentId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_programLevelId_idx" ON "Enrollment"("programLevelId");

-- CreateIndex
CREATE INDEX "ExtraHours_enrollmentId_idx" ON "ExtraHours"("enrollmentId");

-- CreateIndex
CREATE INDEX "ClassSession_teacherId_scheduledStart_idx" ON "ClassSession"("teacherId", "scheduledStart");

-- CreateIndex
CREATE INDEX "ClassSession_scheduledStart_idx" ON "ClassSession"("scheduledStart");

-- CreateIndex
CREATE INDEX "ClassSession_status_idx" ON "ClassSession"("status");

-- CreateIndex
CREATE INDEX "ClassParticipant_enrollmentId_idx" ON "ClassParticipant"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassParticipant_sessionId_enrollmentId_key" ON "ClassParticipant"("sessionId", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassLog_sessionId_key" ON "ClassLog"("sessionId");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_name_key" ON "Holiday"("date", "name");

-- CreateIndex
CREATE INDEX "Material_programLevelId_idx" ON "Material"("programLevelId");

-- CreateIndex
CREATE INDEX "Material_courseId_idx" ON "Material"("courseId");

-- CreateIndex
CREATE INDEX "Question_levelId_isActive_idx" ON "Question"("levelId", "isActive");

-- CreateIndex
CREATE INDEX "Question_topic_idx" ON "Question"("topic");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "TestTemplate_purpose_isActive_idx" ON "TestTemplate"("purpose", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TestTemplateTopic_templateId_topic_key" ON "TestTemplateTopic"("templateId", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_token_idx" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_expiresAt_idx" ON "InviteToken"("expiresAt");

-- CreateIndex
CREATE INDEX "InviteToken_candidateEmail_idx" ON "InviteToken"("candidateEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TestSession_inviteId_key" ON "TestSession"("inviteId");

-- CreateIndex
CREATE INDEX "TestSession_status_idx" ON "TestSession"("status");

-- CreateIndex
CREATE INDEX "TestSession_candidateEmail_idx" ON "TestSession"("candidateEmail");

-- CreateIndex
CREATE INDEX "TestSessionQuestion_sessionId_idx" ON "TestSessionQuestion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSessionQuestion_sessionId_order_key" ON "TestSessionQuestion"("sessionId", "order");

-- CreateIndex
CREATE INDEX "TestSessionEvent_sessionId_occurredAt_idx" ON "TestSessionEvent"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "PayrollPeriod_teacherId_status_idx" ON "PayrollPeriod"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_teacherId_startDate_endDate_key" ON "PayrollPeriod"("teacherId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmailNotification_status_scheduledFor_idx" ON "EmailNotification"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "EmailNotification_userId_idx" ON "EmailNotification"("userId");

-- CreateIndex
CREATE INDEX "EmailNotification_type_idx" ON "EmailNotification"("type");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplication" ADD CONSTRAINT "TeacherApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplicationLevel" ADD CONSTRAINT "TeacherApplicationLevel_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherApplicationLevel" ADD CONSTRAINT "TeacherApplicationLevel_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CefrLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAvailability" ADD CONSTRAINT "ApplicationAvailability_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLevel" ADD CONSTRAINT "TeacherLevel_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLevel" ADD CONSTRAINT "TeacherLevel_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CefrLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherUnavailability" ADD CONSTRAINT "TeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreferredSchedule" ADD CONSTRAINT "StudentPreferredSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CefrLevel" ADD CONSTRAINT "CefrLevel_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLevel" ADD CONSTRAINT "ProgramLevel_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBundle" ADD CONSTRAINT "ProgramBundle_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBundleLevel" ADD CONSTRAINT "ProgramBundleLevel_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProgramBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBundleLevel" ADD CONSTRAINT "ProgramBundleLevel_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "ProgramLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_programLevelId_fkey" FOREIGN KEY ("programLevelId") REFERENCES "ProgramLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_placementTestId_fkey" FOREIGN KEY ("placementTestId") REFERENCES "TestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraHours" ADD CONSTRAINT "ExtraHours_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassParticipant" ADD CONSTRAINT "ClassParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassParticipant" ADD CONSTRAINT "ClassParticipant_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassLog" ADD CONSTRAINT "ClassLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_programLevelId_fkey" FOREIGN KEY ("programLevelId") REFERENCES "ProgramLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CefrLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFillAnswer" ADD CONSTRAINT "QuestionFillAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTemplate" ADD CONSTRAINT "TestTemplate_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CefrLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTemplateTopic" ADD CONSTRAINT "TestTemplateTopic_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "InviteToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSessionQuestion" ADD CONSTRAINT "TestSessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSessionEvent" ADD CONSTRAINT "TestSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
