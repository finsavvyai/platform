# CQRS and Event Sourcing Implementation Guide

## Overview

This guide provides comprehensive implementation of Command Query Responsibility Segregation (CQRS) and Event Sourcing patterns for SDLC.ai, optimized for Cloudflare's serverless architecture.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Command Side  │     │  Event Store    │     │   Query Side    │
│                 │     │                 │     │                 │
│ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │
│ │   Commands  │─┼────▶││    Events   │─┼────▶││   Read Models│ │
│ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │
│        │        │     │        │        │     │        │        │
│ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │
│ │ Command Hdl │ │     │ │  Snapshots  │ │     │ │ Projections  │ │
│ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │
│        │        │     │        │        │     │        │        │
│ ┌─────────────┐ │     │ ┌─────────────┐ │     │ ┌─────────────┐ │
│ │ Validation  │ │     │ │ Compensating│ │     │ │   Denormals  │ │
│ │ & Bus Rules │ │     │ │   Actions   │ │     │ │   Storage    │ │
│ └─────────────┘ │     │ └─────────────┘ │     │ └─────────────┘ │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   R2 Storage    │     │ Cloudflare      │     │   D1 Database  │
│   (Snapshots)   │     │   Queues        │     │ (Read Models)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Core Implementation

### 1. Command Side Implementation

```typescript
// cqrs/Command.ts
export interface Command {
  readonly commandId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly userId: string;
  readonly timestamp: Date;
  readonly expectedVersion?: number;
  readonly metadata: Record<string, unknown>;
}

export abstract class BaseCommand implements Command {
  readonly commandId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly userId: string;
  readonly timestamp: Date;
  readonly expectedVersion?: number;
  readonly metadata: Record<string, unknown>;

  constructor(data: CommandData) {
    this.commandId = data.commandId || generateCommandId();
    this.aggregateId = data.aggregateId;
    this.aggregateType = data.aggregateType;
    this.userId = data.userId;
    this.timestamp = data.timestamp || new Date();
    this.expectedVersion = data.expectedVersion;
    this.metadata = data.metadata || {};
  }

  abstract getCommandType(): string;
}

// Commands Example
export class CreateDocumentCommand extends BaseCommand {
  constructor(data: CreateDocumentData) {
    super({
      ...data,
      aggregateType: 'Document'
    });
  }

  getCommandType(): string {
    return 'CreateDocument';
  }
}

export class UpdateDocumentCommand extends BaseCommand {
  readonly title?: string;
  readonly content?: string;
  readonly classification?: SecurityClassification;

  constructor(data: UpdateDocumentData) {
    super({
      ...data,
      aggregateType: 'Document'
    });
    this.title = data.title;
    this.content = data.content;
    this.classification = data.classification;
  }

  getCommandType(): string {
    return 'UpdateDocument';
  }
}

// cqrs/CommandHandler.ts
export interface ICommandHandler<TCommand extends Command> {
  handle(command: TCommand): Promise<void>;
  canHandle(command: Command): boolean;
}

export class CreateDocumentCommandHandler implements ICommandHandler<CreateDocumentCommand> {
  constructor(
    private readonly documentRepository: IDocumentWriteRepository,
    private readonly eventStore: IEventStore,
    private readonly validationService: IDocumentValidationService,
    private readonly fileStorage: IFileStorage,
    private readonly dlpService: IDLPService
  ) {}

  async canHandle(command: Command): boolean {
    return command.getCommandType() === 'CreateDocument';
  }

  async handle(command: CreateDocumentCommand): Promise<void> {
    // 1. Validate command
    await this.validateCommand(command);

    // 2. Check for existing document
    const existing = await this.documentRepository.findById(command.aggregateId);
    if (existing) {
      throw new DocumentAlreadyExistsException(command.aggregateId);
    }

    // 3. Process file content
    const processedContent = await this.processContent(command.content);

    // 4. Apply DLP scanning
    const dlpResult = await this.dlpService.scan(processedContent);
    if (!dlpResult.isCompliant) {
      throw new DocumentNotCompliantException(dlpResult.violations);
    }

    // 5. Create document aggregate
    const document = Document.create({
      id: command.aggregateId,
      tenantId: command.tenantId,
      title: command.title,
      content: processedContent,
      classification: dlpResult.classification,
      createdBy: command.userId,
      metadata: command.metadata
    });

    // 6. Store file
    const storageLocation = await this.fileStorage.store(
      document.id,
      processedContent
    );

    // 7. Update storage location
    document.updateStorageLocation(storageLocation);

    // 8. Persist events
    const events = document.getUncommittedEvents();
    await this.eventStore.saveEvents(
      document.id,
      events,
      command.expectedVersion
    );

    // 9. Clear uncommitted events
    document.clearUncommittedEvents();

    // 10. Save aggregate state
    await this.documentRepository.save(document);
  }

  private async validateCommand(command: CreateDocumentCommand): Promise<void> {
    const validationResult = await this.validationService.validate({
      title: command.title,
      content: command.content,
      tenantId: command.tenantId,
      userId: command.userId
    });

    if (!validationResult.isValid) {
      throw new CommandValidationException(validationResult.errors);
    }
  }

  private async processContent(content: string): Promise<string> {
    // Apply content processing rules
    return content; // Simplified
  }
}

// cqrs/CommandBus.ts
export class CommandBus {
  private readonly handlers = new Map<string, ICommandHandler<Command>>();

  register<TCommand extends Command>(
    commandType: string,
    handler: ICommandHandler<TCommand>
  ): void {
    this.handlers.set(commandType, handler as ICommandHandler<Command>);
  }

  async dispatch(command: Command): Promise<void> {
    const handler = this.handlers.get(command.getCommandType());
    
    if (!handler) {
      throw new NoCommandHandlerException(command.getCommandType());
    }

    try {
      // Start transaction
      await this.startTransaction();

      // Execute command
      await handler.handle(command);

      // Commit transaction
      await this.commitTransaction();

    } catch (error) {
      // Rollback transaction
      await this.rollbackTransaction();
      throw error;
    }
  }

  private async startTransaction(): Promise<void> {
    // Implement transaction start
  }

  private async commitTransaction(): Promise<void> {
    // Implement transaction commit
  }

  private async rollbackTransaction(): Promise<void> {
    // Implement transaction rollback
  }
}
```

