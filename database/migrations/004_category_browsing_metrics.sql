-- =============================================================================
-- Dearr V1 — Migration 004: Category Browsing Metrics (Local Migration)
-- Database: Hostinger MySQL 8.x
-- Purpose:
--   Tracks customer browsing activity per category for genuine popularity rankings.
--   Includes session-based deduplication window to prevent inflation from repeated renders.
--
-- STATUS: LOCAL UNAPPLIED MIGRATION. DO NOT EXECUTE AGAINST HOSTINGER IN THIS TASK.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `category_views` (
  `id` VARCHAR(36) NOT NULL,
  `category_id` VARCHAR(36) NOT NULL,
  `viewed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `session_hash` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cat_views_category_time` (`category_id`, `viewed_at`),
  KEY `idx_cat_views_session_window` (`category_id`, `session_hash`, `viewed_at`),
  CONSTRAINT `fk_cat_views_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
