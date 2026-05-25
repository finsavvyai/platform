# Domain-Driven Design Implementation Guide

## Overview

This document provides the implementation guide for Domain-Driven Design (DDD) patterns in SDLC.ai, focusing on bounded contexts, aggregates, and domain services.

## Bounded Contexts Implementation

### 1. Identity & Access Context

```typescript
// contexts/identity-access/aggregate/User.ts
export class User extends AggregateRoot {
  private constructor(
    public readonly id: UserId,
    public readonly tenantId: TenantId,
    private email: Email,
    private password: PasswordHash,
    private role: UserRole,
    private permissions: Permission[],
    private status: UserStatus,
    private profile: UserProfile,
    public readonly createdAt: Date,
    private updatedAt: Date
  ) {
    super(id);
  }

  static create(data: CreateUserData): User {
    const user = new User(
      UserId.generate(),
      data.tenantId,
      Email.create(data.email),
      PasswordHash.create(data.password),
      data.role,
      data.permissions || [],
      UserStatus.ACTIVE,
      UserProfile.create(data.profile),
      new Date(),
      new Date()
    );

    user.addDomainEvent(
      new UserCreatedEvent({
        userId: user.id.value,
        tenantId: user.tenantId.value,
        email: user.email.value,
        role: user.role.value,
        createdAt: user.createdAt
      })
    );

    return user;
  }

  async changePassword(newPassword: string, currentPassword: string): Promise<void> {
    if (!await this.password.verify(currentPassword)) {
      throw new InvalidPasswordException();
    }

    this.password = PasswordHash.create(newPassword);
    this.updatedAt = new Date();

    this.addDomainEvent(
      new PasswordChangedEvent({
        userId: this.id.value,
        changedAt: new Date()
      })
    );
  }

  async enableMFA(secret: string, code: string): Promise<void> {
    if (!await TOTP.verify(secret, code)) {
      throw new InvalidMFACodeException();
    }

    this.mfaSecret = MFASecret.from(secret);
    this.mfaEnabled = true;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new MFAEnabledEvent({
        userId: this.id.value,
        enabledAt: new Date()
      })
    );
  }

  // Business rules
  canPerformAction(action: string, resource: string): boolean {
    return this.permissions.some(p => p.allows(action, resource));
  }

  isLocked(): boolean {
    return this.status === UserStatus.LOCKED || 
           (this.lockedUntil && this.lockedUntil > new Date());
  }

  // Value Objects
  private email: Email;
  private password: PasswordHash;
  private mfaSecret?: MFASecret;
  private lockedUntil?: Date;
}

// contexts/identity-access/value-objects/Email.ts
export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(email: string): Email {
    if (!this.isValid(email)) {
      throw new InvalidEmailException(email);
    }
    return new Email(email.toLowerCase().trim());
  }

  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  get domain(): string {
    return this.value.split('@')[1];
  }
}

// contexts/identity-access/services/AuthenticationService.ts
export class AuthenticationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenProvider: ITokenProvider,
    private readonly auditLogger: IAuditLogger
  ) {}

  async authenticate(credentials: LoginCredentials): Promise<AuthenticationResult> {
    // Load user
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      await this.handleFailedAuthentication(credentials.email, 'USER_NOT_FOUND');
      throw new AuthenticationFailedException();
    }

    // Check status
    if (user.isLocked()) {
      await this.auditLogger.log({
        eventType: 'AUTHENTICATION_BLOCKED',
        userId: user.id.value,
        reason: 'USER_LOCKED'
      });
      throw new AccountLockedException();
    }

    // Verify password
    if (!await user.verifyPassword(credentials.password)) {
      await this.handleFailedAuthentication(credentials.email, 'INVALID_PASSWORD');
      throw new AuthenticationFailedException();
    }

    // Check MFA
    if (user.mfaEnabled && !credentials.mfaToken) {
      return AuthenticationResult.requiresMFA(user.id);
    }

    if (user.mfaEnabled && credentials.mfaToken) {
      if (!await user.verifyMFAToken(credentials.mfaToken)) {
        throw new InvalidMFATokenException();
      }
    }

    // Generate tokens
    const tokens = await this.tokenProvider.generateTokens({
      userId: user.id.value,
      tenantId: user.tenantId.value,
      permissions: user.permissions,
      sessionId: SessionId.generate()
    });

    // Log successful authentication
    await this.auditLogger.log({
      eventType: 'AUTHENTICATION_SUCCESS',
      userId: user.id.value,
      tenantId: user.tenantId.value,
      sessionId: tokens.sessionId,
      ipAddress: credentials.ipAddress,
      userAgent: credentials.userAgent
    });

    return AuthenticationResult.success(tokens);
  }

  private async handleFailedAuthentication(email: string, reason: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (user) {
      await user.recordFailedLogin();
      await this.userRepository.save(user);
    }

    await this.auditLogger.log({
      eventType: 'AUTHENTICATION_FAILED',
      identifier: email,
      reason,
      timestamp: new Date()
    });
  }
}
```