### 2. Event Store Implementation

```typescript
// eventsourcing/EventStore.ts
export interface IEventStore {
  saveEvents(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void>;

  getEvents(
    streamId: string,
    fromVersion?: number,
    count?: number
  ): Promise<DomainEvent[]>;

  getEventsByType(
    eventType: string,
    fromTimestamp?: Date,
    toTimestamp?: Date
  ): Promise<DomainEvent[]>;

  saveSnapshot(
    streamId: string,
    snapshot: Snapshot
  ): Promise<void>;

  getSnapshot(streamId: string): Promise<Snapshot | null>;

  subscribeToEvents(
    handler: EventHandler,
    eventTypes?: string[]
  ): Promise<void>;
}

// Cloudflare Event Store Implementation
export class CloudflareEventStore implements IEventStore {
  constructor(
    private readonly r2: R2Bucket,
    private readonly queue: Queue<DomainEvent>,
    private readonly metrics: IMetricsCollector
  ) {}

  async saveEvents(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    if (events.length === 0) return;

    // Check expected version
    if (expectedVersion !== undefined) {
      const currentVersion = await this.getCurrentVersion(streamId);
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyException(streamId, expectedVersion, currentVersion);
      }
    }

    // Persist events to R2
    const batch = new WriteBatch();
    let currentVersion = expectedVersion || 0;

    for (const event of events) {
      const eventVersion = ++currentVersion;
      const eventWithVersion = { ...event, version: eventVersion };

      const key = `streams/${streamId}/events/${eventVersion}`;
      const value = JSON.stringify(eventWithVersion);
      
      batch.put(key, value);
    }

    // Write batch to R2
    await this.r2.write(batch);

    // Publish to queue for async processing
    for (const event of events) {
      await this.queue.send(event);
    }

    // Update metrics
    this.metrics.increment('events.saved', {
      streamId,
      count: events.length
    });

    // Create snapshot if needed
    if (currentVersion % 100 === 0) {
      await this.createSnapshot(streamId, currentVersion);
    }
  }

  async getEvents(
    streamId: string,
    fromVersion = 1,
    count?: number
  ): Promise<DomainEvent[]> {
    const prefix = `streams/${streamId}/events/`;
    const objects = await this.r2.list({
      prefix,
      limit: count
    });

    const events: DomainEvent[] = [];

    for (const object of objects.objects) {
      const version = parseInt(object.key.split('/').pop() || '0');
      if (version >= fromVersion) {
        const event = await this.loadEvent(object.key);
        events.push(event);
      }
    }

    return events.sort((a, b) => a.version - b.version);
  }

  async getEventsByType(
    eventType: string,
    fromTimestamp?: Date,
    toTimestamp?: Date
  ): Promise<DomainEvent[]> {
    const prefix = `events/${eventType}/`;
    const objects = await this.r2.list({ prefix });

    const events: DomainEvent[] = [];

    for (const object of objects.objects) {
      const event = await this.loadEvent(object.key);
      
      if (fromTimestamp && event.occurredOn < fromTimestamp) continue;
      if (toTimestamp && event.occurredOn > toTimestamp) continue;
      
      events.push(event);
    }

    return events;
  }

  async saveSnapshot(streamId: string, snapshot: Snapshot): Promise<void> {
    const key = `streams/${streamId}/snapshots/${snapshot.version}`;
    const value = JSON.stringify(snapshot);

    await this.r2.put(key, value);

    // Clean up old events (keep last 1000)
    await this.cleanupOldEvents(streamId, snapshot.version);
  }

  async getSnapshot(streamId: string): Promise<Snapshot | null> {
    const prefix = `streams/${streamId}/snapshots/`;
    const objects = await this.r2.list({ 
      prefix,
      limit: 1,
      reverse: true // Get latest
    });

    if (objects.objects.length === 0) {
      return null;
    }

    const latest = objects.objects[0];
    const value = await this.r2.get(latest.key);
    
    if (!value) return null;

    return JSON.parse(await value.text()) as Snapshot;
  }

  async subscribeToEvents(
    handler: EventHandler,
    eventTypes?: string[]
  ): Promise<void> {
    // Create queue consumer
    const consumer = new QueueConsumer(this.queue);

    await consumer.consume(async (event: DomainEvent) => {
      if (!eventTypes || eventTypes.includes(event.eventType)) {
        await handler.handle(event);
      }
    });
  }

  private async loadEvent(key: string): Promise<DomainEvent> {
    const object = await this.r2.get(key);
    
    if (!object) {
      throw new EventNotFoundException(key);
    }

    const data = await object.text();
    return JSON.parse(data) as DomainEvent;
  }

  private async getCurrentVersion(streamId: string): Promise<number> {
    const snapshot = await this.getSnapshot(streamId);
    
    if (snapshot) {
      return snapshot.version;
    }

    // Get latest event version
    const prefix = `streams/${streamId}/events/`;
    const objects = await this.r2.list({ 
      prefix,
      limit: 1,
      reverse: true
    });

    if (objects.objects.length === 0) {
      return 0;
    }

    const latestKey = objects.objects[0].key;
    const version = parseInt(latestKey.split('/').pop() || '0');
    
    return version;
  }

  private async createSnapshot(streamId: string, version: number): Promise<void> {
    // Rebuild aggregate from events
    const events = await this.getEvents(streamId, 1, 1000);
    const aggregate = Document.fromEvents(events);

    const snapshot: Snapshot = {
      streamId,
      version,
      data: aggregate.toJSON(),
      createdAt: new Date()
    };

    await this.saveSnapshot(streamId, snapshot);
  }

  private async cleanupOldEvents(streamId: string, keepVersion: number): Promise<void> {
    // Delete events older than snapshot
    const batch = new WriteBatch();
    const prefix = `streams/${streamId}/events/`;
    const objects = await this.r2.list({ prefix });

    for (const object of objects.objects) {
      const version = parseInt(object.key.split('/').pop() || '0');
      if (version < keepVersion - 100) {
        batch.delete(object.key);
      }
    }

    await this.r2.write(batch);
  }
}
```

