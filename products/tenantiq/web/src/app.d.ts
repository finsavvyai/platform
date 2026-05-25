/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			user?: {
				id: string;
				email: string;
				name: string;
				organizationId: string;
				tenantIds: string[];
				role: 'viewer' | 'operator' | 'admin' | 'super_admin';
			};
		}
		interface PageData {}
		interface Platform {
			env: {
				KV: KVNamespace;
			};
		}
	}
}

export {};
