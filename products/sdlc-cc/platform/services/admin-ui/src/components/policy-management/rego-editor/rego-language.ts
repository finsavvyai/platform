// @ts-nocheck
/**
 * Rego language definition for Monaco Editor
 */

export const regoLanguage = {
  tokenizer: {
    root: [
      [/#.*$/, 'comment'],
      [/\b(package|import|default|allow|deny|with|as|not|every|some|in|if|else|contains|contains_prefix|contains_suffix|ends_with|equals|equal|greater_than|greater_than_or_equal_to|less_than|less_than_or_equal_to|plus|minus|multiply|divide|mod|and|or|is_set|is_number|is_string|is_boolean|is_array|is_object|is_null|count|sum|product|max|min|sort|sort_by|reverse|array_concat|array_slice|to_number|to_string|round|ceil|floor|abs|sqrt|rand_intn|now|time_ns|parse_int|parse_float|parse_json|parse_xml|format_int|format_float|http_send|opa_runtime|trace|print)\b/, 'keyword'],
      [/\b(rego_metadata_version|trace|print)\b/, 'function'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/\b\d+(\.\d+)?\b/, 'number'],
      [/\b(true|false)\b/, 'boolean'],
      [/\b(null)\b/, 'keyword'],
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],
      [/[+\-*/%&|^~=!<>?]/, 'operator'],
      [/[{}()\[\];,\.]/, 'delimiter'],
      [/\s+/, 'white']
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop']
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop']
    ]
  }
};