### 3. Query Side Implementation

```typescript
// cqrs/Query.ts
export interface Query {
  readonly queryId: string;
  readonly userId?: string;
  readonly tenantId: string;
  readonly parameters: Record<string, unknown>;
}

export abstract class BaseQuery implements Query {
  readonly queryId: string;
  readonly userId?: string;
  readonly tenantId: string;
  readonly parameters: Record<string, unknown>;

  constructor(data: QueryData) {
    this.queryId = data.queryId || generateQueryId();
    this.userId = data.userId;
    this.tenantId = data.tenantId;
    this.parameters = data.parameters || {};
  }

  abstract getQueryType(): string;
}

// Queries Example
export class GetDocumentQuery extends BaseQuery {
  readonly documentId: string;

  constructor(data: GetDocumentData) {
    super(data);
    this.documentId = data.documentId;
  }

  getQueryType(): string {
    return 'GetDocument';
  }
}

export class SearchDocumentsQuery extends BaseQuery {
  readonly searchText: string;
  readonly filters: DocumentFilters;
  readonly pagination: PaginationOptions;

  constructor(data: SearchDocumentsData) {
    super(data);
    this.searchText = data.searchText;
    this.filters = data.filters;
    this.pagination = data.pagination;
  }

  getQueryType(): string {
    return 'SearchDocuments';
  }
}

// Read Models
export interface DocumentReadModel {
  id: string;
  tenantId: string;
  title: string;
  summary: string;
  tags: string[];
  classification: string;
  author: string;
  createdAt: Date;
  lastModified: Date;
  size: number;
  downloadUrl?: string;
  metadata: Record<string, unknown>;
}

// cqrs/QueryHandler.ts
export interface IQueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
  canHandle(query: Query): boolean;
}

export class GetDocumentQueryHandler 
  implements IQueryHandler<GetDocumentQuery, DocumentReadModel | null> {
  
  constructor(
    private readonly readRepository: IDocumentReadRepository,
    private readonly cache: ICache
  ) {}

  async canHandle(query: Query): boolean {
    return query.getQueryType() === 'GetDocument';
  }

  async handle(query: GetDocumentQuery): Promise<DocumentReadModel | null> {
    // Check cache first
    const cacheKey = `document:${query.documentId}:${query.tenantId}`;
    let document = await this.cache.get(cacheKey);

    if (!document) {
      // Load from read model
      document = await this.readRepository.findById(
        query.documentId,
        query.tenantId
      );

      if (document) {
        // Cache for 5 minutes
        await this.cache.set(cacheKey, document, 300000);
      }
    }

    return document;
  }
}

export class SearchDocumentsQueryHandler 
  implements IQueryHandler<SearchDocumentsQuery, PaginatedResult<DocumentReadModel>> {
  
  constructor(
    private readonly searchIndex: ISearchIndex,
    private readonly readRepository: IDocumentReadRepository,
    private readonly metrics: IMetricsCollector
  ) {}

  async canHandle(query: Query): boolean {
    return query.getQueryType() === 'SearchDocuments';
  }

  async handle(
    query: SearchDocumentsQuery
  ): Promise<PaginatedResult<DocumentReadModel>> {
    const startTime = Date.now();

    // Build search request
    const searchRequest: SearchRequest = {
      query: query.searchText,
      filters: {
        tenantId: query.tenantId,
        ...query.filters
      },
      pagination: query.pagination,
      facets: ['classification', 'tags', 'author']
    };

    // Execute search
    const searchResult = await this.searchIndex.search(searchRequest);

    // Load full documents
    const documents = await this.readRepository.findByIds(
      searchResult.ids,
      query.tenantId
    );

    // Build paginated result
    const result: PaginatedResult<DocumentReadModel> = {
      items: documents,
      total: searchResult.total,
      page: query.pagination.page,
      pageSize: query.pagination.pageSize,
      hasNext: searchResult.total > (query.pagination.page * query.pagination.pageSize),
      facets: searchResult.facets
    };

    // Record metrics
    const duration = Date.now() - startTime;
    this.metrics.record('search.query.duration', duration, {
      tenantId: query.tenantId
    });

    return result;
  }
}

// cqrs/QueryBus.ts
export class QueryBus {
  private readonly handlers = new Map<string, IQueryHandler<Query, any>>();

  register<TResult>(
    queryType: string,
    handler: IQueryHandler<Query, TResult>
  ): void {
    this.handlers.set(queryType, handler);
  }

  async dispatch<TResult>(query: Query): Promise<TResult> {
    const handler = this.handlers.get(query.getQueryType());
    
    if (!handler) {
      throw new NoQueryHandlerException(query.getQueryType());
    }

    // Check permissions
    await this.checkQueryPermissions(query);

    // Execute query
    return handler.handle(query as any);
  }

  private async checkQueryPermissions(query: Query): Promise<void> {
    // Implement query authorization logic
  }
}
```

