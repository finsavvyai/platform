import Joi from 'joi';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = Joi.object({
  // Service configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3005),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // Security
  JWT_SECRET: Joi.string().required(),
  API_KEY_SECRET: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Redis configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),

  // Storage configuration
  STORAGE_TYPE: Joi.string().valid('local', 's3', 'minio').default('local'),
  LOCAL_STORAGE_PATH: Joi.string().default('./storage'),

  // AWS S3 configuration (if using S3)
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET_NAME: Joi.string().optional(),

  // MinIO configuration (if using MinIO)
  MINIO_ENDPOINT: Joi.string().optional(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().optional(),
  MINIO_SECRET_KEY: Joi.string().optional(),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_BUCKET_NAME: Joi.string().optional(),

  // Document processing configuration
  MAX_FILE_SIZE: Joi.number().default(50 * 1024 * 1024), // 50MB
  MAX_BATCH_SIZE: Joi.number().default(1000),
  CHUNK_SIZE: Joi.number().default(1000),
  CHUNK_OVERLAP: Joi.number().default(100),
  MAX_CONCURRENT_PROCESSING: Joi.number().default(10),

  // OCR configuration
  OCR_ENABLED: Joi.boolean().default(true),
  OCR_LANGUAGES: Joi.string().default('eng'),
  TESSERACT_PATH: Joi.string().optional(),

  // PDF processing configuration
  PDF_IMAGE_EXTRACTION: Joi.boolean().default(true),
  PDF_TABLE_EXTRACTION: Joi.boolean().default(true),
  PDF_FORM_EXTRACTION: Joi.boolean().default(true),

  // Office documents configuration
  OFFICE_MAX_ROWS: Joi.number().default(10000),
  OFFICE_MAX_COLS: Joi.number().default(1000),

  // HTML processing configuration
  HTML_REMOVE_BOILERPLATE: Joi.boolean().default(true),
  HTML_PRESERVE_LINKS: Joi.boolean().default(true),
  HTML_PRESERVE_IMAGES: Joi.boolean().default(false),

  // Quality assessment configuration
  QUALITY_THRESHOLD: Joi.number().default(0.7),
  MIN_TEXT_LENGTH: Joi.number().default(10),

  // Metrics and monitoring
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().default(9095),

  // Elasticsearch configuration (for logs)
  ELASTICSEARCH_URL: Joi.string().optional(),
  ELASTICSEARCH_INDEX: Joi.string().optional(),

  // Worker configuration
  WORKER_CONCURRENCY: Joi.number().default(4),
  WORKER_MAX_MEMORY: Joi.number().default(512), // MB

  // Cache configuration
  CACHE_TTL: Joi.number().default(3600), // 1 hour
  CACHE_MAX_SIZE: Joi.number().default(1000),

  // Rate limiting
  RATE_LIMIT_WINDOW: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().default(100),

  // File type restrictions
  ALLOWED_MIME_TYPES: Joi.string().default(
    'application/pdf,' +
    'application/msword,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
    'application/vnd.ms-excel,' +
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
    'application/vnd.ms-powerpoint,' +
    'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
    'text/plain,' +
    'text/html,' +
    'text/markdown,' +
    'application/xml,' +
    'text/xml,' +
    'text/csv'
  ),

  // External service URLs
  AUTH_SERVICE_URL: Joi.string().optional(),
  NOTIFICATION_SERVICE_URL: Joi.string().optional(),

  // Feature flags
  FEATURE_BETA_PDF_PROCESSING: Joi.boolean().default(false),
  FEATURE_ADVANCED_OCR: Joi.boolean().default(false),
  FEATURE_MULTILINGUAL_SUPPORT: Joi.boolean().default(true),

  // Performance tuning
  COMPRESSION_LEVEL: Joi.number().default(6),
  TIMEOUT_MS: Joi.number().default(300000), // 5 minutes
  RETRY_ATTEMPTS: Joi.number().default(3),
  RETRY_DELAY_MS: Joi.number().default(1000),

  // Security
  ENCRYPTION_KEY: Joi.string().optional(),
  SANITIZE_HTML: Joi.boolean().default(true),
  VALIDATE_SIGNATURES: Joi.boolean().default(false),
});

// Validate configuration
const { error, value: validatedConfig } = configSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

