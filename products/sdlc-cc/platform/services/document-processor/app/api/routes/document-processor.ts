import { Router, Request, Response } from 'express';
import { QueueManager } from '../../core/queue-manager';
import { StorageManager } from '../../core/storage-manager';
import { MetricsCollector } from '../../utils/metrics';
import { Logger } from '../../utils/logger';
import { asyncHandler } from '../../utils/error-handler';

export class DocumentProcessorRouter {
  public router: Router;
  private logger: Logger;
  private queueManager: QueueManager;
  private storageManager: StorageManager;
  private metricsCollector: MetricsCollector;

  constructor(
    queueManager: QueueManager,
    storageManager: StorageManager,
    metricsCollector: MetricsCollector
  ) {
    this.router = Router();
    this.logger = new Logger('DocumentProcessorRouter');
    this.queueManager = queueManager;
    this.storageManager = storageManager;
    this.metricsCollector = metricsCollector;

    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      '/documents/process',
      asyncHandler(async (req: Request, res: Response) => {
        const { documentId, filePath, documentType, operations, options } = req.body;

        const job = await this.queueManager.addDocumentJob({
          documentId,
          filePath,
          documentType,
          operations: operations || [],
          options: options || {},
        });

        res.status(202).json({
          jobId: job.id,
          documentId,
          status: 'queued',
          message: 'Document processing job created',
        });
      })
    );

    this.router.get(
      '/documents/status/:jobId',
      asyncHandler(async (req: Request, res: Response) => {
        const jobId = req.params['jobId'];
        if (!jobId) {
          res.status(400).json({ error: 'Job ID is required' });
          return;
        }
        const status = await this.queueManager.getJobStatus('document', jobId);

        if (!status) {
          res.status(404).json({ error: 'Job not found' });
          return;
        }

        res.json(status);
      })
    );

    this.router.get(
      '/queues/stats',
      asyncHandler(async (_req: Request, res: Response) => {
        const stats = await this.queueManager.getQueueStats('document');
        res.json(stats);
      })
    );
  }
}