### 4. Event Projections

```typescript
// projections/Projection.ts
export interface IProjection {
  readonly name: string;
  readonly eventTypes: string[];
  handle(event: DomainEvent): Promise<void>;
}

export class DocumentSearchProjection implements IProjection {
  readonly name = 'document-search';
  readonly eventTypes = [
    'DocumentCreated',
    'DocumentUpdated',
    'DocumentDeleted',
    'DocumentClassified'
  ];

  constructor(
    private readonly searchIndex: ISearchIndex,
    private readonly logger: ILogger
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'DocumentCreated':
          await this.handleDocumentCreated(event as DocumentCreatedEvent);
          break;

        case 'DocumentUpdated':
          await this.handleDocumentUpdated(event as DocumentUpdatedEvent);
          break;

        case 'DocumentDeleted':
          await this.handleDocumentDeleted(event as DocumentDeletedEvent);
          break;

        case 'DocumentClassified':
          await this.handleDocumentClassified(event as DocumentClassifiedEvent);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle event in projection', {
        projection: this.name,
        event: event.eventType,
        eventId: event.eventId,
        error: error.message
      });
      throw error;
    }
  }

  private async handleDocumentCreated(event: DocumentCreatedEvent): Promise<void> {
    const document: SearchableDocument = {
      id: event.data.documentId,
      tenantId: event.data.tenantId,
      title: event.data.title,
      content: event.data.content,
      classification: event.data.classification,
      tags: event.data.tags || [],
      author: event.data.createdBy,
      createdAt: event.data.createdAt,
      metadata: event.data.metadata
    };

    await this.searchIndex.index(document);
  }

  private async handleDocumentUpdated(event: DocumentUpdatedEvent): Promise<void> {
    await this.searchIndex.update({
      id: event.data.documentId,
      tenantId: event.data.tenantId,
      changes: event.data.changes
    });
  }

  private async handleDocumentDeleted(event: DocumentDeletedEvent): Promise<void> {
    await this.searchIndex.remove(
      event.data.documentId,
      event.data.tenantId
    );
  }

  private async handleDocumentClassified(
    event: DocumentClassifiedEvent
  ): Promise<void> {
    await this.searchIndex.updateClassification(
      event.data.documentId,
      event.data.newClassification
    );
  }
}

// projections/ProjectionManager.ts
export class ProjectionManager {
  private readonly projections = new Map<string, IProjection>();
  private readonly checkpoints = new Map<string, number>();

  constructor(
    private readonly eventStore: IEventStore,
    private readonly checkpointStore: ICheckpointStore
  ) {}

  async registerProjection(projection: IProjection): Promise<void> {
    this.projections.set(projection.name, projection);

    // Get last processed checkpoint
    const checkpoint = await this.checkpointStore.getLastCheckpoint(
      projection.name
    );
    
    if (checkpoint) {
      this.checkpoints.set(projection.name, checkpoint.lastEventNumber);
    }
  }

  async start(): Promise<void> {
    // Subscribe to all event types
    const allEventTypes = Array.from(this.projections.values())
      .flatMap(p => p.eventTypes)
      .filter((v, i, a) => a.indexOf(v) === i); // Unique

    await this.eventStore.subscribeToEvents(
      {
        handle: async (event: DomainEvent) => {
          await this.handleEvent(event);
        }
      },
      allEventTypes
    );
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    const projections = this.getProjectionsForEvent(event.eventType);

    for (const projection of projections) {
      await this.processEvent(projection, event);
    }
  }

  private async processEvent(
    projection: IProjection,
    event: DomainEvent
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(projection.name) || 0;

    // Check if already processed
    if (event.version <= checkpoint) {
      return;
    }

    try {
      // Handle event
      await projection.handle(event);

      // Update checkpoint
      this.checkpoints.set(projection.name, event.version);
      await this.checkpointStore.saveCheckpoint(
        projection.name,
        event.version,
        event.occurredOn
      );

    } catch (error) {
      // Log error but continue processing other projections
      console.error(`Projection ${projection.name} failed to process event`, {
        eventId: event.eventId,
        eventType: event.eventType,
        error: error.message
      });
    }
  }

  private getProjectionsForEvent(eventType: string): IProjection[] {
    return Array.from(this.projections.values())
      .filter(p => p.eventTypes.includes(eventType));
  }
}
```

