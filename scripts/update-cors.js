/**
 * Script to update CORS configuration in Edge Functions
 * Replaces wildcard CORS with secure origin-based CORS
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FUNCTIONS_DIR = path.join(__dirname, '../supabase/functions');

// CORS replacement patterns
const oldCorsPattern = /const corsHeaders = \{[\s\S]*?\};/;
const newCorsImport = `import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";`;

// Function files to update (critical ones first)
const criticalFunctions = [
  'get-user-role/index.ts',
  'purchase-credits/index.ts', 
  'request-withdrawal/index.ts',
  'process-withdrawal/index.ts',
  'onekhusa-webhook/index.ts',
  'paychangu-webhook/index.ts',
  'auth-login/index.ts',
  'upsert-user-role/index.ts',
  'ai-router/index.ts',
  'create-google-meet/index.ts',
];

function updateCorsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already updated
    if (content.includes('getCorsHeaders')) {
      console.log(`✓ Already updated: ${filePath}`);
      return;
    }
    
    // Replace old CORS declaration with import
    content = content.replace(oldCorsPattern, newCorsImport);
    
    // Replace OPTIONS handler
    content = content.replace(
      /if \(req\.method === "OPTIONS"\) \{\s*return new Response\(null, \{ headers: corsHeaders \}\);\s*\}/,
      `const requestOrigin = req.headers.get("Origin");\n  if (req.method === "OPTIONS") {\n    return handleCorsPreflight(requestOrigin);\n  }`
    );
    
    // Replace corsHeaders usage in error responses
    content = content.replace(
      /headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \}/g,
      'headers: { "Content-Type": "application/json" }'
    );
    
    // Wrap final responses with CORS
    content = content.replace(
      /return new Response\(JSON\.stringify\(([^)]+)\), \{[\s\S]*?status: (\d+),[\s\S]*?headers: \{ "Content-Type": "application\/json" \}[\s\S]*?\}\);/g,
      (match, data, status) => {
        return `const response = new Response(JSON.stringify(${data}), {\n      status: ${status},\n      headers: { "Content-Type": "application/json" },\n    });\n    return withCorsHeaders(response, requestOrigin);`;
      }
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
  } catch (error) {
    console.error(`✗ Error updating ${filePath}:`, error.message);
  }
}

// Update critical functions
console.log('Updating CORS configuration in critical Edge Functions...');
criticalFunctions.forEach(func => {
  const filePath = path.join(FUNCTIONS_DIR, func);
  if (fs.existsSync(filePath)) {
    updateCorsInFile(filePath);
  } else {
    console.log(`✗ File not found: ${filePath}`);
  }
});

console.log('\nCORS update complete. Remember to:');
console.log('1. Set ALLOWED_ORIGINS environment variable');
console.log('2. Test all updated functions');
console.log('3. Deploy changes to Supabase');