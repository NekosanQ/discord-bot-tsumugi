ALTER TABLE `Channel`
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('TEXT', 'ANNOUNCEMENT') NULL,
    ADD COLUMN `available` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `syncedAt` DATETIME(3) NULL;

CREATE TABLE `DashboardUser` (
    `id` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `avatarHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DashboardSession` (
    `idHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accessTokenCiphertext` TEXT NOT NULL,
    `refreshTokenCiphertext` TEXT NOT NULL,
    `tokenExpiresAt` DATETIME(3) NOT NULL,
    `idleExpiresAt` DATETIME(3) NOT NULL,
    `absoluteExpiresAt` DATETIME(3) NOT NULL,
    `csrfHash` CHAR(64) NOT NULL,
    `keyVersion` INTEGER NOT NULL DEFAULT 1,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DashboardSession_userId_idx` (`userId`),
    INDEX `DashboardSession_idleExpiresAt_idx` (`idleExpiresAt`),
    INDEX `DashboardSession_absoluteExpiresAt_idx` (`absoluteExpiresAt`),
    PRIMARY KEY (`idHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OAuthAttempt` (
    `stateHash` CHAR(64) NOT NULL,
    `returnTo` VARCHAR(512) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OAuthAttempt_expiresAt_idx` (`expiresAt`),
    PRIMARY KEY (`stateHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorType` ENUM('USER', 'SERVICE') NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `outcome` ENUM('SUCCEEDED', 'DENIED', 'FAILED') NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `correlationId` CHAR(36) NOT NULL,

    INDEX `AuditLog_occurredAt_idx` (`occurredAt`),
    INDEX `AuditLog_guildId_occurredAt_idx` (`guildId`, `occurredAt`),
    INDEX `AuditLog_actorId_occurredAt_idx` (`actorId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DashboardSession` ADD CONSTRAINT `DashboardSession_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `DashboardUser`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