### 5. Saga Implementation

```typescript
// saga/Saga.ts
export interface ISaga {
  readonly sagaId: string;
  readonly sagaType: string;
  readonly correlationId: string;
  status: SagaStatus;
  data: Record<string, unknown>;
  currentStep: number;
  startedAt: Date;
  completedAt?: Date;
  error?: Error;
}

export enum SagaStatus {
  PENDING = 'pending',
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

export interface ISagaStep {
  readonly name: string;
  readonly action: SagaAction;
  readonly compensation?: SagaAction;
  readonly triggeredBy: string;
}

export type SagaAction = (data: any) => Promise<any>;

export class DocumentProcessingSaga implements ISaga {
  public sagaId: string;
  public sagaType = 'DocumentProcessing';
  public status = SagaStatus.PENDING;
  public data: Record<string, unknown> = {};
  public currentStep = 0;
  public startedAt = new Date();
  public completedAt?: Date;
  public error?: Error;

  private readonly steps: ISagaStep[] = [
    {
      name: 'StoreDocument',
      action: this.storeDocument.bind(this),
      compensation: this.deleteDocument.bind(this),
      triggeredBy: 'DocumentCreated'
    },
    {
      name: 'ClassifyContent',
      action: this.classifyContent.bind(this),
      compensation: this.removeClassification.bind(this),
      triggeredBy: 'DocumentStored'
    },
    {
      name: 'IndexForSearch',
      action: this.indexForSearch.bind(this),
      compensation: this.removeFromIndex.bind(this),
      triggeredBy: 'DocumentClassified'
    },
    {
      name: 'GenerateThumbnail',
      action: this.generateThumbnail.bind(this),
      compensation: this.deleteThumbnail.bind(this),
      triggeredBy: 'DocumentIndexed'
    }
  ];

  constructor(
    public readonly correlationId: string,
    private readonly services: DocumentProcessingServices
  ) {
    this.sagaId = generateSagaId();
  }

  async start(documentData: any): Promise<void> {
    this.data = { documentData };
    this.status = SagaStatus.STARTED;
    this.startedAt = new Date();

    await this.executeStep(0);
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    if (this.status === SagaStatus.FAILED || 
        this.status === SagaStatus.COMPLETED ||
        this.status === SagaStatus.COMPENSATED) {
      return;
    }

    const nextStepIndex = this.findNextStep(event.eventType);
    
    if (nextStepIndex !== -1) {
      await this.executeStep(nextStepIndex);
    }
  }

  private async executeStep(stepIndex: number): Promise<void> {
    if (stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[stepIndex];
    this.currentStep = stepIndex;

    try {
      // Execute step action
      const result = await step.action(this.data);
      
      // Store result
      this.data[step.name] = result;

      // Publish success event
      await this.publishEvent(`${step.name}Completed`, {
        sagaId: this.sagaId,
        correlationId: this.correlationId,
        result
      });

    } catch (error) {
      this.error = error as Error;
      await this.compensate();
      throw error;
    }
  }

  private async compensate(): Promise<void> {
    this.status = SagaStatus.COMPENSATING;

    // Execute compensating actions in reverse order
    for (let i = this.currentStep; i >= 0; i--) {
      const step = this.steps[i];
      
      if (step.compensation && this.data[step.name]) {
        try {
          await step.compensation(this.data);
        } catch (error) {
          console.error(`Compensation failed for step ${step.name}`, error);
        }
      }
    }

    this.status = SagaStatus.COMPENSATED;
    
    // Publish compensation event
    await this.publishEvent('SagaCompensated', {
      sagaId: this.sagaId,
      correlationId: this.correlationId,
      error: this.error?.message
    });
  }

  private complete(): void {
    this.status = SagaStatus.COMPLETED;
    this.completedAt = new Date();
  }

  private findNextStep(eventType: string): number {
    return this.steps.findIndex((step, index) => 
      index > this.currentStep && step.triggeredBy === eventType
    );
  }

  private async storeDocument(data: any): Promise<any> {
    return await this.services.documentService.store(
      data.documentData
    );
  }

  private async classifyContent(data: any): Promise<any> {
    return await this.services.classificationService.classify(
      data.StoreDocument.documentId
    );
  }

  private async indexForSearch(data: any): Promise<any> {
    return await this.services.searchService.index(
      data.ClassifyContent.documentId,
      data.ClassifyContent.classification
    );
  }

  private async generateThumbnail(data: any): Promise<any> {
    return await this.services.thumbnailService.generate(
      data.IndexForSearch.documentId
    );
  }

  // Compensation methods
  private async deleteDocument(data: any): Promise<void> {
    await this.services.documentService.delete(
      data.documentData.id
    );
  }

  private async removeClassification(data: any): Promise<void> {
    await this.services.classificationService.remove(
      data.StoreDocument.documentId
    );
  }

  private async removeFromIndex(data: any): Promise<void> {
    await this.services.searchService.remove(
      data.ClassifyContent.documentId
    );
  }

  private async deleteThumbnail(data: any): Promise<void> {
    await this.services.thumbnailService.delete(
      data.IndexForSearch.documentId
    );
  }

  private async publishEvent(eventType: string, data: any): Promise<void> {
    const event: DomainEvent = {
      eventId: generateEventId(),
      eventType,
      aggregateId: this.sagaId,
      aggregateType: 'Saga',
      version: 1,
      occurredOn: new Date(),
      data
    };

    await this.services.eventBus.publish(event);
  }
}

// saga/SagaManager.ts
export class SagaManager {
  private readonly activeSagas = new Map<string, ISaga>();
  private readonly sagaDefinitions = new Map<string, any>();

  constructor(
    private readonly eventBus: IEventBus,
    private readonly sagaStore: ISagaStore
  ) {}

  registerSagaType(sagaType: string, sagaClass: any): void {
    this.sagaDefinitions.set(sagaType, sagaClass);
  }

  async startSaga<T extends ISaga>(
    sagaType: string,
    correlationId: string,
    data: any
  ): Promise<T> {
    const SagaClass = this.sagaDefinitions.get(sagaType);
    
    if (!SagaClass) {
      throw new SagaTypeNotRegisteredException(sagaType);
    }

    const saga = new SagaClass(correlationId, this.services) as T;
    
    // Store saga
    await this.sagaStore.save(saga);
    this.activeSagas.set(saga.sagaId, saga);

    // Start saga
    await saga.start(data);

    // Save updated state
    await this.sagaStore.save(saga);

    return saga;
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    // Find relevant sagas
    const sagas = await this.findSagasForEvent(event);

    for (const saga of sagas) {
      await this.processSagaEvent(saga, event);
    }
  }

  private async findSagasForEvent(event: DomainEvent): Promise<ISaga[]> {
    // Find sagas by correlation ID or other matching criteria
    return await this.sagaStore.findByEvent(event);
  }

  private async processSagaEvent(
    saga: ISaga,
    event: DomainEvent
  ): Promise<void> {
    try {
      await saga.handleEvent(event);
      
      // Save updated state
      await this.sagaStore.save(saga);

      // Remove from active if completed
      if (saga.status === SagaStatus.COMPLETED ||
          saga.status === SagaStatus.COMPENSATED) {
        this.activeSagas.delete(saga.sagaId);
      }
    } catch (error) {
      console.error(`Saga ${saga.sagaId} failed to process event`, error);
      
      // Save error state
      await this.sagaStore.save(saga);
    }
  }
}
```

