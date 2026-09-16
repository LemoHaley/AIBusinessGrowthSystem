-- AlterTable
ALTER TABLE `agent_configs` MODIFY `prompt_template` TEXT NULL;

-- AlterTable
ALTER TABLE `ai_logs` MODIFY `prompt` TEXT NULL,
    MODIFY `response` TEXT NULL;

-- AlterTable
ALTER TABLE `ai_reports` MODIFY `content` TEXT NULL;
