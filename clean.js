const fs = require('fs');
const path = require('path');

const files_list_path = 'C:\\Users\\Masood Ahmed\\.gemini\\antigravity\\scratch\\files_list.txt';
if (!fs.existsSync(files_list_path)) {
    console.error('File list not found');
    process.exit(1);
}

const files_list = fs.readFileSync(files_list_path, 'utf8').split('\n').map(f => f.trim()).filter(f => f);

files_list.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log('Skipping non-existent file:', file);
        return;
    }
    const ext = path.extname(file).toLowerCase();
    if (!['.html', '.js', '.css'].includes(ext)) return;

    console.log('Processing:', file);
    let content = fs.readFileSync(file, 'utf8');

    if (ext === '.js') {
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove single-line comments, but be careful of URLs
        // This regex tries to avoid // inside strings or after a colon (URLs)
        // It's still not 100% perfect but better than nothing
        content = content.replace(/^(?!\s*['"]|.*['"]\/\/).*\/\/.*$/gm, (match) => {
            if (match.includes('://')) return match; // Likely a URL
            return match.split('//')[0];
        });
    } else if (ext === '.css') {
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    } else if (ext === '.html') {
        content = content.replace(/<!--[\s\S]*?-->/g, '');
    }

    // Remove trailing whitespace and consolidate empty lines
    content = content.split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    fs.writeFileSync(file, content, 'utf8');
});
console.log('Done');
