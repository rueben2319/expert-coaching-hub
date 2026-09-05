# Expert Coaching Hub API Documentation

This directory contains the OpenAPI/Swagger specification for the Expert Coaching Hub API.

## Overview

The API consists of:
- **Supabase REST API**: Auto-generated from database schema (PostgREST)
- **Supabase Edge Functions**: 38 serverless functions for business logic

## Documentation Files

- `openapi.yaml` - Complete OpenAPI 3.0.3 specification
- `README.md` - This file

## Viewing the Documentation

### Using Swagger UI (Recommended)

1. Install dependencies:
```bash
npm install swagger-ui-express yamljs
```

2. Add the following to your Vite development server or create a simple Express server:

```typescript
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import fs from 'fs';
import path from 'path';

const app = express();
const swaggerDocument = YAML.load(
  path.join(__dirname, 'api-docs/openapi.yaml')
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(3001, () => {
  console.log('API documentation available at http://localhost:3001/api-docs');
});
```

3. Visit `http://localhost:3001/api-docs` to view the interactive documentation.

### Using Online Swagger Editor

1. Go to [https://editor.swagger.io/](https://editor.swagger.io/)
2. Paste the contents of `openapi.yaml`
3. View the interactive documentation

### Using Redoc

1. Install Redoc CLI:
```bash
npm install -g @redocly/cli
```

2. Serve the documentation:
```bash
redocly serve api-docs/openapi.yaml
```

## API Categories

### Authentication
- User login with role resolution
- Role management (admin only)
- Self-assignment prevention

### Courses
- Course catalog browsing
- Course content access
- Course enrollment

### Payments
- Credit purchase initiation
- Payment gateway webhooks (OneKhusa, PayChangu)
- Transaction history

### Withdrawals
- Withdrawal request creation
- Admin approval/rejection
- Payout processing

### Calendar
- Google Meet creation
- Meeting management
- Calendar integration

### AI
- Content generation
- Exercise generation
- Quiz generation
- AI routing between providers

### Subscriptions
- Coach subscription management
- Tier upgrades/downgrades
- Subscription cancellation

### Admin
- Administrative operations
- User management
- System monitoring

## Authentication

All API endpoints require authentication via Supabase Auth JWT token.

**How to authenticate:**
1. Call `/functions/v1/auth-login` with email and password
2. Receive JWT token in response
3. Include token in Authorization header: `Bearer <token>`

## Rate Limiting

- **AI requests**: 50 per 30 minutes
- **Credit purchases**: 10 per hour
- **Withdrawals**: 5 per hour
- **Calendar operations**: 10 per minute

Rate-limited endpoints return HTTP 429 with a `Retry-After` header.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "HTTP_STATUS_CODE"
}
```

Common error codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Database Schema

The Supabase REST API endpoints are auto-generated from the database schema. For detailed schema information, see:
- `supabase/migrations/schema.sql`
- `src/integrations/supabase/types.ts` (auto-generated)

## Updating the Documentation

When adding new Edge Functions or modifying existing ones:

1. Update the corresponding path in `openapi.yaml`
2. Add/update request/response schemas
3. Add appropriate tags and descriptions
4. Test the updated specification in Swagger Editor

## Best Practices

1. **Always use HTTPS** in production
2. **Validate inputs** on both client and server
3. **Handle errors gracefully** with appropriate HTTP status codes
4. **Rate limit** all public endpoints
5. **Log errors** for debugging (without exposing sensitive data)
6. **Version your API** for breaking changes
7. **Document all parameters** with examples
8. **Keep schemas DRY** - reuse components where possible

## Support

For API issues or questions, contact: support@expertcoachinghub.com
