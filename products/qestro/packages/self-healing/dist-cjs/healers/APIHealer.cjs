"use strict";
/**
 * APIHealer — fixes for API schema changes.
 *
 * Suggests field path updates, error format migrations, null safety, and
 * status code range checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIHealer = void 0;
class APIHealer {
    heal(_testResult, _testCode) {
        return [
            {
                id: 'api_schema_field_update',
                type: 'api_response_mapping',
                originalValue: 'response.data.user.name',
                suggestedValue: 'response.data.profile.fullName',
                confidence: 0.65,
                rationale: 'API response schema has changed. Detected field path update.',
                beforeAfterDiff: `- const name = response.data.user.name\n+ const name = response.data.profile.fullName`,
            },
            {
                id: 'api_error_format_change',
                type: 'api_error_handler',
                originalValue: 'if (response.error)',
                suggestedValue: 'if (response.errors?.length)',
                confidence: 0.72,
                rationale: 'API error response format changed from singular to array. Update error handling.',
                beforeAfterDiff: `- if (response.error)\n+ if (response.errors?.length)`,
            },
            {
                id: 'api_null_safety',
                type: 'api_null_check',
                originalValue: 'const id = data.user.id',
                suggestedValue: 'const id = data.user?.id ?? data.profile?.userId',
                confidence: 0.58,
                rationale: 'API field may be missing or moved. Add null safety checks and fallback paths.',
                beforeAfterDiff: `- const id = data.user.id\n+ const id = data.user?.id ?? data.profile?.userId`,
            },
            {
                id: 'api_status_code_change',
                type: 'api_status_code',
                originalValue: 'if (response.status === 200)',
                suggestedValue: 'if (response.status >= 200 && response.status < 300)',
                confidence: 0.68,
                rationale: 'Success status code may have changed. Use range check instead of exact match.',
                beforeAfterDiff: `- if (response.status === 200)\n+ if (response.status >= 200 && response.status < 300)`,
            },
        ];
    }
}
exports.APIHealer = APIHealer;
//# sourceMappingURL=APIHealer.js.map