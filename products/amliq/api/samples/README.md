# AMLIQ Sample Data

Test payloads and sample data for every endpoint.

## Files

| File | Contents |
|---|---|
| `customers.csv` | 15 sample customers for CSV import testing |
| `automation_rules.json` | 6 example automation rules |
| `alerts_send_samples.json` | Alert broadcast examples (email/SMS/WhatsApp) |
| `verify_samples.json` | OTP verification payloads |
| `screening_samples.json` | Entity/crypto/transaction/vessel screening |
| `webhook_samples.json` | Webhook HMAC signing examples |

---

## Quick test sequence

### 1. Import customers
```bash
curl -X POST https://api.amliq.finance/api/v1/ingest/customers/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@samples/customers.csv"
```

### 2. Create an automation rule
```bash
curl -X POST https://api.amliq.finance/api/v1/automation/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "name": "High OFAC match → email",
  "enabled": true,
  "trigger": "alert.created",
  "conditions": [{"field": "score", "operator": "gte", "value": "0.85"}],
  "actions": [{"type": "email", "config": {"to": "you@example.com"}}]
}
EOF
```

### 3. Run a screening (will trigger automation if match)
```bash
curl -X POST https://api.amliq.finance/api/v1/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_name": "Hassan Ali Mohammad", "entity_type": "individual"}'
```

### 4. Send a manual alert
```bash
curl -X POST https://api.amliq.finance/api/v1/alerts/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "to": "+972501234567",
    "body": "Test alert from AMLIQ"
  }'
```

### 5. Send OTP verification
```bash
curl -X POST https://api.amliq.finance/api/v1/verify/send \
  -H "Content-Type: application/json" \
  -d '{"to": "+972501234567", "channel": "whatsapp"}'
```

### 6. Get webhook secret
```bash
curl https://api.amliq.finance/api/v1/webhooks/incoming/secret \
  -H "Authorization: Bearer $TOKEN"
```

---

## Known high-risk names in the sample data

These will likely match against sanctions lists:
- **Hassan Ali Mohammad** — sanctioned pattern (Syria)
- **Ivan Petrov** — Russian pattern
- **Vladimir Sokolov** — Russian pattern
- **Vostok Holdings** — Russian company
- **Tehran Maritime Ltd** — Iranian company

These should NOT match (clean names for negative testing):
- John Smith, Sarah Johnson, Jane Doe, Li Ming, Chen Wei, Marcus Brown
