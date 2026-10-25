ALTER TABLE "dish_cards" ADD COLUMN "photo_object_key" TEXT;
CREATE UNIQUE INDEX "dish_cards_photo_object_key_key" ON "dish_cards"("photo_object_key");

CREATE TABLE "dish_photo_uploads" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "dish_id" UUID NOT NULL,
  "created_by_user_id" UUID,
  "object_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dish_photo_uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dish_photo_uploads_object_key_key" ON "dish_photo_uploads"("object_key");
CREATE INDEX "dish_photo_uploads_dish_id_created_at_idx" ON "dish_photo_uploads"("dish_id", "created_at");
CREATE INDEX "dish_photo_uploads_created_by_user_id_idx" ON "dish_photo_uploads"("created_by_user_id");
CREATE INDEX "dish_photo_uploads_expires_at_idx" ON "dish_photo_uploads"("expires_at");

ALTER TABLE "dish_photo_uploads" ADD CONSTRAINT "dish_photo_uploads_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dish_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_photo_uploads" ADD CONSTRAINT "dish_photo_uploads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
