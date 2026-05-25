package parser

// Test data fixtures for parser testing

// Simple OpenAPI 3.0 specification
const SimpleOpenAPISpec = `{
	"openapi": "3.0.0",
	"info": {
		"title": "Simple Pet Store API",
		"version": "1.0.0",
		"description": "A simple API for managing pets",
		"contact": {
			"name": "API Support",
			"email": "support@example.com"
		},
		"license": {
			"name": "MIT"
		}
	},
	"servers": [
		{
			"url": "https://api.example.com/v1",
			"description": "Production server"
		},
		{
			"url": "https://staging-api.example.com/v1",
			"description": "Staging server"
		}
	],
	"paths": {
		"/pets": {
			"get": {
				"summary": "List all pets",
				"description": "Get a list of all pets",
				"operationId": "listPets",
				"tags": ["pets"],
				"parameters": [
					{
						"name": "limit",
						"in": "query",
						"description": "How many items to return at one time (max 100)",
						"required": false,
						"schema": {
							"type": "integer",
							"maximum": 100,
							"format": "int32"
						}
					}
				],
				"responses": {
					"200": {
						"description": "A paged array of pets",
						"headers": {
							"x-next": {
								"description": "A link to the next page of responses",
								"schema": {
									"type": "string"
								}
							}
						},
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/Pets"
								}
							}
						}
					}
				}
			},
			"post": {
				"summary": "Create a pet",
				"description": "Create a new pet in the store",
				"operationId": "createPet",
				"tags": ["pets"],
				"requestBody": {
					"description": "Pet to add to the store",
					"required": true,
					"content": {
						"application/json": {
							"schema": {
								"$ref": "#/components/schemas/Pet"
							}
						}
					}
				},
				"responses": {
					"201": {
						"description": "Pet created successfully",
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/Pet"
								}
							}
						}
					},
					"400": {
						"description": "Invalid input"
					}
				}
			}
		},
		"/pets/{petId}": {
			"get": {
				"summary": "Info for a specific pet",
				"description": "Get details of a specific pet",
				"operationId": "showPetById",
				"tags": ["pets"],
				"parameters": [
					{
						"name": "petId",
						"in": "path",
						"required": true,
						"description": "The id of the pet to retrieve",
						"schema": {
							"type": "string"
						}
					}
				],
				"responses": {
					"200": {
						"description": "Expected response to a valid request",
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/Pet"
								}
							}
						}
					},
					"404": {
						"description": "Pet not found"
					}
				}
			},
			"delete": {
				"summary": "Delete a pet",
				"description": "Delete a specific pet",
				"operationId": "deletePet",
				"tags": ["pets"],
				"parameters": [
					{
						"name": "petId",
						"in": "path",
						"required": true,
						"description": "The id of the pet to delete",
						"schema": {
							"type": "string"
						}
					}
				],
				"responses": {
					"204": {
						"description": "Pet deleted successfully"
					},
					"404": {
						"description": "Pet not found"
					}
				}
			}
		}
	},
	"components": {
		"schemas": {
			"Pet": {
				"type": "object",
				"required": ["id", "name"],
				"properties": {
					"id": {
						"type": "integer",
						"format": "int64"
					},
					"name": {
						"type": "string"
					},
					"tag": {
						"type": "string"
					},
					"status": {
						"type": "string",
						"enum": ["available", "pending", "sold"]
					}
				}
			},
			"Pets": {
				"type": "array",
				"items": {
					"$ref": "#/components/schemas/Pet"
				}
			},
			"Error": {
				"type": "object",
				"required": ["code", "message"],
				"properties": {
					"code": {
						"type": "integer",
						"format": "int32"
					},
					"message": {
						"type": "string"
					}
				}
			}
		},
		"securitySchemes": {
			"api_key": {
				"type": "apiKey",
				"name": "api_key",
				"in": "header"
			}
		}
	},
	"security": [
		{
			"api_key": []
		}
	]
}`

