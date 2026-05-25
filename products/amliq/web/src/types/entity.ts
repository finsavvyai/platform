export interface Name {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  aliases: string[];
}

export interface Identifier {
  type: 'ssn' | 'passport' | 'tax_id' | 'license' | 'business_registry';
  value: string;
  issuer?: string;
}

export interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

export type EntityType = 'individual' | 'company' | 'watchlist';

export interface Entity {
  id: string;
  type: EntityType;
  name: Name;
  identifiers: Identifier[];
  address?: Address;
  dob?: string;
  nationality?: string;
  businessType?: string;
  createdAt: string;
  updatedAt: string;
}