### 2. Document Management Context

```typescript
// contexts/document-management/aggregate/Document.ts
export class Document extends AggregateRoot {
  private constructor(
    public readonly id: DocumentId,
    public readonly tenantId: TenantId,
    private title: DocumentTitle,
    private content: DocumentContent,
    private classification: SecurityClassification,
    private metadata: DocumentMetadata,
    private accessPolicy: AccessPolicy,
    private retentionPolicy: RetentionPolicy,
    private status: DocumentStatus,
    public readonly createdBy: UserId,
    public readonly createdAt: Date,
    private updatedAt: Date
  ) {
    super(id);
  }

  static create(data: CreateDocumentData): Document {
    // Business rules
    if (!data.content.isCompliantWith(data.classification)) {
      throw new DocumentContentNotCompliantException();
    }

    const document = new Document(
      DocumentId.generate(),
      data.tenantId,
      DocumentTitle.create(data.title),
      DocumentContent.create(data.content),
      data.classification,
      DocumentMetadata.create(data.metadata),
      AccessPolicy.create(data.accessPolicy || {}),
      RetentionPolicy.create(data.retentionPolicy || {}),
      DocumentStatus.DRAFT,
      data.createdBy,
      new Date(),
      new Date()
    );

    document.addDomainEvent(
      new DocumentCreatedEvent({
        documentId: document.id.value,
        tenantId: document.tenantId.value,
        title: document.title.value,
        classification: document.classification.value,
        createdBy: document.createdBy.value,
        createdAt: document.createdAt
      })
    );

    return document;
  }

  async classify(classification: SecurityClassification, classifiedBy: UserId): Promise<void> {
    if (!this.canBeClassifiedBy(classifiedBy)) {
      throw new InsufficientPermissionsException();
    }

    const oldClassification = this.classification;
    this.classification = classification;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DocumentClassifiedEvent({
        documentId: this.id.value,
        oldClassification: oldClassification.value,
        newClassification: classification.value,
        classifiedBy: classifiedBy.value,
        classifiedAt: new Date()
      })
    );
  }

  grantAccess(user: UserId, permissions: DocumentPermission[], grantedBy: UserId): void {
    if (!this.canManageAccess(grantedBy)) {
      throw new InsufficientPermissionsException();
    }

    this.accessPolicy.grantAccess(user, permissions);

    this.addDomainEvent(
      new DocumentAccessGrantedEvent({
        documentId: this.id.value,
        userId: user.value,
        permissions: permissions.map(p => p.value),
        grantedBy: grantedBy.value,
        grantedAt: new Date()
      })
    );
  }

  // Business rules
  canBeAccessedBy(user: UserId, permission: DocumentPermission): boolean {
    return this.accessPolicy.allows(user, permission);
  }

  canBeClassifiedBy(user: UserId): boolean {
    // Implement business logic for classification authority
    return true; // Simplified
  }

  canManageAccess(user: UserId): boolean {
    return this.createdBy.equals(user) || this.isOwner(user);
  }

  isExpired(): boolean {
    return this.retentionPolicy.isExpired(this.createdAt);
  }
}

// contexts/document-management/services/DocumentProcessingService.ts
export class DocumentProcessingService {
  constructor(
    private readonly documentRepository: IDocumentRepository,
    private readonly classificationService: IClassificationService,
    private readonly indexingService: IIndexingService,
    private readonly encryptionService: IEncryptionService,
    private readonly auditLogger: IAuditLogger
  ) {}

  async process(documentId: DocumentId): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new DocumentNotFoundException(documentId);
    }

    try {
      // Step 1: Classify content
      const classification = await this.classificationService.classify(
        document.content.value
      );
      
      await document.classify(classification, UserId.system());

      // Step 2: Encrypt if confidential
      if (classification.isConfidential()) {
        const encryptedContent = await this.encryptionService.encrypt(
          document.content.value
        );
        
        document.updateContent(
          DocumentContent.encrypted(encryptedContent)
        );
      }

      // Step 3: Index for search
      await this.indexingService.index({
        id: document.id.value,
        tenantId: document.tenantId.value,
        title: document.title.value,
        content: document.content.searchable(),
        classification: classification.value,
        tags: document.metadata.tags
      });

      // Step 4: Mark as processed
      document.markAsProcessed();

      await this.documentRepository.save(document);

    } catch (error) {
      document.markAsFailed(error.message);
      await this.documentRepository.save(document);
      throw error;
    }
  }
}
```