// Export configuration
export const config = {
  // Service
  nodeEnv: validatedConfig.NODE_ENV,
  port: validatedConfig.PORT,
  logLevel: validatedConfig.LOG_LEVEL,

  // Security
  jwtSecret: validatedConfig.JWT_SECRET,
  apiKeySecret: validatedConfig.API_KEY_SECRET,
  allowedOrigins: validatedConfig.ALLOWED_ORIGINS.split(','),

  // Redis
  redis: {
    host: validatedConfig.REDIS_HOST,
    port: validatedConfig.REDIS_PORT,
    password: validatedConfig.REDIS_PASSWORD,
    db: validatedConfig.REDIS_DB,
  },

  // Storage
  storage: {
    type: validatedConfig.STORAGE_TYPE,
    localPath: validatedConfig.LOCAL_STORAGE_PATH,
    s3: validatedConfig.STORAGE_TYPE === 's3' ? {
      accessKeyId: validatedConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: validatedConfig.AWS_SECRET_ACCESS_KEY,
      region: validatedConfig.AWS_REGION,
      bucket: validatedConfig.S3_BUCKET_NAME,
    } : undefined,
    minio: validatedConfig.STORAGE_TYPE === 'minio' ? {
      endPoint: validatedConfig.MINIO_ENDPOINT,
      port: validatedConfig.MINIO_PORT,
      accessKey: validatedConfig.MINIO_ACCESS_KEY,
      secretKey: validatedConfig.MINIO_SECRET_KEY,
      useSSL: validatedConfig.MINIO_USE_SSL,
      bucket: validatedConfig.MINIO_BUCKET_NAME,
    } : undefined,
  },

  // Document processing
  processing: {
    maxFileSize: validatedConfig.MAX_FILE_SIZE,
    maxBatchSize: validatedConfig.MAX_BATCH_SIZE,
    chunkSize: validatedConfig.CHUNK_SIZE,
    chunkOverlap: validatedConfig.CHUNK_OVERLAP,
    maxConcurrentProcessing: validatedConfig.MAX_CONCURRENT_PROCESSING,
  },

  // OCR
  ocr: {
    enabled: validatedConfig.OCR_ENABLED,
    languages: validatedConfig.OCR_LANGUAGES.split(','),
    tesseractPath: validatedConfig.TESSERACT_PATH,
  },

  // PDF
  pdf: {
    imageExtraction: validatedConfig.PDF_IMAGE_EXTRACTION,
    tableExtraction: validatedConfig.PDF_TABLE_EXTRACTION,
    formExtraction: validatedConfig.PDF_FORM_EXTRACTION,
  },

  // Office
  office: {
    maxRows: validatedConfig.OFFICE_MAX_ROWS,
    maxCols: validatedConfig.OFFICE_MAX_COLS,
  },

  // HTML
  html: {
    removeBoilerplate: validatedConfig.HTML_REMOVE_BOILERPLATE,
    preserveLinks: validatedConfig.HTML_PRESERVE_LINKS,
    preserveImages: validatedConfig.HTML_PRESERVE_IMAGES,
  },

  // Quality
  quality: {
    threshold: validatedConfig.QUALITY_THRESHOLD,
    minTextLength: validatedConfig.MIN_TEXT_LENGTH,
  },

  // Metrics
  metrics: {
    enabled: validatedConfig.METRICS_ENABLED,
    port: validatedConfig.METRICS_PORT,
  },

  // Elasticsearch
  elasticsearch: validatedConfig.ELASTICSEARCH_URL ? {
    url: validatedConfig.ELASTICSEARCH_URL,
    index: validatedConfig.ELASTICSEARCH_INDEX,
  } : undefined,

  // Workers
  workers: {
    concurrency: validatedConfig.WORKER_CONCURRENCY,
    maxMemory: validatedConfig.WORKER_MAX_MEMORY,
  },

  // Cache
  cache: {
    ttl: validatedConfig.CACHE_TTL,
    maxSize: validatedConfig.CACHE_MAX_SIZE,
  },

  // Rate limiting
  rateLimit: {
    windowMs: validatedConfig.RATE_LIMIT_WINDOW,
    max: validatedConfig.RATE_LIMIT_MAX,
  },

  // File types
  allowedMimeTypes: validatedConfig.ALLOWED_MIME_TYPES.split(','),

  // External services
  services: {
    auth: validatedConfig.AUTH_SERVICE_URL,
    notification: validatedConfig.NOTIFICATION_SERVICE_URL,
  },

  // Features
  features: {
    betaPdfProcessing: validatedConfig.FEATURE_BETA_PDF_PROCESSING,
    advancedOcr: validatedConfig.FEATURE_ADVANCED_OCR,
    multilingualSupport: validatedConfig.FEATURE_MULTILINGUAL_SUPPORT,
  },

  // Performance
  performance: {
    compressionLevel: validatedConfig.COMPRESSION_LEVEL,
    timeoutMs: validatedConfig.TIMEOUT_MS,
    retryAttempts: validatedConfig.RETRY_ATTEMPTS,
    retryDelayMs: validatedConfig.RETRY_DELAY_MS,
  },

  // Security
  security: {
    encryptionKey: validatedConfig.ENCRYPTION_KEY,
    sanitizeHtml: validatedConfig.SANITIZE_HTML,
    validateSignatures: validatedConfig.VALIDATE_SIGNATURES,
  },

  // Environment
  isDevelopment: validatedConfig.NODE_ENV === 'development',
  isProduction: validatedConfig.NODE_ENV === 'production',
  isTest: validatedConfig.NODE_ENV === 'test',
};

export default config;
