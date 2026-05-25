import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { Logger } from '../utils/logger';
import { StorageError } from '../utils/error-handler';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  CreateBucketCommandInput,
  BucketLocationConstraint,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

export interface StorageConfig {
  type: 'local' | 's3' | 'minio';
  basePath?: string | undefined;
  bucket?: string | undefined;
  region?: string | undefined;
  accessKey?: string | undefined;
  secretKey?: string | undefined;
  endpoint?: string | undefined;
  useSSL?: boolean | undefined;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  metadata: Record<string, unknown>;
}

export interface FileMetadata {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  checksum?: string;
  filePath?: string;
  metadata: Record<string, unknown>;
}

export class StorageManager {
  private logger: Logger;
  private config: StorageConfig;
  private s3Client?: S3Client;
  private minioClient?: Minio.Client;
  private isInitialized: boolean = false;

  constructor(config?: Partial<StorageConfig>) {
    this.logger = new Logger('StorageManager');
    this.config = {
      type: (process.env.STORAGE_TYPE as StorageConfig['type']) || 'local',
      basePath: process.env.STORAGE_BASE_PATH || './storage',
      bucket: process.env.STORAGE_BUCKET || 'sdlc-documents',
      region: process.env.STORAGE_REGION || 'us-east-1',
      accessKey: process.env.STORAGE_ACCESS_KEY || undefined,
      secretKey: process.env.STORAGE_SECRET_KEY || undefined,
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      useSSL: process.env.STORAGE_USE_SSL === 'true',
      ...config,
    };
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing storage manager...');

      switch (this.config.type) {
        case 's3':
          await this.initializeS3();
          break;
        case 'minio':
          await this.initializeMinio();
          break;
        case 'local':
          await this.initializeLocalStorage();
          break;
        default:
          throw new StorageError(`Unsupported storage type: ${this.config.type}`);
      }

      this.isInitialized = true;
      this.logger.info(`Storage manager initialized with ${this.config.type} storage`);
    } catch (error) {
      this.logger.error('Failed to initialize storage manager:', error);
      throw new StorageError('Failed to initialize storage manager', error);
    }
  }

  private async initializeLocalStorage(): Promise<void> {
    try {
      // Create necessary directories
      const directories = [
        path.join(this.config.basePath!, 'uploads'),
        path.join(this.config.basePath!, 'processed'),
        path.join(this.config.basePath!, 'temp'),
        path.join(this.config.basePath!, 'chunks'),
        path.join(this.config.basePath!, 'metadata'),
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    } catch (error) {
      throw new StorageError('Failed to initialize local storage', error);
    }
  }

  private async initializeS3(): Promise<void> {
    try {
      if (!this.config.accessKey || !this.config.secretKey) {
        throw new StorageError('S3 credentials are required');
      }

      this.s3Client = new S3Client({
        region: this.config.region!,
        credentials: {
          accessKeyId: this.config.accessKey!,
          secretAccessKey: this.config.secretKey!,
        },
      });

      // Test connection and create bucket if needed
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket! })
      );
    } catch (error: unknown) {
      const errorName = (error as { name?: string }).name;
      const missingBucket = errorName === 'NotFound' || errorName === 'NoSuchBucket';
      if (missingBucket) {
        // Create bucket if it doesn't exist
        const createBucketParams: CreateBucketCommandInput = {
          Bucket: this.config.bucket!,
        };
        if (this.config.region && this.config.region !== 'us-east-1') {
          createBucketParams.CreateBucketConfiguration = {
            LocationConstraint: this.config.region as BucketLocationConstraint,
          };
        }
        await this.s3Client!.send(new CreateBucketCommand(createBucketParams));
      } else {
        throw new StorageError('Failed to initialize S3 storage', error);
      }
    }
  }

  private async initializeMinio(): Promise<void> {
    try {
      if (!this.config.accessKey || !this.config.secretKey || !this.config.endpoint) {
        throw new StorageError('Minio configuration is incomplete');
      }

      this.minioClient = new Minio.Client({
        endPoint: this.config.endpoint,
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: this.config.useSSL!,
        accessKey: this.config.accessKey,
        secretKey: this.config.secretKey,
      });

      // Test connection and create bucket if needed
      const bucketExists = await this.minioClient.bucketExists(this.config.bucket!);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.config.bucket!, this.config.region);
      }
    } catch (error) {
      throw new StorageError('Failed to initialize Minio storage', error);
    }
  }

  public async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    metadata: Record<string, unknown> = {}
  ): Promise<UploadResult> {
    this.ensureInitialized();

    const fileId = uuidv4();
    const extension = path.extname(originalName);
    const fileName = `${fileId}${extension}`;
    const uploadedAt = new Date();

    try {
      let filePath: string;
      let fileSize = buffer.length;

      switch (this.config.type) {
        case 'local':
          filePath = await this.uploadToLocal(buffer, fileName);
          break;
        case 's3':
          filePath = await this.uploadToS3(buffer, fileName, mimeType);
          break;
        case 'minio':
          filePath = await this.uploadToMinio(buffer, fileName, mimeType);
          break;
        default:
          throw new StorageError(`Unsupported storage type: ${this.config.type}`);
      }

      // Save metadata
      await this.saveMetadata(fileId, {
        fileId,
        originalName,
        mimeType,
        size: fileSize,
        uploadedAt,
        filePath,
        metadata,
      });

      const result: UploadResult = {
        fileId,
        fileName,
        filePath,
        fileSize,
        mimeType,
        uploadedAt,
        metadata,
      };

      this.logger.info(`File uploaded successfully: ${fileName} (${fileSize} bytes)`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to upload file ${originalName}:`, error);
      throw new StorageError('Failed to upload file', error);
    }
  }

  private async uploadToLocal(buffer: Buffer, fileName: string): Promise<string> {
    const filePath = path.join(this.config.basePath!, 'uploads', fileName);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  private async uploadToS3(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const key = `uploads/${fileName}`;
    const params = {
      Bucket: this.config.bucket!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    };

    await this.s3Client!.send(new PutObjectCommand(params));
    return this.s3ObjectUrl(key);
  }

  private async uploadToMinio(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const objectName = `uploads/${fileName}`;
    await this.minioClient!.putObject(this.config.bucket!, objectName, buffer, undefined, {
      'Content-Type': mimeType,
      'X-Amz-Meta-originalName': fileName,
      'X-Amz-Meta-uploadedAt': new Date().toISOString(),
    });

    return objectName;
  }

  public async downloadFile(fileId: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      const metadata = await this.getMetadata(fileId);
      if (!metadata) {
        throw new StorageError(`File metadata not found: ${fileId}`);
      }
      if (!metadata.filePath) {
        throw new StorageError(`File path not found in metadata: ${fileId}`);
      }

      switch (this.config.type) {
        case 'local':
          return await this.downloadFromLocal(metadata.filePath);
        case 's3':
          return await this.downloadFromS3(metadata.filePath);
        case 'minio':
          return await this.downloadFromMinio(metadata.filePath);
        default:
          throw new StorageError(`Unsupported storage type: ${this.config.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}:`, error);
      throw new StorageError('Failed to download file', error);
    }
  }

  private async downloadFromLocal(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    const params = {
      Bucket: this.config.bucket!,
      Key: key.replace(/^https?:\/\/[^\/]+\/[^\/]+\//, ''), // Extract key from URL
    };

    const result = await this.s3Client!.send(new GetObjectCommand(params));
    if (!result.Body) {
      throw new StorageError('S3 object body is empty');
    }
    return await this.s3BodyToBuffer(result.Body);
  }

  private async downloadFromMinio(objectName: string): Promise<Buffer> {
    const stream = await this.minioClient!.getObject(this.config.bucket!, objectName);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  public async deleteFile(fileId: string): Promise<void> {
    this.ensureInitialized();

    try {
      const metadata = await this.getMetadata(fileId);
      if (!metadata) {
        throw new StorageError(`File metadata not found: ${fileId}`);
      }
      if (!metadata.filePath) {
        throw new StorageError(`File path not found in metadata: ${fileId}`);
      }

      switch (this.config.type) {
        case 'local':
          await fs.unlink(metadata.filePath);
          break;
        case 's3':
          await this.deleteFromS3(metadata.filePath);
          break;
        case 'minio':
          await this.deleteFromMinio(metadata.filePath);
          break;
      }

      // Delete metadata
      await this.deleteMetadata(fileId);

      this.logger.info(`File deleted successfully: ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId}:`, error);
      throw new StorageError('Failed to delete file', error);
    }
  }

  private async deleteFromS3(key: string): Promise<void> {
    const params = {
      Bucket: this.config.bucket!,
      Key: key.replace(/^https?:\/\/[^\/]+\/[^\/]+\//, ''),
    };

    await this.s3Client!.send(new DeleteObjectCommand(params));
  }

  private async deleteFromMinio(objectName: string): Promise<void> {
    await this.minioClient!.removeObject(this.config.bucket!, objectName);
  }

  public async saveProcessedFile(
    originalFileId: string,
    content: string | Buffer,
    fileType: 'extracted' | 'chunks' | 'metadata',
    format: string = 'json'
  ): Promise<string> {
    this.ensureInitialized();

    const fileName = `${originalFileId}_${fileType}.${format}`;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

    try {
      let filePath: string;

      switch (this.config.type) {
        case 'local':
          filePath = path.join(this.config.basePath!, 'processed', fileName);
          await fs.writeFile(filePath, buffer);
          break;
        case 's3':
          filePath = `processed/${fileName}`;
          await this.s3Client!.send(
            new PutObjectCommand({
              Bucket: this.config.bucket!,
              Key: filePath,
              Body: buffer,
              ContentType: `application/${format}`,
            })
          );
          break;
        case 'minio':
          filePath = `processed/${fileName}`;
          await this.minioClient!.putObject(
            this.config.bucket!,
            filePath,
            buffer,
            undefined,
            { 'Content-Type': `application/${format}` }
          );
          break;
        default:
          throw new StorageError(`Unsupported storage type: ${this.config.type}`);
      }

      this.logger.info(`Processed file saved: ${fileName}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to save processed file ${fileName}:`, error);
      throw new StorageError('Failed to save processed file', error);
    }
  }

  private async saveMetadata(fileId: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = path.join(this.config.basePath!, 'metadata', `${fileId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async getMetadata(fileId: string): Promise<FileMetadata | null> {
    try {
      const metadataPath = path.join(this.config.basePath!, 'metadata', `${fileId}.json`);
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async deleteMetadata(fileId: string): Promise<void> {
    const metadataPath = path.join(this.config.basePath!, 'metadata', `${fileId}.json`);
    await fs.unlink(metadataPath);
  }

  public async getStorageStats(): Promise<any> {
    this.ensureInitialized();

    try {
      switch (this.config.type) {
        case 'local':
          return await this.getLocalStorageStats();
        case 's3':
          return await this.getS3StorageStats();
        case 'minio':
          return await this.getMinioStorageStats();
        default:
          throw new StorageError(`Unsupported storage type: ${this.config.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to get storage stats:', error);
      throw new StorageError('Failed to get storage stats', error);
    }
  }

  private async getLocalStorageStats(): Promise<any> {
    const uploadsPath = path.join(this.config.basePath!, 'uploads');
    const processedPath = path.join(this.config.basePath!, 'processed');

    const [uploadFiles, processedFiles] = await Promise.all([
      this.getDirectoryStats(uploadsPath),
      this.getDirectoryStats(processedPath),
    ]);

    return {
      type: 'local',
      uploads: uploadFiles,
      processed: processedFiles,
      total: {
        files: uploadFiles.files + processedFiles.files,
        size: uploadFiles.size + processedFiles.size,
      },
    };
  }

  private async getDirectoryStats(dirPath: string): Promise<{ files: number; size: number }> {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          fileCount++;
        }
      }

      return { files: fileCount, size: totalSize };
    } catch (error) {
      return { files: 0, size: 0 };
    }
  }

  private async getS3StorageStats(): Promise<any> {
    // Implementation would use S3 API to get bucket statistics
    return {
      type: 's3',
      bucket: this.config.bucket,
      // ... additional stats
    };
  }

  private async getMinioStorageStats(): Promise<any> {
    // Implementation would use Minio API to get bucket statistics
    return {
      type: 'minio',
      bucket: this.config.bucket,
      // ... additional stats
    };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new StorageError('Storage manager is not initialized');
    }
  }

  private s3ObjectUrl(key: string): string {
    const region = this.config.region || 'us-east-1';
    return `https://${this.config.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private async s3BodyToBuffer(body: unknown): Promise<Buffer> {
    if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      return Buffer.from(bytes);
    }

    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }

    throw new StorageError('Unsupported S3 response body type');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Storage manager shutdown');
    // No specific cleanup needed for most storage types
  }
}