## Configuration and Setup

### 1. Dependency Injection Configuration

```typescript
// di/cqrs.container.ts
export const cqrsContainer = new Container();

// Command side
cqrsContainer.register<ICommandBus>(
  'CommandBus',
  CommandBus
);

cqrsContainer.register<IEventStore>(
  'EventStore',
  CloudflareEventStore
);

// Command Handlers
cqrsContainer.register<ICommandHandler<CreateDocumentCommand>>(
  'CreateDocumentCommandHandler',
  CreateDocumentCommandHandler
);

// Query side
cqrsContainer.register<IQueryBus>(
  'QueryBus',
  QueryBus
);

cqrsContainer.register<IDocumentReadRepository>(
  'DocumentReadRepository',
  D1DocumentReadRepository
);

// Query Handlers
cqrsContainer.register<IQueryHandler<GetDocumentQuery, DocumentReadModel | null>>(
  'GetDocumentQueryHandler',
  GetDocumentQueryHandler
);

// Projections
cqrsContainer.register<IProjection>(
  'DocumentSearchProjection',
  DocumentSearchProjection
);

// Sagas
cqrsContainer.register<ISagaManager>(
  'SagaManager',
  SagaManager
);
```

### 2. Worker Entry Point

```typescript
// workers/cqrs/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const commandBus = cqrsContainer.get<ICommandBus>('CommandBus');
    const queryBus = cqrsContainer.get<IQueryBus>('QueryBus');

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/v1/commands')) {
        // Handle commands
        const command = await parseCommand(request);
        await commandBus.dispatch(command);
        
        return new Response(JSON.stringify({ success: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path.startsWith('/api/v1/queries')) {
        // Handle queries
        const query = await parseQuery(request);
        const result = await queryBus.dispatch(query);
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('Error processing request:', error);
      
      return new Response(JSON.stringify({
        error: error.message,
        requestId: generateRequestId()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const projectionManager = cqrsContainer.get<ProjectionManager>('ProjectionManager');
    const sagaManager = cqrsContainer.get<ISagaManager>('SagaManager');

    for (const message of batch.messages) {
      const event = JSON.parse(message.body) as DomainEvent;
      
      // Process projections
      await projectionManager.handleEvent(event);
      
      // Process sagas
      await sagaManager.handleEvent(event);
    }
  }
};
```

