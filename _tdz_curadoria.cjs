// TDZ White Screen Curatorship - Full Diagnosis
const fs = require('fs');
const path = require('path');

const issues = [];
const warnings = [];

console.log('=== DETRAN CE Connect — TDZ White Screen Full Curatorship ===\n');

// 1. Check dist bundle
console.log('--- 1. DIST BUNDLE ANALYSIS ---');
try {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  const jsMatch = html.match(/src="([^"]+\.js)"/);
  if (jsMatch) {
    const jsPath = path.join('dist', jsMatch[1]);
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    console.log(`Main bundle: ${jsPath}`);
    console.log(`Size: ${(jsContent.length / 1024).toFixed(1)} KB (${(jsContent.length / 1024 / 1024).toFixed(1)} MB)`);
    
    // Check for IIFE patterns that can cause TDZ
    const iifeCount = (jsContent.match(/\(function\(/g) || []).length;
    const arrowFnCount = (jsContent.match(/\(\(\)=>\{/g) || []).length;
    console.log(`IIFE patterns: ${iifeCount}, Arrow functions: ${arrowFnCount}`);
    
    // Check for common TDZ patterns: const/let used before declaration
    // Look for the specific error pattern: access before init
    const lines = jsContent.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    // Check if bundle starts with an IIFE or ESM
    const first100 = jsContent.substring(0, 200);
    console.log(`Bundle starts with: ${first100.substring(0, 100)}...`);
    
    // Count chunk references
    const dynamicImports = (jsContent.match(/import\(/g) || []).length;
    console.log(`Dynamic imports: ${dynamicImports}`);
    
    // List all JS files in dist/assets
    console.log('\nAll assets in dist/assets/:');
    const assetsDir = 'dist/assets';
    if (fs.existsSync(assetsDir)) {
      fs.readdirSync(assetsDir).filter(f => f.endsWith('.js')).forEach(f => {
        const stat = fs.statSync(path.join(assetsDir, f));
        console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
      });
    }
  } else {
    issues.push('No JS script tag found in dist/index.html');
    console.log('ERROR: No JS script tag found');
  }
} catch (e) {
  issues.push(`Dist analysis failed: ${e.message}`);
  console.error(e.message);
}

// 2. Check package.json for problematic deps
console.log('\n--- 2. DEPENDENCY ANALYSIS ---');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Known problematic versions
  const problemDeps = {
    'react': deps['react'],
    'react-dom': deps['react-dom'],
    'react-router-dom': deps['react-router-dom'],
    '@vitejs/plugin-react-swc': deps['@vitejs/plugin-react-swc'],
    'vite': deps['vite'],
    'supabase/js': deps['@supabase/supabase-js'],
    '@supabase/ssr': deps['@supabase/ssr'],
  };
  
  for (const [name, ver] of Object.entries(problemDeps)) {
    console.log(`  ${name}: ${ver || 'NOT INSTALLED'}`);
  }
  
  // Check for known TDZ-causing combinations
  if (deps['react'] && deps['react'].startsWith('19')) {
    console.log('\n  ⚠️ React 19 detected — may have compatibility issues with some libs');
  }
  if (deps['@vitejs/plugin-react-swc']) {
    console.log('  ⚠️ Using SWC plugin — known to produce different output ordering than Babel');
  }
} catch (e) {
  issues.push(`Dep analysis failed: ${e.message}`);
}

// 3. Check main.tsx entry point
console.log('\n--- 3. ENTRY POINT ANALYSIS ---');
try {
  const mainTsx = fs.readFileSync('src/main.tsx', 'utf8');
  console.log('main.tsx content:');
  console.log(mainTsx.substring(0, 500));
  
  // Check import order
  const reactImport = mainTsx.includes("from 'react'");
  const ReactDOMImport = mainTsx.includes("from 'react-dom'");
  const routerImport = mainTsx.includes("from 'react-router-dom'");
  console.log(`\nImports: React=${reactImport}, ReactDOM=${ReactDOMImport}, Router=${routerImport}`);
} catch (e) {
  issues.push(`Entry point analysis failed: ${e.message}`);
}

// 4. Check App.tsx for lazy imports or problematic patterns
console.log('\n--- 4. APP.TSX LAZY IMPORTS ---');
try {
  const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
  const lazyImports = appTsx.match(/lazy\([\s\S]*?\)/g) || [];
  const suspenseBlocks = appTsx.match(/Suspense[\s\S]*?<\/Suspense>/g) || [];
  console.log(`React.lazy() calls: ${lazyImports.length}`);
  console.log(`<Suspense> blocks: ${suspenseBlocks.length}`);
  lazyImports.forEach((li, i) => {
    console.log(`  Lazy #${i+1}: ${li.substring(0, 80)}...`);
  });
} catch (e) {
  issues.push(`App.tsx analysis failed: ${e.message}`);
}

// 5. Check for CJS/ESM interop issues in key files
console.log('\n--- 5. CJS/ESM INTEROP CHECK ---');
const cjsFiles = [
  'src/integrations/supabase/client.ts',
  'src/hooks/useAuth.ts',
  'src/lib/operacao.ts',
];
for (const f of cjsFiles) {
  try {
    const content = fs.readFileSync(f, 'utf8');
    const hasRequire = content.includes('require(');
    const hasModuleExports = content.includes('module.exports');
    const hasDefaultExport = content.includes('export default');
    const hasNamedExport = content.match(/^export\s+(const|function|class|async|type|interface)/m);
    console.log(`  ${f}:`);
    console.log(`    require(): ${hasRequire}, module.exports: ${hasModuleExports}`);
    console.log(`    export default: ${hasDefaultExport}, named exports: ${hasNamedExport ? hasNamedExport.length : 0}`);
  } catch (e) {
    warnings.push(`Could not read ${f}: ${e.message}`);
  }
}

// 6. Vite config deep check
console.log('\n--- 6. VITE CONFIG ANALYSIS ---');
try {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  console.log(viteConfig);
  
  if (viteConfig.includes('transformMixedEsModules')) {
    console.log('\n  ⚠️ transformMixedEsModules is ENABLED — this is a common TDZ cause');
    console.log('     It transforms CJS modules to ESM which can reorder initializations');
  }
  if (viteConfig.includes('manualChunks')) {
    console.log('  ℹ️ manualChunks is configured — code splitting active');
  }
} catch (e) {
  issues.push(`Vite config analysis failed: ${e.message}`);
}

// 7. Check index.html for module type
console.log('\n--- 7. INDEX.HTML CHECK ---');
try {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const hasModuleScript = indexHtml.includes('type="module"');
  const hasInlineScript = indexHtml.match(/<script>(?![^<]*src)/);
  console.log(`type="module": ${hasModuleScript}`);
  console.log(`Inline scripts: ${hasInlineScript ? 'YES' : 'NO'}`);
  if (!hasModuleScript) {
    issues.push('index.html script tag missing type="module" — may cause scope issues');
  }
} catch (e) {
  issues.push(`Index HTML check failed: ${e.message}`);
}

// SUMMARY
console.log('\n=== CURATORSHIP SUMMARY ===');
console.log(`Issues found: ${issues.length}`);
issues.forEach((i, idx) => console.log(`  ${idx+1}. ❌ ${i}`));
console.log(`\nWarnings: ${warnings.length}`);
warnings.forEach((w, idx) => console.log(`  ${idx+1}. ⚠️  ${w}`));

if (issues.length === 0) {
  console.log('\n✅ No structural issues found — TDZ likely caused by browser cache or runtime condition');
}
