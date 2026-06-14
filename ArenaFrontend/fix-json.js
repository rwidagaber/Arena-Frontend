const fs = require('fs');
const path = require('path');

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return mergeDeep(target, ...sources);
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// A simple way to parse JSON with duplicate keys is not easy in JS.
// We'll use a trick: parse the string character by character at the root level, 
// split into individual objects, parse them, and deep merge.

function fixFile(filePath) {
    console.log(`Fixing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // It's basically an object with duplicate keys.
    // Since JSON.parse drops duplicates (keeping the last), we'll do a regex replacement to make it valid for parsing all.
    // But regex on JSON is hard.
    
    // Instead of parsing, let's just use a library if possible. Let's see if we can install one or just do it.
    // If we replace all root-level keys with unique names, parse, then merge.
    
    let rootLevelKeys = [];
    let counter = 0;
    
    // Match `"key": {` or `"key": "value"` at the root level
    // Assuming 2 spaces indentation
    let modifiedContent = content.replace(/^  "([^"]+)":/gm, (match, key) => {
        let newKey = `__DUPE_${counter}__${key}`;
        counter++;
        return `  "${newKey}":`;
    });
    
    let parsed;
    try {
        parsed = JSON.parse(modifiedContent);
    } catch(e) {
        console.error("Failed to parse modified content for", filePath);
        return;
    }
    
    let merged = {};
    for (const tempKey in parsed) {
        let originalKey = tempKey.replace(/^__DUPE_\d+__/, '');
        if (!merged[originalKey]) {
            merged[originalKey] = parsed[tempKey];
        } else if (isObject(merged[originalKey]) && isObject(parsed[tempKey])) {
            mergeDeep(merged[originalKey], parsed[tempKey]);
        } else {
            // Overwrite
            merged[originalKey] = parsed[tempKey];
        }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`Successfully fixed ${filePath}`);
}

const dir = path.join(__dirname, 'public', 'i18n');
fixFile(path.join(dir, 'en.json'));
fixFile(path.join(dir, 'ar.json'));