## Performance Optimization

### 1. Event Partitioning Strategy

```typescript
// Partition events by tenant and time
export class EventPartitioner {
  private static readonly PARTITIONS_PER_TENANT = 10;
  
  static getPartitionKey(event: DomainEvent): string {
    const tenantId = event.data.tenantId || 'default';
    const timestamp = event.occurredOn.getTime();
    const timePartition = Math.floor(timestamp / (24 * 60 * 60 * 1000)); // Daily
    const hash = this.simpleHash(tenantId);
    const partition = hash % this.PARTITIONS_PER_TENANT;
    
    return `${tenantId}:${timePartition}:${partition}`;
  }
  
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
```

### 2. Read Model Caching

```typescript
// Multi-level caching for read models
export class ReadModelCache {
  constructor(
    private readonly l1Cache: ICache, // Memory (500MB limit)
    private readonly l2Cache: ICache, // KV (1GB limit)
    private readonly l3Cache: ICache  // R2 (Unlimited)
  ) {}
  
  async get(key: string): Promise<any> {
    // Try L1 (memory) first
    let value = await this.l1Cache.get(key);
    if (value) return value;
    
    // Try L2 (KV)
    value = await this.l2Cache.get(key);
    if (value) {
      // Promote to L1
      await this.l1Cache.set(key, value, 60000); // 1 minute
      return value;
    }
    
    // Try L3 (R2)
    value = await this.l3Cache.get(key);
    if (value) {
      // Promote to L2 and L1
      await this.l2Cache.set(key, value, 3600000); // 1 hour
      await this.l1Cache.set(key, value, 60000);
      return value;
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl: number): Promise<void> {
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, 60000)),
      this.l2Cache.set(key, value, Math.min(ttl, 3600000)),
      this.l3Cache.set(key, value, ttl)
    ]);
  }
}
```

### 3. Batch Processing Optimization

```typescript
// Batch event processing
export class BatchEventProcessor {
  private readonly batchSize = 100;
  private readonly batchTimeout = 5000; // 5 seconds
  private currentBatch: DomainEvent[] = [];
  private batchTimer?: any;
  
  constructor(
    private readonly eventStore: IEventStore,
    private readonly projectionManager: ProjectionManager
  ) {}
  
  async addEvent(event: DomainEvent): Promise<void> {
    this.currentBatch.push(event);
    
    if (this.currentBatch.length >= this.batchSize) {
      await this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchTimeout);
    }
  }
  
  private async processBatch(): Promise<void> {
    if (this.currentBatch.length === 0) return;
    
    const batch = [...this.currentBatch];
    this.currentBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    // Process events in parallel
    await Promise.all(
      batch.map(event => this.projectionManager.handleEvent(event))
    );
  }
}
```

## Testing Strategy

### 1. Command Handler Tests

```typescript
// test/cqrs/CreateDocumentCommandHandler.spec.ts
describe('CreateDocumentCommandHandler', () => {
  let handler: CreateDocumentCommandHandler;
  let mockEventStore: jest.Mocked<IEventStore>;
  let mockRepository: jest.Mocked<IDocumentWriteRepository>;
  
  beforeEach(() => {
    mockEventStore = createMockEventStore();
    mockRepository = createMockDocumentRepository();
    
    handler = new CreateDocumentCommandHandler(
      mockRepository,
      mockEventStore,
      mockValidationService,
      mockFileStorage,
      mockDLPService
    );
  });
  
  it('should create document successfully', async () => {
    const command = new CreateDocumentCommand({
      aggregateId: 'doc-123',
      tenantId: 'tenant-123',
      title: 'Test Document',
      content: 'Test content',
      userId: 'user-123'
    });
    
    await handler.handle(command);
    
    expect(mockEventStore.saveEvents).toHaveBeenCalledWith(
      command.aggregateId,
      expect.any(Array),
      undefined
    );
    
    expect(mockRepository.save).toHaveBeenCalled();
  });
  
  it('should throw on validation failure', async () => {
    const command = new CreateDocumentCommand({
      aggregateId: 'doc-123',
      tenantId: 'tenant-123',
      title: '', // Invalid
      content: 'Test content',
      userId: 'user-123'
    });
    
    await expect(handler.handle(command))
      .rejects.toThrow(CommandValidationException);
  });
});
```

