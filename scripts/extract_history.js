const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\Sate Core i5\\.gemini\\antigravity\\brain\\c5241ad9-ab7b-429a-a101-3825540a51c7\\.system_generated\\logs\\transcript.jsonl';
const outputPath = 'd:\\localhost\\padron\\scripts\\history_matches.txt';

async function run() {
  if (!fs.existsSync(logPath)) {
    console.log('Log file not found at:', logPath);
    return;
  }

  const writeStream = fs.createWriteStream(outputPath);
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
      try {
        const obj = JSON.parse(line);
        // Extract content or tool calls to make it easy to read
        const cleanObj = {
          line: lineNum,
          source: obj.source,
          type: obj.type,
          content: obj.content ? obj.content.substring(0, 500) : null,
          tool_calls: obj.tool_calls ? obj.tool_calls.map(tc => ({ name: tc.name, args: tc.args })) : null
        };
        writeStream.write(JSON.stringify(cleanObj, null, 2) + '\n---\n');
      } catch (e) {
        writeStream.write(`[Line ${lineNum}] Raw: ${line.substring(0, 500)}\n---\n`);
      }
    }
  }
  writeStream.end();
  console.log('Done. Matches written to:', outputPath);
}

run().catch(console.error);