// Simple GraphQL schema
const SimpleGraphQLSchema = `
	"""
	GraphQL schema for a simple pet management system
	"""
	type Query {
		"""
		Get all pets with optional filtering
		"""
		pets(limit: Int = 10, offset: Int = 0, status: PetStatus): [Pet]

		"""
		Get a specific pet by ID
		"""
		pet(id: ID!): Pet

		"""
		Get all owners
		"""
		owners: [Owner]

		"""
		Get a specific owner by ID
		"""
		owner(id: ID!): Owner
	}

	"""
	Mutation type for modifying data
	"""
	type Mutation {
		"""
		Create a new pet
		"""
		createPet(input: CreatePetInput!): Pet

		"""
		Update an existing pet
		"""
		updatePet(id: ID!, input: UpdatePetInput!): Pet

		"""
		Delete a pet
		"""
		deletePet(id: ID!): Boolean

		"""
		Create a new owner
		"""
		createOwner(input: CreateOwnerInput!): Owner
	}

	"""
	Subscription type for real-time updates
	"""
	type Subscription {
		"""
		Get notified when pets are added or updated
		"""
		petUpdated: Pet

		"""
		Get notified when pets are adopted
		"""
		petAdopted: Pet
	}

	"""
	Pet type representing a pet in the system
	"""
	type Pet {
		"""
		Unique identifier for the pet
		"""
		id: ID!

		"""
		Name of the pet
		"""
		name: String!

		"""
		Species of the pet
		"""
		species: String!

		"""
		Breed of the pet
		"""
		breed: String

		"""
		Age of the pet in years
		"""
		age: Int

		"""
		Current status of the pet
		"""
		status: PetStatus!

		"""
		Owner of the pet (if any)
		"""
		owner: Owner

		"""
		Date when the pet was added to the system
		"""
		createdAt: String

		"""
		Date when the pet was last updated
		"""
		updatedAt: String
	}

	"""
	Owner type representing a pet owner
	"""
	type Owner {
		"""
		Unique identifier for the owner
		"""
		id: ID!

		"""
		Full name of the owner
		"""
		name: String!

		"""
		Email address of the owner
		"""
		email: String!

		"""
		Phone number of the owner
		"""
		phone: String

		"""
		Address of the owner
		"""
		address: String

		"""
		List of pets owned by this person
		"""
		pets: [Pet]

		"""
		Date when the owner was registered
		"""
		registeredAt: String
	}

	"""
	Enumeration of possible pet statuses
	"""
	enum PetStatus {
		AVAILABLE
		PENDING
		SOLD
		ADOPTED
	}

	"""
	Input type for creating a new pet
	"""
	input CreatePetInput {
		name: String!
		species: String!
		breed: String
		age: Int
		status: PetStatus = AVAILABLE
		ownerId: ID
	}

	"""
	Input type for updating an existing pet
	"""
	input UpdatePetInput {
		name: String
		species: String
		breed: String
		age: Int
		status: PetStatus
		ownerId: ID
	}

	"""
	Input type for creating a new owner
	"""
	input CreateOwnerInput {
		name: String!
		email: String!
		phone: String
		address: String
	}
`

// Simple Postman collection
const SimplePostmanCollection = `{
	"info": {
		"_postman_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		"name": "Pet Store API Collection",
		"description": "A collection of requests for the Pet Store API",
		"version": {
			"major": 1,
			"minor": 0,
			"patch": 0
		},
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"auth": {
		"type": "apikey",
		"apikey": [
			{
				"key": "api_key",
				"value": "{{api_key}}",
				"type": "string"
			}
		]
	},
	"event": [
		{
			"listen": "prerequest",
			"script": {
				"type": "text/javascript",
				"exec": [
					"// Set default headers",
					"if (!pm.request.headers.has('Content-Type')) {",
					"    pm.request.headers.add({",
					"        key: 'Content-Type',",
					"        value: 'application/json'",
					"    });",
					"}"
				]
			}
		},
		{
			"listen": "test",
			"script": {
				"type": "text/javascript",
				"exec": [
					"// Basic response validation",
					"pm.test('Status code is 200', function () {",
					"    pm.response.to.have.status(200);",
					"});"
				]
			}
		}
	],
	"variable": [
		{
			"key": "base_url",
			"value": "https://api.example.com/v1",
			"type": "string"
		},
		{
			"key": "api_key",
			"value": "your-api-key-here",
			"type": "string"
		}
	],
	"item": [
		{
			"name": "Pets",
			"item": [
				{
					"name": "List All Pets",
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Response has pets array', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('pets');",
									"    pm.expect(jsonData.pets).to.be.an('array');",
									"});"
								]
							}
						}
					],
					"request": {
						"method": "GET",
						"header": [
							{
								"key": "Accept",
								"value": "application/json",
								"type": "text"
							}
						],
						"url": {
							"raw": "{{base_url}}/pets?limit=10",
							"host": ["{{base_url}}"],
							"path": ["pets"],
							"query": [
								{
									"key": "limit",
									"value": "10",
									"description": "Number of pets to return"
								}
							]
						},
						"description": "Get a list of all pets with optional filtering"
					},
					"response": []
				},
				{
					"name": "Create New Pet",
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Pet created successfully', function () {",
									"    pm.response.to.have.status(201);",
									"});",
									"",
									"pm.test('Response contains pet data', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('id');",
									"    pm.expect(jsonData).to.have.property('name');",
									"});"
								]
							}
						}
					],
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"name\": \"Fluffy\",\n  \"species\": \"Cat\",\n  \"breed\": \"Persian\",\n  \"age\": 3,\n  \"status\": \"available\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/pets",
							"host": ["{{base_url}}"],
							"path": ["pets"]
						},
						"description": "Create a new pet in the system"
					},
					"response": []
				},
				{
					"name": "Get Pet by ID",
					"event": [
						{
							"listen": "prerequest",
							"script": {
								"type": "text/javascript",
								"exec": [
									"// Use a default pet ID if none provided",
									"if (!pm.variables.get('pet_id')) {",
									"    pm.variables.set('pet_id', '1');",
									"}"
								]
							}
						},
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Pet retrieved successfully', function () {",
									"    pm.response.to.have.status(200);",
									"});",
									"",
									"pm.test('Response contains correct pet ID', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData.id).to.eql(pm.variables.get('pet_id'));",
									"});"
								]
							}
						}
					],
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/pets/{{pet_id}}",
							"host": ["{{base_url}}"],
							"path": ["pets", "{{pet_id}}"]
						},
						"description": "Get details of a specific pet by ID"
					},
					"response": []
				},
				{
					"name": "Delete Pet",
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Pet deleted successfully', function () {",
									"    pm.response.to.have.status(204);",
									"});"
								]
							}
						}
					],
					"request": {
						"method": "DELETE",
						"header": [],
						"url": {
							"raw": "{{base_url}}/pets/{{pet_id}}",
							"host": ["{{base_url}}"],
							"path": ["pets", "{{pet_id}}"]
						},
						"description": "Delete a specific pet by ID"
					},
					"response": []
				}
			]
		},
		{
			"name": "Owners",
			"item": [
				{
					"name": "List All Owners",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/owners",
							"host": ["{{base_url}}"],
							"path": ["owners"]
						},
						"description": "Get a list of all pet owners"
					},
					"response": []
				},
				{
					"name": "Create New Owner",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"name\": \"John Doe\",\n  \"email\": \"john@example.com\",\n  \"phone\": \"+1234567890\",\n  \"address\": \"123 Main St, City, State\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/owners",
							"host": ["{{base_url}}"],
							"path": ["owners"]
						},
						"description": "Create a new pet owner in the system"
					},
					"response": []
				}
			]
		}
	]
}`

