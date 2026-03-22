-- CreateTable
CREATE TABLE "domains" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "domain_id" INTEGER NOT NULL,
    "exposure_rate" DOUBLE PRECISION NOT NULL,
    "total_prompts" INTEGER NOT NULL,
    "brand_mentioned_count" INTEGER NOT NULL,
    "brand_not_mentioned_count" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_responses" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "completion" TEXT NOT NULL,
    "brand_mentioned" BOOLEAN NOT NULL,
    "citations" TEXT[],
    "mention_context" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_responses" ADD CONSTRAINT "prompt_responses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
