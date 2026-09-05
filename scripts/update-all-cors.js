/**
 * Comprehensive CORS update script for all Edge Functions
 * This script updates all Edge Functions to use secure CORS headers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FUNCTIONS_DIR = path.join(__dirname, '../supabase/functions');

// Get all Edge Function directories
function getFunctionDirectories() {
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name);
}

// Read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Write file content
function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function updateFunctionCors(functionName) {
  const indexFile = path.join(FUNCTIONS_DIR, functionName, 'index.ts');
  
  if (!fs.existsSync(indexFile)) {
    console.log(`⚠ No index.ts found for ${functionName}`);
    return;
  }

  try {
    let content = fs.readFileSync(indexFile, 'utf8');
    
    // Skip if already updated
    if (content.includes('getCorsHeaders')) {
      console.log(`✓ ${functionName} - Already updated`);
      return;
    }

    // Add CORS import after other imports
    const importPattern = /import\s+{[^}]*}\s+from\s+["']([^"']+)["'];?\s*\n/g;
    const imports = [];
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[0]);
    }
    
    // Add CORS import after the last import
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const corsImport = `import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";\n`;
      content = content.replace(lastImport, lastImport + corsImport);
    } else {
      // No imports found, add at the beginning
      const corsImport = `import { getCorsHeaders, handleCorsPreflight, withCorsHeaders } from "../_shared/cors.ts";\n\n`;
      content = corsImport + content;
    }

    // Remove old corsHeaders declaration
    content = content.replace(/const corsHeaders = \{[\s\S]*?\};\s*\n/g, '');

    // Update OPTIONS handler
    content = content.replace(
      /if \(req\.method === "OPTIONS"\) \{\s*return new Response\(null, \{ headers: corsHeaders \}\);\s*\}/g,
      `const requestOrigin = req.headers.get("Origin");\n  if (req.method === "OPTIONS") {\n    return handleCorsPreflight(requestOrigin);\n  }`
    );

    // Update all Response returns to use withCorsHeaders
    const responsePattern = /return new Response\(([^)]+)\), \{([^}]+)\}\)/g;
    content = content.replace(responsePattern, (match, data, options) => {
      // Parse options
      const opts = {};
      options.split(',').forEach(opt => {
        const [key, value] = opt.split(':').map(s => s.trim());
        opts[key] = value.replace(/"/g, '');
      });
      
      // Extract status and headers
      const status = opts.status || '200';
      const headers = opts.headers || '{}';
      
      // Check if it's an error response or success response
      const isError = status >= 400;
      
      // Create new response pattern
      return `const response = new Response(${data}, {\n      status: ${status},\n      headers: ${headers.replace(/\.\.\.corsHeaders/g, '"Content-Type": "application/json"')},\n    });\n    return withCorsHeaders(response, requestOrigin)`;
    });

    // Handle simple Response returns
    content = content.replace(
      /return new Response\(([^)]+)\)\);/g,
      (match, data) => {
        if (data.includes('headers')) {
          return match; // Skip if already has headers
        }
        return `const response = new Response(${data});\n    return withCorsHeaders(response, requestOrigin);`;
      }
    );

    fs.writeFileSync(indexFile, content, 'utf8');
    console.log(`✓ ${functionName} - Updated successfully`);
    
  } catch (error) {
    console.error(`✗ ${functionName} - Error:`, error.message);
  }
}

// Main execution
console.log('Starting comprehensive CORS update...\n');

const functions = getFunctionDirectories();
console.log(`Found ${functions.length} Edge Functions to update\n`);

functions.forEach(updateFunctionCors);

console.log('\n✅ CORS update complete!');
console.log('\nNext steps:');
console.log('1. Review the updated files');
console.log('2. Set ALLOWED_ORIGINS environment variable');
console.log('3. Test all updated functions');
console.log('4. Deploy changes to Supabase');