// Complex OpenAPI specification with advanced features
const ComplexOpenAPISpec = `{
	"openapi": "3.0.3",
	"info": {
		"title": "Advanced E-commerce API",
		"version": "2.1.0",
		"description": "A comprehensive e-commerce API with advanced features including webhooks, pagination, filtering, and complex data relationships",
		"termsOfService": "https://example.com/terms",
		"contact": {
			"name": "API Team",
			"url": "https://example.com/contact",
			"email": "api@example.com"
		},
		"license": {
			"name": "Apache 2.0",
			"url": "https://www.apache.org/licenses/LICENSE-2.0.html"
		}
	},
	"servers": [
		{
			"url": "https://api.example.com/v2",
			"description": "Production server"
		},
		{
			"url": "https://staging-api.example.com/v2",
			"description": "Staging server"
		},
		{
			"url": "https://dev-api.example.com/v2",
			"description": "Development server"
		}
	],
	"paths": {
		"/products": {
			"get": {
				"summary": "List products with advanced filtering",
				"description": "Retrieve a paginated list of products with support for complex filtering, sorting, and field selection",
				"operationId": "listProducts",
				"tags": ["Products"],
				"parameters": [
					{
						"name": "page",
						"in": "query",
						"description": "Page number for pagination",
						"schema": {
							"type": "integer",
							"minimum": 1,
							"default": 1
						}
					},
					{
						"name": "limit",
						"in": "query",
						"description": "Number of items per page",
						"schema": {
							"type": "integer",
							"minimum": 1,
							"maximum": 100,
							"default": 20
						}
					},
					{
						"name": "category",
						"in": "query",
						"description": "Filter by category ID",
						"schema": {
							"type": "string"
						}
					},
					{
						"name": "min_price",
						"in": "query",
						"description": "Minimum price filter",
						"schema": {
							"type": "number",
							"minimum": 0
						}
					},
					{
						"name": "max_price",
						"in": "query",
						"description": "Maximum price filter",
						"schema": {
							"type": "number",
							"minimum": 0
						}
					},
					{
						"name": "sort",
						"in": "query",
						"description": "Sort field",
						"schema": {
							"type": "string",
							"enum": ["name", "price", "created_at", "updated_at"]
						}
					},
					{
						"name": "order",
						"in": "query",
						"description": "Sort order",
						"schema": {
							"type": "string",
							"enum": ["asc", "desc"],
							"default": "asc"
						}
					},
					{
						"name": "fields",
						"in": "query",
						"description": "Comma-separated list of fields to include",
						"schema": {
							"type": "string"
						}
					}
				],
				"responses": {
					"200": {
						"description": "Successful response",
						"content": {
							"application/json": {
								"schema": {
									"type": "object",
									"properties": {
										"data": {
											"type": "array",
											"items": {
												"$ref": "#/components/schemas/Product"
											}
										},
										"pagination": {
											"$ref": "#/components/schemas/Pagination"
										},
										"filters": {
											"$ref": "#/components/schemas/FilterInfo"
										}
									}
								}
							}
						}
					}
				}
			},
			"post": {
				"summary": "Create a new product",
				"description": "Create a new product with support for variants, images, and metadata",
				"operationId": "createProduct",
				"tags": ["Products"],
				"requestBody": {
					"required": true,
					"content": {
						"application/json": {
							"schema": {
								"$ref": "#/components/schemas/CreateProductRequest"
							}
						}
					}
				},
				"responses": {
					"201": {
						"description": "Product created successfully",
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/Product"
								}
							}
						}
					}
				}
			}
		},
		"/products/{id}": {
			"get": {
				"summary": "Get product details",
				"operationId": "getProduct",
				"tags": ["Products"],
				"parameters": [
					{
						"name": "id",
						"in": "path",
						"required": true,
						"schema": {
							"type": "string"
						}
					},
					{
						"name": "include",
						"in": "query",
						"description": "Include related resources",
						"schema": {
							"type": "array",
							"items": {
								"type": "string",
								"enum": ["variants", "reviews", "categories"]
							}
						}
					}
				],
				"responses": {
					"200": {
						"description": "Product details",
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/ProductDetail"
								}
							}
						}
					}
				}
			}
		},
		"/webhooks": {
			"post": {
				"summary": "Register webhook",
				"description": "Register a webhook URL to receive real-time notifications",
				"operationId": "registerWebhook",
				"tags": ["Webhooks"],
				"requestBody": {
					"required": true,
					"content": {
						"application/json": {
							"schema": {
								"$ref": "#/components/schemas/WebhookRegistration"
							}
						}
					}
				},
				"responses": {
					"201": {
						"description": "Webhook registered successfully",
						"content": {
							"application/json": {
								"schema": {
									"$ref": "#/components/schemas/Webhook"
								}
							}
						}
					}
				}
			}
		}
	},
	"components": {
		"schemas": {
			"Product": {
				"type": "object",
				"required": ["id", "name", "price"],
				"properties": {
					"id": {
						"type": "string",
						"format": "uuid"
					},
					"name": {
						"type": "string",
						"maxLength": 255
					},
					"description": {
						"type": "string"
					},
					"price": {
						"type": "number",
						"minimum": 0
					},
					"currency": {
						"type": "string",
						"pattern": "^[A-Z]{3}$"
					},
					"category_id": {
						"type": "string",
						"format": "uuid"
					},
					"status": {
						"type": "string",
						"enum": ["active", "inactive", "draft"]
					},
					"created_at": {
						"type": "string",
						"format": "date-time"
					},
					"updated_at": {
						"type": "string",
						"format": "date-time"
					}
				}
			},
			"ProductDetail": {
				"allOf": [
					{
						"$ref": "#/components/schemas/Product"
					},
					{
						"type": "object",
						"properties": {
							"variants": {
								"type": "array",
								"items": {
									"$ref": "#/components/schemas/ProductVariant"
								}
							},
							"reviews": {
								"type": "array",
								"items": {
									"$ref": "#/components/schemas/Review"
								}
							},
							"images": {
								"type": "array",
								"items": {
									"$ref": "#/components/schemas/ProductImage"
								}
							}
						}
					}
				]
			},
			"Pagination": {
				"type": "object",
				"required": ["total", "page", "limit", "pages"],
				"properties": {
					"total": {
						"type": "integer",
						"description": "Total number of items"
					},
					"page": {
						"type": "integer",
						"description": "Current page number"
					},
					"limit": {
						"type": "integer",
						"description": "Items per page"
					},
					"pages": {
						"type": "integer",
						"description": "Total number of pages"
					},
					"has_next": {
						"type": "boolean",
						"description": "Whether there is a next page"
					},
					"has_prev": {
						"type": "boolean",
						"description": "Whether there is a previous page"
					}
				}
			},
			"FilterInfo": {
				"type": "object",
				"properties": {
					"applied_filters": {
						"type": "array",
						"items": {
							"type": "object",
							"properties": {
								"field": {"type": "string"},
								"operator": {"type": "string"},
								"value": {}
							}
						}
					},
					"available_filters": {
						"type": "array",
						"items": {
							"type": "object",
							"properties": {
								"field": {"type": "string"},
								"type": {"type": "string"},
								"label": {"type": "string"}
							}
						}
					}
				}
			}
		}
	}
}`