### 3. Knowledge Retrieval Context (RAG)

```typescript
// contexts/knowledge-retrieval/aggregate/KnowledgeBase.ts
export class KnowledgeBase extends AggregateRoot {
  private constructor(
    public readonly id: KnowledgeBaseId,
    public readonly tenantId: TenantId,
    private name: KnowledgeBaseName,
    private documents: DocumentReference[],
    private embeddings: Embedding[],
    private index: VectorIndex,
    private settings: KnowledgeBaseSettings,
    public readonly createdAt: Date,
    private updatedAt: Date
  ) {
    super(id);
  }

  static create(data: CreateKnowledgeBaseData): KnowledgeBase {
    const knowledgeBase = new KnowledgeBase(
      KnowledgeBaseId.generate(),
      data.tenantId,
      KnowledgeBaseName.create(data.name),
      [],
      [],
      VectorIndex.create(data.vectorSettings),
      KnowledgeBaseSettings.create(data.settings),
      new Date(),
      new Date()
    );

    knowledgeBase.addDomainEvent(
      new KnowledgeBaseCreatedEvent({
        knowledgeBaseId: knowledgeBase.id.value,
        tenantId: knowledgeBase.tenantId.value,
        name: knowledgeBase.name.value,
        createdAt: knowledgeBase.createdAt
      })
    );

    return knowledgeBase;
  }

  async addDocument(document: DocumentReference, embedding: Embedding): Promise<void> {
    // Add to knowledge base
    this.documents.push(document);
    this.embeddings.push(embedding);

    // Update vector index
    await this.index.addVector(embedding);

    this.updatedAt = new Date();

    this.addDomainEvent(
      new DocumentAddedToKnowledgeBaseEvent({
        knowledgeBaseId: this.id.value,
        documentId: document.id,
        embeddingId: embedding.id,
        addedAt: new Date()
      })
    );
  }

  async search(query: SearchQuery, userId: UserId): Promise<SearchResult[]> {
    // Check permissions
    if (!this.settings.canBeSearchedBy(userId)) {
      throw new InsufficientPermissionsException();
    }

    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query.text);

    // Search vector index
    const similarDocuments = await this.index.search(
      queryEmbedding,
      query.maxResults || 10,
      query.minSimilarity || 0.7
    );

    // Apply access control
    const accessibleDocuments = await this.filterAccessibleDocuments(
      similarDocuments,
      userId
    );

    // Convert to search results
    return accessibleDocuments.map(doc => ({
      documentId: doc.documentId,
      title: doc.title,
      content: doc.content,
      score: doc.similarity,
      metadata: doc.metadata
    }));
  }

  private async filterAccessibleDocuments(
    documents: VectorSearchResult[],
    userId: UserId
  ): Promise<VectorSearchResult[]> {
    // Implement access control logic
    return documents; // Simplified
  }
}

// contexts/knowledge-retrieval/services/RAGService.ts
export class RAGService {
  constructor(
    private readonly knowledgeBaseRepository: IKnowledgeBaseRepository,
    private readonly embeddingService: IEmbeddingService,
    private readonly llmService: ILLMService,
    private readonly dlpService: IDLPService,
    private readonly auditLogger: IAuditLogger
  ) {}

  async query(request: RAGQuery): Promise<RAGResponse> {
    // Load knowledge base
    const knowledgeBase = await this.knowledgeBaseRepository.findById(
      request.knowledgeBaseId
    );
    
    if (!knowledgeBase) {
      throw new KnowledgeBaseNotFoundException(request.knowledgeBaseId);
    }

    try {
      // Step 1: Search for relevant documents
      const searchResults = await knowledgeBase.search(
        SearchQuery.create(request.query),
        request.userId
      );

      // Step 2: Retrieve and process documents
      const contexts = await this.processSearchResults(searchResults);

      // Step 3: Apply DLP filtering
      const filteredContexts = await this.dlpService.filter(contexts);

      // Step 4: Generate response
      const response = await this.llmService.generateResponse({
        query: request.query,
        contexts: filteredContexts,
        conversationHistory: request.conversationHistory,
        parameters: request.parameters
      });

      // Step 5: Log query
      await this.auditLogger.log({
        eventType: 'RAG_QUERY_EXECUTED',
        knowledgeBaseId: knowledgeBase.id.value,
        userId: request.userId.value,
        query: request.query,
        resultCount: searchResults.length,
        responseId: response.id,
        timestamp: new Date()
      });

      return RAGResponse.create({
        id: ResponseId.generate(),
        answer: response.answer,
        sources: response.sources,
        contexts: filteredContexts,
        metadata: response.metadata
      });

    } catch (error) {
      await this.auditLogger.log({
        eventType: 'RAG_QUERY_FAILED',
        knowledgeBaseId: knowledgeBase.id.value,
        userId: request.userId.value,
        query: request.query,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  private async processSearchResults(
    results: SearchResult[]
  ): Promise<DocumentContext[]> {
    const contexts: DocumentContext[] = [];

    for (const result of results) {
      // Retrieve full document
      const document = await this.documentRepository.findById(result.documentId);
      
      if (document) {
        // Extract relevant passages
        const passages = await this.extractRelevantPassages(
          document.content,
          result.score
        );

        contexts.push({
          documentId: document.id,
          title: document.title,
          passages,
          metadata: document.metadata
        });
      }
    }

    return contexts;
  }
}
```

