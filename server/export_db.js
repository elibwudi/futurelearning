/**
 * 数据库全量导出脚本 - 将 SQLite 数据导出为 JSON 文件
 * 执行: node server/export_db.js
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const TABLES = ['users', 'courses', 'progress', 'settings', 'content_cache', 'course_permissions'];
const exportData = {};
let completed = 0;

console.log('🔄 开始导出数据库...\n');

TABLES.forEach(table => {
    db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) {
            console.error(`❌ 导出 ${table} 失败:`, err.message);
            exportData[table] = [];
        } else {
            exportData[table] = rows;
            console.log(`  ✅ ${table.padEnd(22)} ${rows.length} 条记录`);
        }
        completed++;
        if (completed === TABLES.length) {
            db.close();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const outFile = path.join(__dirname, `db_export_${timestamp}.json`);
            const meta = {
                exportedAt: new Date().toISOString(),
                sourceFile: dbPath,
                tableSummary: {}
            };
            TABLES.forEach(t => { meta.tableSummary[t] = exportData[t].length; });

            const output = { meta, data: exportData };
            fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');

            const fileSizeKB = (fs.statSync(outFile).size / 1024).toFixed(1);
            console.log(`\n✅ 导出完成！`);
            console.log(`   文件: ${path.basename(outFile)}`);
            console.log(`   大小: ${fileSizeKB} KB`);
            console.log(`\n📊 数据汇总:`);
            TABLES.forEach(t => console.log(`   ${t.padEnd(22)}: ${exportData[t].length} 条`));
        }
    });
});
