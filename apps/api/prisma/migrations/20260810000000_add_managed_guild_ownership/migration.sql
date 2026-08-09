CREATE TABLE `ManagedGuild` (
    `id` VARCHAR(191) NOT NULL,
    `botInstalled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Channel` ADD COLUMN `guildId` VARCHAR(191) NULL;

CREATE INDEX `Channel_guildId_idx` ON `Channel`(`guildId`);

ALTER TABLE `Channel` ADD CONSTRAINT `Channel_guildId_fkey`
    FOREIGN KEY (`guildId`) REFERENCES `ManagedGuild`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
