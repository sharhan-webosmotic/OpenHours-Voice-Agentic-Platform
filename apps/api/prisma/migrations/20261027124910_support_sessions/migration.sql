-- CreateTable
CREATE TABLE "support_sessions" (
    "id" UUID NOT NULL,
    "organisation_id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_sessions_organisation_id_expires_at_idx" ON "support_sessions"("organisation_id", "expires_at");

-- CreateIndex
CREATE INDEX "support_sessions_platform_user_id_expires_at_idx" ON "support_sessions"("platform_user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