## Context Mapping

```typescript
// contexts/ContextMap.ts
export class ContextMap {
  private static readonly mappings: Map<string, ContextMapping> = new Map([
    [
      'IdentityAccess',
      {
        upstreamContexts: ['DocumentManagement', 'PaymentProcessing'],
        downstreamContexts: ['ComplianceGovernance'],
        sharedKernel: ['Tenant', 'User', 'Permission', 'Session'],
        relationships: {
          DocumentManagement: CustomerSupplier,
          PaymentProcessing: CustomerSupplier,
          ComplianceGovernance: Conformist
        }
      }
    ],
    [
      'DocumentManagement',
      {
        upstreamContexts: ['IdentityAccess'],
        downstreamContexts: ['KnowledgeRetrieval', 'AIInteraction'],
        sharedKernel: ['Document', 'Classification', 'AccessControl'],
        relationships: {
          IdentityAccess: CustomerSupplier,
          KnowledgeRetrieval: PublishedLanguage,
          AIInteraction: CustomerSupplier
        }
      }
    ],
    [
      'PaymentProcessing',
      {
        upstreamContexts: ['IdentityAccess'],
        downstreamContexts: ['BillingSubscription'],
        sharedKernel: ['Payment', 'Transaction', 'CardToken'],
        relationships: {
          IdentityAccess: CustomerSupplier,
          BillingSubscription: CustomerSupplier
        },
        antiCorruptionLayer: new PaymentGatewayACL()
      }
    ]
  ]);

  static getMapping(contextName: string): ContextMapping | undefined {
    return this.mappings.get(contextName);
  }

  static getSharedKernel(context1: string, context2: string): string[] {
    const mapping1 = this.getMapping(context1);
    const mapping2 = this.getMapping(context2);
    
    if (!mapping1 || !mapping2) return [];
    
    return mapping1.sharedKernel.filter(item => 
      mapping2.sharedKernel.includes(item)
    );
  }
}

// Integration Patterns
export enum ContextRelationship {
  CustomerSupplier = 'Customer-Supplier',
  Conformist = 'Conformist',
  PublishedLanguage = 'Published Language',
  Partnership = 'Partnership',
  SharedKernel = 'Shared Kernel',
  OpenHostService = 'Open Host Service'
}

// Anti-Corruption Layer Example
export class PaymentGatewayACL implements IAntiCorruptionLayer {
  translateFromExternal(external: PaymentGatewayResponse): Payment {
    return {
      id: this.generateInternalId(external.transactionId),
      amount: this.convertAmount(external.amount),
      currency: external.currency,
      status: this.mapStatus(external.gatewayStatus),
      // Never store raw card data
      cardToken: external.cardToken,
      metadata: this.sanitizeMetadata(external.metadata)
    };
  }

  translateToExternal(payment: Payment): PaymentGatewayRequest {
    return {
      merchantId: this.config.merchantId,
      amount: this.convertToCents(payment.amount),
      currency: payment.currency,
      token: payment.cardToken,
      // Add security headers
      securityHeaders: this.generateSecurityHeaders()
    };
  }
}
```

