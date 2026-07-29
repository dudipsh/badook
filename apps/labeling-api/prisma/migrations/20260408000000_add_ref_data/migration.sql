-- CreateTable
CREATE TABLE "ref_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ref_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "common_vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ref_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ref_cities" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "english_name" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "council" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ref_cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ref_suppliers_name_key" ON "ref_suppliers"("name");

-- CreateIndex
CREATE INDEX "ref_suppliers_name_idx" ON "ref_suppliers"("name");

-- CreateIndex
CREATE INDEX "ref_products_category_idx" ON "ref_products"("category");

-- CreateIndex
CREATE INDEX "ref_products_name_idx" ON "ref_products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ref_products_name_category_key" ON "ref_products"("name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ref_cities_code_key" ON "ref_cities"("code");

-- CreateIndex
CREATE INDEX "ref_cities_name_idx" ON "ref_cities"("name");

-- CreateIndex
CREATE INDEX "ref_cities_district_idx" ON "ref_cities"("district");
