-- Create GitHub connections table
CREATE TABLE "github_connections" (
  "id" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "github_user_id" TEXT NOT NULL,
  "github_username" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "user_data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- Create index for user_id
CREATE INDEX "github_connections_user_id_idx" ON "github_connections"("user_id");

-- Create index for github_username
CREATE INDEX "github_connections_github_username_idx" ON "github_connections"("github_username");

-- Create unique constraint for user_id (one connection per user)
CREATE UNIQUE INDEX "github_connections_user_id_key" ON "github_connections"("user_id");

-- Add foreign key constraint to users table
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create GitHub indexed repositories table
CREATE TABLE "github_indexed_repositories" (
  "id" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "github_repo_id" INTEGER NOT NULL,
  "owner" TEXT NOT NULL,
  "repo" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "default_branch" TEXT NOT NULL,
  "private" BOOLEAN NOT NULL DEFAULT false,
  "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "indexing_status" TEXT NOT NULL DEFAULT 'pending',
  "indexing_metadata" JSONB,
  "file_count" INTEGER NOT NULL DEFAULT 0,
  "total_size" INTEGER NOT NULL DEFAULT 0,
  "languages" TEXT[],

  CONSTRAINT "github_indexed_repositories_pkey" PRIMARY KEY ("id")
);

-- Create indexes for GitHub indexed repositories
CREATE INDEX "github_indexed_repositories_user_id_idx" ON "github_indexed_repositories"("user_id");
CREATE INDEX "github_indexed_repositories_owner_repo_idx" ON "github_indexed_repositories"("owner", "repo");
CREATE INDEX "github_indexed_repositories_full_name_idx" ON "github_indexed_repositories"("full_name");
CREATE INDEX "github_indexed_repositories_github_repo_id_idx" ON "github_indexed_repositories"("github_repo_id");

-- Add foreign key constraint to users table
ALTER TABLE "github_indexed_repositories" ADD CONSTRAINT "github_indexed_repositories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create GitHub file cache table for optimization
CREATE TABLE "github_file_cache" (
  "id" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "github_repo_id" INTEGER NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_sha" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "content_hash" TEXT NOT NULL,
  "content" TEXT,
  "language" TEXT,
  "optimization_applied" BOOLEAN NOT NULL DEFAULT false,
  "optimization_strategies" TEXT[],
  "original_tokens" INTEGER,
  "optimized_tokens" INTEGER,
  "cached_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "github_file_cache_pkey" PRIMARY KEY ("id")
);

-- Create indexes for GitHub file cache
CREATE INDEX "github_file_cache_user_id_idx" ON "github_file_cache"("user_id");
CREATE INDEX "github_file_cache_repo_path_idx" ON "github_file_cache"("github_repo_id", "file_path");
CREATE INDEX "github_file_cache_content_hash_idx" ON "github_file_cache"("content_hash");
CREATE INDEX "github_file_cache_expires_at_idx" ON "github_file_cache"("expires_at");

-- Add foreign key constraint to users table
ALTER TABLE "github_file_cache" ADD CONSTRAINT "github_file_cache_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create optimization history table for GitHub operations
CREATE TABLE "github_optimization_history" (
  "id" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "github_repo_id" INTEGER NOT NULL,
  "operation_type" TEXT NOT NULL,
  "operation_data" JSONB NOT NULL,
  "result_data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error_message" TEXT,
  "tokens_saved" INTEGER DEFAULT 0,
  "cost_saved" DECIMAL(10, 6) DEFAULT 0.000000,
  "processing_time" INTEGER,
  "strategies_used" TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "github_optimization_history_pkey" PRIMARY KEY ("id")
);

-- Create indexes for GitHub optimization history
CREATE INDEX "github_optimization_history_user_id_idx" ON "github_optimization_history"("user_id");
CREATE INDEX "github_optimization_history_repo_idx" ON "github_optimization_history"("github_repo_id");
CREATE INDEX "github_optimization_history_operation_type_idx" ON "github_optimization_history"("operation_type");
CREATE INDEX "github_optimization_history_status_idx" ON "github_optimization_history"("status");
CREATE INDEX "github_optimization_history_created_at_idx" ON "github_optimization_history"("created_at");

-- Add foreign key constraint to users table
ALTER TABLE "github_optimization_history" ADD CONSTRAINT "github_optimization_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments for reference:
-- github_connections: Stores OAuth connections between users and their GitHub accounts
-- github_indexed_repositories: Tracks which repositories have been indexed for each user
-- github_file_cache: Caches optimized file content to avoid re-downloading and re-optimizing
-- github_optimization_history: Maintains audit trail of all GitHub-related optimization operations