## Implementation Steps

### Step 1: Create Bounded Context Structure
```bash
mkdir -p src/contexts/{identity-access,document-management,knowledge-retrieval,payment-processing,billing-subscription,compliance-governance}
cd src/contexts/identity-access
mkdir -p {aggregate,value-object,domain-service,repository,application}
```

### Step 2: Define Shared Kernel
```typescript
// shared-kernel/DomainEvents.ts
export abstract class DomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;
  public readonly aggregateId: string;
  public readonly version: number;

  constructor(data: DomainEventData) {
    this.eventId = data.eventId || generateId();
    this.occurredOn = new Date();
    this.aggregateId = data.aggregateId;
    this.version = data.version || 1;
  }

  abstract getEventType(): string;
}

// shared-kernel/ValueObject.ts
export abstract class ValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
    this.validate();
  }

  protected abstract validate(): void;

  equals(other: ValueObject<T>): boolean {
    return this.value === other.value;
  }

  toJSON(): T {
    return this.value;
  }
}

// shared-kernel/AggregateRoot.ts
export abstract class AggregateRoot {
  private readonly domainEvents: DomainEvent[] = [];

  constructor(public readonly id: string) {}

  addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents.length = 0;
  }

  public getVersion(): number {
    return this.domainEvents.length;
  }
}
```

### Step 3: Implement Repository Interfaces
```typescript
// contexts/identity-access/repository/IUserRepository.ts
export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findByTenantId(tenantId: TenantId): Promise<User[]>;
  delete(id: UserId): Promise<void>;
  existsByEmail(email: Email): Promise<boolean>;
}
```

