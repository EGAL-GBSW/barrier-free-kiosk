ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "OrderStatus" ADD VALUE 'PAID';

ALTER TABLE "Order" ADD COLUMN "paymentKey" TEXT, ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_paymentKey_key" ON "Order"("paymentKey");
