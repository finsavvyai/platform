/**
 * API Documentation Page - Service Endpoint Definitions (Documents, Payments)
 */

import type { EndpointInfo } from './types';

export const documentsEndpoints: EndpointInfo[] = [
  {
    path: '/api/v1/documents/upload',
    method: 'POST',
    description: 'Upload a document for processing',
    parameters: [
      {
        name: 'file',
        type: 'file',
        required: true,
        description: 'Document file to upload',
      },
      {
        name: 'name',
        type: 'string',
        required: false,
        description: 'Document name',
      },
      {
        name: 'tags',
        type: 'array',
        required: false,
        description: 'Document tags',
      },
    ],
    responses: [
      {
        code: 200,
        description: 'Document uploaded successfully',
        schema: {
          document_id: 'string',
          status: 'uploading',
          created_at: 'string',
        },
      },
    ],
    examples: [
      {
        title: 'Upload PDF Document',
        description: 'Upload a PDF document for RAG processing',
        language: 'python',
      },
      {
        title: 'Upload with Tags',
        description: 'Upload document with metadata',
        language: 'javascript',
      },
    ],
  },
  {
    path: '/api/v1/documents/{document_id}',
    method: 'GET',
    description: 'Get document information',
    parameters: [
      {
        name: 'document_id',
        type: 'string',
        required: true,
        description: 'Document ID',
      },
    ],
    responses: [
      {
        code: 200,
        description: 'Document information',
        schema: {
          document_id: 'string',
          name: 'string',
          size: 'number',
          status: 'string',
          created_at: 'string',
          tags: 'array',
        },
      },
    ],
    examples: [],
  },
];

export const paymentsEndpoints: EndpointInfo[] = [
  {
    path: '/api/v1/payments/methods',
    method: 'GET',
    description: 'List payment methods',
    parameters: [],
    responses: [
      {
        code: 200,
        description: 'List of payment methods',
        schema: {
          methods: 'array',
        },
      },
    ],
    examples: [],
  },
  {
    path: '/api/v1/payments/process',
    method: 'POST',
    description: 'Process a payment',
    parameters: [
      {
        name: 'amount_cents',
        type: 'integer',
        required: true,
        description: 'Amount in cents',
      },
      {
        name: 'currency',
        type: 'string',
        required: true,
        description: 'Currency code (ISO 4217)',
      },
      {
        name: 'payment_method_token',
        type: 'string',
        required: true,
        description: 'Tokenized payment method',
      },
    ],
    requestBody: {
      amount_cents: 1000,
      currency: 'USD',
      payment_method_token: 'tok_xxx',
      description: 'Payment description',
    },
    responses: [
      {
        code: 200,
        description: 'Payment processed successfully',
        schema: {
          payment_id: 'string',
          status: 'string',
          created_at: 'string',
        },
      },
    ],
    examples: [],
  },
];