// Complex GraphQL schema with advanced features
const ComplexGraphQLSchema = `
	"""
	Advanced e-commerce GraphQL schema with subscriptions, unions, and complex relationships
	"""
	schema {
		query: Query
		mutation: Mutation
		subscription: Subscription
	}

	"""
	Query root for e-commerce operations
	"""
	type Query {
		"""
		Search products with advanced filtering
		"""
		products(
			filter: ProductFilter
			sort: ProductSort
			pagination: PaginationInput
		): ProductConnection!

		"""
		Get a specific product by ID or slug
		"""
		product(
			id: ID
			slug: String
		): Product

		"""
		Get categories with hierarchical structure
		"""
		categories(
			parentId: ID
			includeProducts: Boolean = false
		): [Category!]!

		"""
		Search across multiple content types
		"""
		search(
			query: String!
			types: [SearchType!] = [PRODUCT, CATEGORY]
			limit: Int = 10
		): SearchResult!

		"""
		Get user's personalized recommendations
		"""
		recommendations(
			userId: ID!
			type: RecommendationType!
			limit: Int = 5
		): [Recommendation!]!

		"""
		Get shopping cart for user
		"""
		cart(userId: ID!): Cart
	}

	"""
	Mutation root for e-commerce operations
	"""
	type Mutation {
		"""
		Create a new product
		"""
		createProduct(input: CreateProductInput!): Product!

		"""
		Update an existing product
		"""
		updateProduct(id: ID!, input: UpdateProductInput!): Product!

		"""
		Delete a product
		"""
		deleteProduct(id: ID!): Boolean!

		"""
		Add item to shopping cart
		"""
		addToCart(
			userId: ID!
			productId: ID!
			variantId: ID
			quantity: Int! = 1
		): Cart!

		"""
		Remove item from shopping cart
		"""
		removeFromCart(
			userId: ID!
			itemId: ID!
		): Cart!

		"""
		Update cart item quantity
		"""
		updateCartItemQuantity(
			userId: ID!
			itemId: ID!
			quantity: Int!
		): Cart!

		"""
		Create an order from cart
		"""
		createOrder(
			userId: ID!
			input: CreateOrderInput!
		): Order!
	}

	"""
	Subscription root for real-time updates
	"""
	type Subscription {
		"""
		Subscribe to product updates
		"""
		productUpdates(productIds: [ID!]): ProductUpdate!

		"""
		Subscribe to price changes
		"""
		priceChanges(categoryIds: [ID!]): PriceChange!

		"""
		Subscribe to order status updates
		"""
		orderUpdates(userId: ID!): OrderUpdate!

		"""
		Subscribe to inventory changes
		"""
		inventoryUpdates(productIds: [ID!]): InventoryUpdate!
	}

	"""
	Product type with comprehensive e-commerce features
	"""
	type Product {
		id: ID!
		name: String!
		slug: String!
		description: String!
		shortDescription: String
		price: Price!
		compareAtPrice: Price
		status: ProductStatus!
		trackInventory: Boolean!
		requiresShipping: Boolean!
		taxable: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!

		# Relations
		category: Category!
		variants: [ProductVariant!]!
		images: [ProductImage!]!
		reviews: [Review!]!
		tags: [Tag!]!
		attributes: [ProductAttribute!]!
		inventory: ProductInventory

		# Computed fields
		averageRating: Float
		totalReviews: Int
		isInStock: Boolean!
		lowestPrice: Price!
		highestPrice: Price!
	}

	"""
	Price type with currency support
	"""
	type Price {
		amount: Float!
		currency: String!
		formatted: String!
	}

	"""
	Product variant for different options like size, color, etc.
	"""
	type ProductVariant {
		id: ID!
		name: String!
		sku: String!
		price: Price!
		compareAtPrice: Price
		barcode: String
		trackInventory: Boolean!
		inventory: Int!
		image: ProductImage
		selectedOptions: [SelectedOption!]!
		isAvailable: Boolean!
	}

	"""
	Product category with hierarchical support
	"""
	type Category {
		id: ID!
		name: String!
		slug: String!
		description: String
		image: CategoryImage
		parent: Category
		children: [Category!]!
		products(
			filter: ProductFilter
			sort: ProductSort
			pagination: PaginationInput
		): ProductConnection!
		productCount: Int!
		level: Int!
		isActive: Boolean!
	}

	"""
	Connection type for GraphQL pagination
	"""
	type ProductConnection {
		edges: [ProductEdge!]!
		nodes: [Product!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	type ProductEdge {
		node: Product!
		cursor: String!
	}

	type PageInfo {
		hasNextPage: Boolean!
		hasPreviousPage: Boolean!
		startCursor: String
		endCursor: String
	}

	"""
	Shopping cart and order types
	"""
	type Cart {
		id: ID!
		userId: ID!
		items: [CartItem!]!
		subtotal: Price!
		total: Price!
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type CartItem {
		id: ID!
		product: Product!
		variant: ProductVariant
		quantity: Int!
		unitPrice: Price!
		totalPrice: Price!
		addedAt: DateTime!
	}

	type Order {
		id: ID!
		orderNumber: String!
		userId: ID!
		status: OrderStatus!
		currency: String!
		subtotal: Price!
		tax: Price!
		shipping: Price!
		total: Price!
		items: [OrderItem!]!
		shippingAddress: Address!
		billingAddress: Address!
		paymentMethod: PaymentMethod
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	Inventory and analytics types
	"""
	type ProductInventory {
		productId: ID!
		quantity: Int!
		reserved: Int!
		available: Int!
		locations: [InventoryLocation!]!
		lastUpdated: DateTime!
	}

	type ProductUpdate {
		product: Product!
		type: ProductUpdateType!
		timestamp: DateTime!
	}

	type PriceChange {
		product: Product!
		oldPrice: Price!
		newPrice: Price!
		changePercentage: Float!
		timestamp: DateTime!
	}

	"""
	Input types for mutations
	"""
	input ProductFilter {
		categoryId: ID
		status: ProductStatus
		minPrice: Float
		maxPrice: Float
		inStock: Boolean
		search: String
		tags: [String!]
		attributes: [AttributeFilter!]
	}

	input ProductSort {
		field: ProductSortField!
		direction: SortDirection! = ASC
	}

	input PaginationInput {
		first: Int = 20
		after: String
		last: Int
		before: String
	}

	input CreateProductInput {
		name: String!
		description: String!
		categoryId: ID!
		price: Float!
		currency: String! = "USD"
		sku: String!
		trackInventory: Boolean! = true
		requiresShipping: Boolean! = true
		tags: [String!]
		variants: [CreateVariantInput!]
		images: [UploadInput!]
		attributes: [CreateAttributeInput!]
	}

	"""
	Enums and unions
	"""
	enum ProductStatus {
		DRAFT
		ACTIVE
		INACTIVE
		ARCHIVED
	}

	enum ProductUpdateType {
		CREATED
		UPDATED
		DELETED
			PRICE_CHANGED
		INVENTORY_CHANGED
		STATUS_CHANGED
	}

	enum SearchType {
		PRODUCT
		CATEGORY
		BRAND
		TAG
	}

	enum RecommendationType {
		POPULAR
		RECENTLY_VIEWED
		SIMILAR
		TRENDING
	}

	"""
	Union types for flexible responses
	"""
	union SearchResultItem = Product | Category | Brand

	type SearchResult {
		items: [SearchResultItem!]!
		totalCount: Int!
		hasMore: Boolean!
	}
`

