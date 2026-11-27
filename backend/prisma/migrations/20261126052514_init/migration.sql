BEGIN;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('CONFIRMED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" INTEGER,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001),
    "user_id" UUID NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'CONFIRMED',
    "total" DECIMAL(12,2) NOT NULL,
    "discounted_total" DECIMAL(12,2) NOT NULL,
    "total_products" INTEGER NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "discounted_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" BIGINT GENERATED ALWAYS AS IDENTITY,
    "aggregate_type" VARCHAR(30) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- AddUniqueConstraint
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");

-- AddUniqueConstraint
ALTER TABLE "products" ADD CONSTRAINT "products_external_id_key" UNIQUE ("external_id");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category_id");

-- AddUniqueConstraint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");

-- CreateIndex
CREATE INDEX "orders_user_idx" ON "orders"("user_id", "created_at" DESC);

-- AddUniqueConstraint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_idempotency_key_key" UNIQUE ("user_id", "idempotency_key");

-- AddUniqueConstraint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_product_id_key" UNIQUE ("order_id", "product_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- PostgreSQL-specific checks and indexes
ALTER TABLE "products"
    ADD CONSTRAINT "products_price_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "products_discount_percentage_check" CHECK ("discount_percentage" BETWEEN 0 AND 100),
    ADD CONSTRAINT "products_stock_check" CHECK ("stock" >= 0),
    ADD CONSTRAINT "products_details_check" CHECK (jsonb_typeof("details") = 'object');

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_total_check" CHECK ("total" >= 0),
    ADD CONSTRAINT "orders_discounted_total_check" CHECK ("discounted_total" >= 0),
    ADD CONSTRAINT "orders_total_products_check" CHECK ("total_products" > 0),
    ADD CONSTRAINT "orders_total_quantity_check" CHECK ("total_quantity" > 0);

ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_price_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "outbox_events"
    ADD CONSTRAINT "outbox_events_aggregate_type_check" CHECK ("aggregate_type" IN ('PRODUCT', 'CATEGORY', 'ORDER'));

CREATE UNIQUE INDEX "users_email_uq" ON "users" (lower("email"));

CREATE INDEX "outbox_pending_idx" ON "outbox_events" ("id") WHERE "processed_at" IS NULL;

COMMIT;
