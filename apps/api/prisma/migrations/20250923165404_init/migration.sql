/*
  Warnings:

  - You are about to drop the column `guildId` on the `Keyword` table. All the data in the column will be lost.
  - You are about to drop the `Guild` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[channelId,trigger]` on the table `Keyword` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `channelId` to the `Keyword` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Keyword` DROP FOREIGN KEY `Keyword_guildId_fkey`;

-- DropIndex
DROP INDEX `Keyword_guildId_trigger_key` ON `Keyword`;

-- AlterTable
ALTER TABLE `Keyword` DROP COLUMN `guildId`,
    ADD COLUMN `channelId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Guild`;

-- CreateTable
CREATE TABLE `Channel` (
    `id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Keyword_channelId_trigger_key` ON `Keyword`(`channelId`, `trigger`);

-- AddForeignKey
ALTER TABLE `Keyword` ADD CONSTRAINT `Keyword_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `Channel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