// Complex Postman collection with nested folders and authentication
const ComplexPostmanCollection = `{
	"info": {
		"_postman_id": "b2c3d4e5-f6g7-8901-bcde-f23456789012",
		"name": "E-commerce API Collection",
		"description": "Comprehensive collection for e-commerce API testing with authentication, variables, and scripts",
		"version": {
			"major": 2,
			"minor": 1,
			"patch": 0
		},
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"auth": {
		"type": "oauth2",
		"oauth2": [
			{
				"key": "access_token",
				"value": "{{access_token}}",
				"type": "string"
			},
			{
				"key": "token_type",
				"value": "Bearer",
				"type": "string"
			}
		],
		"header": [
			{
				"key": "Authorization",
				"value": "Bearer {{access_token}}",
				"type": "text"
			}
		]
	},
	"event": [
		{
			"listen": "prerequest",
			"script": {
				"type": "text/javascript",
				"exec": [
					"// Global pre-request script",
					"console.log('Request: ' + pm.info.requestName);",
					"",
					"// Set timestamp",
					"pm.variables.set('timestamp', Date.now());",
					"",
					"// Handle authentication token refresh",
					"if (pm.variables.get('access_token') && pm.variables.get('token_expires_at')) {",
					"    var expiresAt = parseInt(pm.variables.get('token_expires_at'));",
					"    if (Date.now() >= expiresAt - 60000) { // Refresh 1 minute before expiry",
					"        pm.sendRequest({",
					"            url: pm.variables.get('auth_url') + '/refresh',",
					"            method: 'POST',",
					"            header: {",
					"                'Content-Type': 'application/json',",
					"                'Authorization': 'Bearer ' + pm.variables.get('refresh_token')",
					"            },",
					"            body: {",
					"                mode: 'raw',",
					"                raw: JSON.stringify({ grant_type: 'refresh_token', refresh_token: pm.variables.get('refresh_token') })",
					"            },",
					"        }, function (err, res) {",
					"            if (res) {",
					"                var response = res.json();",
					"                pm.variables.set('access_token', response.access_token);",
					"                pm.variables.set('token_expires_at', Date.now() + (response.expires_in * 1000));",
					"            }",
					"        });",
					"    }",
					"}"
				]
			}
		},
		{
			"listen": "test",
			"script": {
				"type": "text/javascript",
				"exec": [
					"// Global test script",
					"pm.test('Response time is acceptable', function () {",
					"    pm.expect(pm.response.responseTime).to.be.below(3000);",
					"});",
					"",
					"pm.test('Response has valid JSON', function () {",
					"    try {",
					"        const jsonData = pm.response.json();",
					"        pm.globals.set('last_response_valid', true);",
					"    } catch (e) {",
					"        pm.globals.set('last_response_valid', false);",
					"        throw new Error('Invalid JSON in response');",
					"    }",
					"});"
				]
			}
		}
	],
	"variable": [
		{
			"key": "base_url",
			"value": "https://api.example.com/v2",
			"type": "string"
		},
		{
			"key": "auth_url",
			"value": "https://auth.example.com/oauth2",
			"type": "string"
		},
		{
			"key": "access_token",
			"value": "",
			"type": "string"
		},
		{
			"key": "refresh_token",
			"value": "",
			"type": "string"
		},
		{
			"key": "token_expires_at",
			"value": "",
			"type": "string"
		},
		{
			"key": "test_user_id",
			"value": "user_12345",
			"type": "string"
		},
		{
			"key": "test_product_id",
			"value": "prod_67890",
			"type": "string"
		}
	],
	"item": [
		{
			"name": "Authentication",
			"item": [
				{
					"name": "Login User",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/x-www-form-urlencoded",
								"type": "text"
							}
						],
						"body": {
							"mode": "urlencoded",
							"urlencoded": [
								{
									"key": "grant_type",
									"value": "password",
									"type": "text"
								},
								{
									"key": "username",
									"value": "test@example.com",
									"type": "text"
								},
								{
									"key": "password",
									"value": "testpassword123",
									"type": "text"
								},
								{
									"key": "client_id",
									"value": "test_client_id",
									"type": "text"
								},
								{
									"key": "client_secret",
									"value": "test_client_secret",
									"type": "text"
								}
							]
						},
						"url": {
							"raw": "{{auth_url}}/token",
							"host": ["{{auth_url}}"],
							"path": ["token"]
						}
					},
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Login successful', function () {",
									"    pm.response.to.have.status(200);",
									"});",
									"",
									"pm.test('Access token received', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('access_token');",
									"    pm.expect(jsonData).to.have.property('refresh_token');",
									"    ",
									"    // Store tokens in variables",
									"    pm.variables.set('access_token', jsonData.access_token);",
									"    pm.variables.set('refresh_token', jsonData.refresh_token);",
									"    pm.variables.set('token_expires_at', Date.now() + (jsonData.expires_in * 1000));",
									"});"
								]
							}
						}
					]
				},
				{
					"name": "Refresh Token",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"grant_type\": \"refresh_token\",\n  \"refresh_token\": \"{{refresh_token}}\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{auth_url}}/refresh",
							"host": ["{{auth_url}}"],
							"path": ["refresh"]
						}
					}
				}
			]
		},
		{
			"name": "Products",
			"item": [
				{
					"name": "Search Products",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"filter\": {\n    \"category\": \"electronics\",\n    \"min_price\": 100,\n    \"max_price\": 1000,\n    \"in_stock\": true\n  },\n  \"sort\": {\n    \"field\": \"price\",\n    \"direction\": \"asc\"\n  },\n  \"pagination\": {\n    \"first\": 20,\n    \"after\": null\n  }\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/products/search",
							"host": ["{{base_url}}"],
							"path": ["products", "search"]
						}
					},
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Search successful', function () {",
									"    pm.response.to.have.status(200);",
									"});",
									"",
									"pm.test('Products array returned', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('data');",
									"    pm.expect(jsonData.data).to.be.an('array');",
									"});",
									"",
									"pm.test('Pagination info present', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('pagination');",
									"    pm.expect(jsonData.pagination).to.have.property('totalCount');",
									"});"
								]
							}
						}
					]
				},
				{
					"name": "Get Product Details",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/products/{{test_product_id}}?include=variants,reviews,images",
							"host": ["{{base_url}}"],
							"path": ["products", "{{test_product_id}}"],
							"query": [
								{
									"key": "include",
									"value": "variants,reviews,images",
									"description": "Include related resources"
								}
							]
						}
					},
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Product details retrieved', function () {",
									"    pm.response.to.have.status(200);",
									"});",
									"",
									"pm.test('Product has required fields', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('id');",
									"    pm.expect(jsonData).to.have.property('name');",
									"    pm.expect(jsonData).to.have.property('price');",
									"});",
									"",
									"pm.test('Related data included', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('variants');",
									"    pm.expect(jsonData).to.have.property('reviews');",
									"    pm.expect(jsonData).to.have.property('images');",
									"});"
								]
							}
						}
					]
				},
				{
					"name": "Create Product",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"name\": \"Test Product\",\n  \"description\": \"A test product created via API\",\n  \"categoryId\": \"cat_12345\",\n  \"price\": 29.99,\n  \"currency\": \"USD\",\n  \"sku\": \"TEST-PROD-001\",\n  \"trackInventory\": true,\n  \"requiresShipping\": true,\n  \"tags\": [\"test\", \"api\"],\n  \"variants\": [\n    {\n      \"name\": \"Default\",\n      \"sku\": \"TEST-PROD-001-DEFAULT\",\n      \"price\": 29.99,\n      \"inventory\": 100\n    }\n  ]\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/products",
							"host": ["{{base_url}}"],
							"path": ["products"]
						}
					}
				}
			]
		},
		{
			"name": "Shopping Cart",
			"item": [
				{
					"name": "Get User Cart",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/cart/{{test_user_id}}",
							"host": ["{{base_url}}"],
							"path": ["cart", "{{test_user_id}}"]
						}
					},
					"event": [
						{
							"listen": "test",
							"script": {
								"type": "text/javascript",
								"exec": [
									"pm.test('Cart retrieved successfully', function () {",
									"    pm.response.to.have.status(200);",
									"});",
									"",
									"pm.test('Cart has required structure', function () {",
									"    const jsonData = pm.response.json();",
									"    pm.expect(jsonData).to.have.property('id');",
									"    pm.expect(jsonData).to.have.property('items');",
									"    pm.expect(jsonData).to.have.property('total');",
									"});"
								]
							}
						}
					]
				},
				{
					"name": "Add Item to Cart",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"productId\": \"{{test_product_id}}\",\n  \"quantity\": 2,\n  \"variantId\": null\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/cart/{{test_user_id}}/items",
							"host": ["{{base_url}}"],
							"path": ["cart", "{{test_user_id}}", "items"]
						}
					}
				},
				{
					"name": "Create Order from Cart",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"shippingAddress\": {\n    \"firstName\": \"John\",\n    \"lastName\": \"Doe\",\n    \"address1\": \"123 Main St\",\n    \"city\": \"New York\",\n    \"state\": \"NY\",\n    \"postalCode\": \"10001\",\n    \"country\": \"US\"\n  },\n  \"billingAddress\": {\n    \"firstName\": \"John\",\n    \"lastName\": \"Doe\",\n    \"address1\": \"123 Main St\",\n    \"city\": \"New York\",\n    \"state\": \"NY\",\n    \"postalCode\": \"10001\",\n    \"country\": \"US\"\n  },\n  \"paymentMethod\": {\n    \"type\": \"credit_card\",\n    \"cardNumber\": \"4111111111111111\",\n    \"expiryMonth\": \"12\",\n    \"expiryYear\": \"2025\",\n    \"cvv\": \"123\"\n  }\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/orders",
							"host": ["{{base_url}}"],
							"path": ["orders"]
						}
					}
				}
			]
		},
		{
			"name": "Webhooks",
			"item": [
				{
					"name": "Register Webhook",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json",
								"type": "text"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"url\": \"https://example.com/webhook\",\n  \"events\": [\"product.created\", \"product.updated\", \"order.created\"],\n  \"secret\": \"webhook_secret_12345\",\n  \"active\": true\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/webhooks",
							"host": ["{{base_url}}"],
							"path": ["webhooks"]
						}
					}
				}
			]
		}
	]
}`

