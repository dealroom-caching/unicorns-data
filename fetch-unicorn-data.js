import fs from 'fs';
import path from 'path';

// Google Sheets JSON URLs configuration
const UNICORN_DATA_SOURCES = {
  'companies': {
    url: 'https://docs.google.com/spreadsheets/d/1ArkMsWfTgzdSJrZlkXsXSpmVI4GPIhurEvHzCwHVgD0/gviz/tq?tqx=out:json&gid=0',
    filename: 'companies.json'
  },
  'mafia': {
    url: 'https://docs.google.com/spreadsheets/d/17VXE9EDB4Zp0S2vqcbYCfvLXBopiCd8timD7Cc0Vjxk/gviz/tq?tqx=out:json&gid=1308157446',
    filename: 'mafia.json'
  },
  'founders': {
    url: 'https://docs.google.com/spreadsheets/d/1ewW9Kul0CgknzcwzJ3SvEfS5hjVH0LQuCwdR-zBmbOY/gviz/tq?tqx=out:json&gid=1896821889',
    filename: 'founders.json'
  }
};

async function fetchGoogleSheetJson(name, config) {
  console.log(`Fetching ${name}...`);
  
  const response = await fetch(config.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${name}: ${response.statusText}`);
  }
  
  const text = await response.text();
  
  // Parse Google Sheets JSONP response
  const jsonStartIndex = text.indexOf('(') + 1;
  const jsonEndIndex = text.lastIndexOf('}') + 1;
  const jsonText = text.substring(jsonStartIndex, jsonEndIndex);
  const data = JSON.parse(jsonText);
  
  if (!data.table || !data.table.rows) {
    throw new Error(`No data found in ${name}`);
  }
  
  // Convert to our format
  const headers = data.table.cols?.map(col => col.label || '') || [];
  const rows = data.table.rows.map(row => 
    row.c?.map(cell => cell?.v || '') || []
  );
  
  return {
    headers,
    rows,
    lastUpdated: new Date().toISOString(),
    timestamp: Date.now(),
    source: `Google Sheets - ${name}`,
    url: config.url,
    rowCount: rows.length
  };
}

async function main() {
  try {
    console.log('🔄 Fetching fresh unicorn data from Google Sheets...');
    
    // Create cache directory
    const cacheDir = path.join(process.cwd(), 'public', 'cached-data');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Fetch all data sources
    const allData = {};
    const savedFiles = [];
    
    for (const [name, config] of Object.entries(UNICORN_DATA_SOURCES)) {
      try {
        const sheetData = await fetchGoogleSheetJson(name, config);
        allData[name] = sheetData;
        console.log(`✅ ${name}: ${sheetData.rows.length} rows`);
        
        // Save individual JSON file for this data source
        const filePath = path.join(cacheDir, config.filename);
        const content = JSON.stringify(sheetData, null, 2);
        fs.writeFileSync(filePath, content);
        
        // Force update the file timestamp to ensure git sees it as changed
        const now = new Date();
        fs.utimesSync(filePath, now, now);
        
        savedFiles.push(config.filename);
        console.log(`📁 Saved: ${config.filename} (${sheetData.rows.length} rows)`);
        
      } catch (error) {
        console.error(`❌ Failed to fetch ${name}:`, error.message);
        // Continue with other sources instead of failing completely
        console.log(`⚠️ Skipping ${name} and continuing...`);
      }
    }
    
    // Create a combined metadata file
    const metadata = {
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
      sources: Object.keys(UNICORN_DATA_SOURCES),
      totalSources: Object.keys(UNICORN_DATA_SOURCES).length,
      successfulSources: Object.keys(allData).length,
      savedFiles: savedFiles
    };
    
    const metadataPath = path.join(cacheDir, 'unicorn-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Force update metadata timestamp
    const now = new Date();
    fs.utimesSync(metadataPath, now, now);
    
    console.log(`\n✅ Unicorn cache updated successfully!`);
    console.log(`📊 Total data sources: ${metadata.totalSources}`);
    console.log(`✅ Successfully fetched: ${metadata.successfulSources}`);
    console.log(`📄 Individual files saved: ${savedFiles.length}`);
    savedFiles.forEach(file => console.log(`   • ${file}`));
    console.log(`📁 Metadata: unicorn-metadata.json`);
    console.log(`🕒 Timestamp: ${metadata.lastUpdated}`);
    
  } catch (error) {
    console.error('❌ Unicorn cache update failed:', error);
    process.exit(1);
  }
}

main();