### Step 4: Create Application Services
```typescript
// contexts/identity-access/application/UserApplicationService.ts
export class UserApplicationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userDomainService: UserDomainService,
    private readonly eventBus: IEventBus
  ) {}

  async createUser(command: CreateUserCommand): Promise<UserDto> {
    // Business validation
    await this.userDomainService.validateUserData(command);

    // Create aggregate
    const user = User.create({
      tenantId: TenantId.create(command.tenantId),
      email: command.email,
      password: command.password,
      role: UserRole.from(command.role),
      permissions: command.permissions?.map(p => Permission.from(p)),
      profile: command.profile
    });

    // Persist
    await this.userRepository.save(user);

    // Publish events
    await this.eventBus.publish(user.getDomainEvents());

    // Return DTO
    return UserDto.fromDomain(user);
  }

  async updateUser(command: UpdateUserCommand): Promise<UserDto> {
    const user = await this.userRepository.findById(UserId.create(command.userId));
    if (!user) {
      throw new UserNotFoundException(command.userId);
    }

    // Apply updates
    user.update({
      profile: command.profile,
      permissions: command.permissions?.map(p => Permission.from(p))
    });

    // Persist
    await this.userRepository.save(user);

    // Publish events
    await this.eventBus.publish(user.getDomainEvents());

    return UserDto.fromDomain(user);
  }
}
```

### Step 5: Configure Dependency Injection
```typescript
// di/identity-access.container.ts
export const identityAccessContainer = new Container();

// Repositories
identityAccessContainer.register<IUserRepository>(
  'UserRepository',
  PostgresUserRepository
);

// Domain Services
identityAccessContainer.register<IAuthenticationService>(
  'AuthenticationService',
  AuthenticationService
);

// Application Services
identityAccessContainer.register<IUserApplicationService>(
  'UserApplicationService',
  UserApplicationService
);

// Events
identityAccessContainer.register<IEventHandler<UserCreatedEvent>>(
  'UserCreatedEventHandler',
  UserCreatedEventHandler
);
```

## Testing Strategy

### Unit Tests for Aggregates
```typescript
// test/identity-access/User.spec.ts
describe('User', () => {
  it('should create a valid user', () => {
    const userData = {
      tenantId: 'tenant-123',
      email: 'test@example.com',
      password: 'SecurePass123!',
      role: 'user'
    };

    const user = User.create(userData);

    expect(user.id).toBeDefined();
    expect(user.email.value).toBe('test@example.com');
    expect(user.getDomainEvents()).toHaveLength(1);
    expect(user.getDomainEvents()[0]).toBeInstanceOf(UserCreatedEvent);
  });

  it('should fail to create user with invalid email', () => {
    const userData = {
      tenantId: 'tenant-123',
      email: 'invalid-email',
      password: 'SecurePass123!',
      role: 'user'
    };

    expect(() => User.create(userData)).toThrow(InvalidEmailException);
  });
});
```

### Integration Tests
```typescript
// test/identity-access/AuthenticationService.integration.spec.ts
describe('AuthenticationService Integration', () => {
  let service: AuthenticationService;
  let userRepository: IUserRepository;

  beforeEach(async () => {
    userRepository = new TestUserRepository();
    service = new AuthenticationService(
      userRepository,
      new BCryptPasswordHasher(),
      new JWTTokenProvider(),
      new AuditLogger()
    );
  });

  it('should authenticate user with valid credentials', async () => {
    const user = User.create({
      tenantId: 'tenant-123',
      email: 'test@example.com',
      password: 'SecurePass123!',
      role: 'user'
    });
    
    await userRepository.save(user);

    const result = await service.authenticate({
      email: 'test@example.com',
      password: 'SecurePass123!',
      ipAddress: '127.0.0.1',
      userAgent: 'test'
    });

    expect(result.success).toBe(true);
    expect(result.tokens).toBeDefined();
  });
});
```

## Migration Strategy

1. **Phase 1**: Create new bounded contexts alongside existing code
2. **Phase 2**: Implement anti-corruption layers for integrations
3. **Phase 3**: Migrate features one by one to new contexts
4. **Phase 4**: Remove old implementation
5. **Phase 5**: Optimize based on learnings

## Best Practices

1. **Keep contexts small and focused**
2. **Use ubiquitous language consistently**
3. **Implement rich domain models**
4. **Avoid anemic domain models**
5. **Use events for cross-context communication**
6. **Test domain logic thoroughly**
7. **Keep aggregates small**
8. **Use value objects for domain concepts**
9. **Implement proper access control**
10. **Document context boundaries clearly**