// Invalid specifications for error testing
const InvalidOpenAPISpec = `{
	"openapi": "3.0.0",
	"info": {
		"title": "Invalid API"
		// Missing required 'version' field
	},
	"paths": {
		"/test": {
			"get": {
				// Missing required 'responses' field
				"summary": "Invalid endpoint"
			}
		}
	}`

const InvalidGraphQLSchema = `
	type Query {
		users: [User]
		user(id: ID!): User
	}

	type User {
		id: ID!
		name: String!
		email: String!
		posts: [Post]
	}

	type Post {
		id: ID!
		title: String!
		content: String!
		author: User!
	}
	// Missing closing brace for Post type
`

const InvalidPostmanCollection = `{
	"info": {
		"name": "Invalid Collection"
		// Missing required 'schema' field
	},
	"item": [
		{
			"name": "Invalid Request",
			"request": {
				"method": "GET"
				// Missing required 'url' field
			}
		}
	]
}`

// Edge case specifications for robustness testing
const EmptyOpenAPISpec = `{
	"openapi": "3.0.0",
	"info": {
		"title": "Empty API",
		"version": "1.0.0"
	},
	"paths": {}
}`

const EmptyGraphQLSchema = `
	type Query {
		_empty: String
	}
`

const EmptyPostmanCollection = `{
	"info": {
		"name": "Empty Collection",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": []
}`

// Large specifications for performance testing
const LargeOpenAPISpec = `{
	"openapi": "3.0.0",
	"info": {
		"title": "Large API for Performance Testing",
		"version": "1.0.0"
	},
	"paths": {}
}`
