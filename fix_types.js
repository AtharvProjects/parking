const fs = require('fs');
let content = fs.readFileSync('src/lib/database.types.ts', 'utf8');

content = content.replace(/Row: {([^}]*?)\s*};\s*Insert: \{ \[key: string\]: any \};\s*Update: \{ \[key: string\]: any \};/g, (match, rowFields) => {
    // Generate Insert and Update by making them identical to Row but optional
    const fields = rowFields.split('\n').filter(l => l.trim().length > 0);
    const optionalFields = fields.map(f => {
        let line = f.trim();
        // remove trailing semi
        if (line.endsWith(';')) line = line.slice(0, -1);
        const parts = line.split(':');
        const name = parts[0].trim();
        const type = parts.slice(1).join(':').trim();
        // remove ? if present in name
        const cleanName = name.replace('?', '');
        return `          ${cleanName}?: ${type};`;
    }).join('\n');

    return `Row: {${rowFields}\n        };\n        Insert: {\n${optionalFields}\n        };\n        Update: {\n${optionalFields}\n        };`;
});

fs.writeFileSync('src/lib/database.types.ts', content);
