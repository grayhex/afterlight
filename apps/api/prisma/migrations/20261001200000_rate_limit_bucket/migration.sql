-- Счётчики ограничения частоты запросов (#179). Только добавление: предыдущая версия API таблицу не использует.
CREATE TABLE "rate_limit_bucket" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key","window_start")
);

CREATE INDEX "ix_rate_limit_window" ON "rate_limit_bucket"("window_start");
