-- CreateTable
CREATE TABLE `tenants` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `logo` VARCHAR(255) NULL,
    `contact` VARCHAR(64) NULL,
    `expire_at` DATETIME(3) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `openid` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `nickname` VARCHAR(64) NULL,
    `avatar` VARCHAR(255) NULL,
    `password` VARCHAR(128) NULL,
    `role` ENUM('admin', 'teacher', 'parent') NOT NULL DEFAULT 'parent',
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_tenant_role`(`tenant_id`, `role`),
    UNIQUE INDEX `uk_tenant_openid`(`tenant_id`, `openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `teacher_id` BIGINT NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_tenant`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `parent_user_id` BIGINT NULL,
    `class_id` BIGINT NULL,
    `level` VARCHAR(32) NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_tenant_class`(`tenant_id`, `class_id`),
    INDEX `idx_parent`(`parent_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_accounts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `balance` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_tenant_user`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_ledger` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `change_type` ENUM('recharge', 'consume', 'rollback') NOT NULL,
    `change_amount` INTEGER NOT NULL,
    `balance_after` INTEGER NOT NULL,
    `biz_id` VARCHAR(64) NOT NULL,
    `biz_type` VARCHAR(32) NULL,
    `remark` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tenant_user_time`(`tenant_id`, `user_id`, `created_at`),
    UNIQUE INDEX `uk_biz`(`tenant_id`, `biz_id`, `change_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_prices` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agent_type` VARCHAR(32) NOT NULL,
    `price` INTEGER NOT NULL,
    `tenant_id` BIGINT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_agent_tenant`(`agent_type`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_configs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `agent_type` VARCHAR(32) NOT NULL,
    `provider` ENUM('coze', 'dify', 'openai') NOT NULL DEFAULT 'coze',
    `bot_id` VARCHAR(128) NULL,
    `model` VARCHAR(64) NULL,
    `prompt_template` VARCHAR(191) NULL,
    `tenant_id` BIGINT NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_agent_tenant`(`agent_type`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `user_id` BIGINT NULL,
    `agent_type` VARCHAR(32) NULL,
    `prompt` VARCHAR(191) NULL,
    `response` VARCHAR(191) NULL,
    `tokens_input` INTEGER NULL,
    `tokens_output` INTEGER NULL,
    `cost_points` INTEGER NULL,
    `duration_ms` INTEGER NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tenant_time`(`tenant_id`, `created_at`),
    INDEX `idx_tenant_agent_time`(`tenant_id`, `agent_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_docs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `name` VARCHAR(128) NULL,
    `file_url` VARCHAR(255) NULL,
    `file_type` VARCHAR(16) NULL,
    `document_id` VARCHAR(128) NULL,
    `status` TINYINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tenant`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_reports` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tenant_id` BIGINT NOT NULL,
    `student_id` BIGINT NOT NULL,
    `teacher_id` BIGINT NULL,
    `class_id` BIGINT NULL,
    `content` VARCHAR(191) NULL,
    `report_type` ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'daily',
    `cost_points` INTEGER NOT NULL DEFAULT 0,
    `status` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_tenant_student`(`tenant_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
