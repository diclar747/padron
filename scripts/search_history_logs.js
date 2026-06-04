const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\Sate Core i5\\.gemini\\antigravity\\brain\\c5241ad9-ab7b-429a-a101-3825540a51c7\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  if (!fs.existsSync(logPath)) {
    console.log('Log file not found at:', logPath);
    return;
  }

  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('dbf') || lowerLine.includes('encarnacion') || lowerLine.includes('migrate') || lowerLine.includes('dvd-padron')) {
      // Print first 200 characters of matching line to avoid overflow
      console.log(`[Line ${lineNum}] ${line.substring(0, 300)}...`);
    }
  }
}

run().catch(console.error);