### 2. Query Handler Tests

```typescript
// test/cqrs/SearchDocumentsQueryHandler.spec.ts
describe('SearchDocumentsQueryHandler', () => {
  let handler: SearchDocumentsQueryHandler;
  let mockSearchIndex: jest.Mocked<ISearchIndex>;
  let mockRepository: jest.Mocked<IDocumentReadRepository>;
  
  beforeEach(() => {
    mockSearchIndex = createMockSearchIndex();
    mockRepository = createMockDocumentReadRepository();
    
    handler = new SearchDocumentsQueryHandler(
      mockSearchIndex,
      mockRepository,
      mockMetrics
    );
  });
  
  it('should return paginated results', async () => {
    const query = new SearchDocumentsQuery({
      queryId: 'q-123',
      tenantId: 'tenant-123',
      searchText: 'test',
      filters: {},
      pagination: { page: 1, pageSize: 10 }
    });
    
    mockSearchIndex.search.mockResolvedValue({
      ids: ['doc-1', 'doc-2'],
      total: 2,
      facets: {}
    });
    
    mockRepository.findByIds.mockResolvedValue([
      { id: 'doc-1', title: 'Doc 1' },
      { id: 'doc-2', title: 'Doc 2' }
    ]);
    
    const result = await handler.handle(query);
    
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
  });
});
```

### 3. Integration Tests

```typescript
// test/cqrs/CQRS.integration.spec.ts
describe('CQRS Integration', () => {
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let projectionManager: ProjectionManager;
  
  beforeAll(async () => {
    // Setup real infrastructure
    const eventStore = new CloudflareEventStore(r2, queue, metrics);
    const readRepository = new D1DocumentReadRepository(d1);
    
    commandBus = new CommandBus();
    queryBus = new QueryBus();
    projectionManager = new ProjectionManager(eventStore, checkpointStore);
    
    // Register handlers
    commandBus.register('CreateDocument', new CreateDocumentCommandHandler(...));
    queryBus.register('GetDocument', new GetDocumentQueryHandler(...));
    
    // Register projections
    await projectionManager.registerProjection(new DocumentSearchProjection(...));
    await projectionManager.start();
  });
  
  it('should process command and update query model', async () => {
    // Create document
    const command = new CreateDocumentCommand({
      aggregateId: 'doc-123',
      tenantId: 'tenant-123',
      title: 'Test Document',
      content: 'Test content',
      userId: 'user-123'
    });
    
    await commandBus.dispatch(command);
    
    // Wait for projection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Query document
    const query = new GetDocumentQuery({
      queryId: 'q-123',
      tenantId: 'tenant-123',
      documentId: 'doc-123'
    });
    
    const document = await queryBus.dispatch(query);
    
    expect(document).toBeDefined();
    expect(document.title).toBe('Test Document');
  });
});
```

## Migration Strategy

### Phase 1: Setup Event Store (Week 1)
1. Implement CloudflareEventStore with R2
2. Create event schema definitions
3. Setup event publishing queues
4. Implement snapshot mechanism

### Phase 2: Implement Command Side (Week 2-3)
1. Create command handlers
2. Implement aggregate roots
3. Setup command bus
4. Add validation

### Phase 3: Implement Query Side (Week 3-4)
1. Create read models
2. Implement query handlers
3. Setup read model database (D1)
4. Add caching layer

### Phase 4: Setup Projections (Week 4)
1. Create projection classes
2. Implement projection manager
3. Setup checkpoint store
4. Test event processing

### Phase 5: Add Sagas (Week 5)
1. Implement saga manager
2. Create saga definitions
3. Add compensation logic
4. Test failure scenarios

### Phase 6: Migration (Week 6-7)
1. Feature flag new CQRS implementation
2. Migrate one bounded context at a time
3. Verify data consistency
4. Switch traffic to new implementation

## Best Practices

1. **Keep aggregates small** - Limit to <100 events before snapshot
2. **Use event versioning** - Always version your events
3. **Idempotent handlers** - Ensure command handlers are idempotent
4. **Optimize read models** - Denormalize for query performance
5. **Monitor event lag** - Track projection processing delays
6. **Test compensation** - Verify saga compensation works
7. **Use correlation IDs** - Track requests across the system
8. **Implement retries** - Handle transient failures gracefully
9. **Log events** - Maintain audit trail of all events
10. **Regular cleanup** - Archive old events and snapshots