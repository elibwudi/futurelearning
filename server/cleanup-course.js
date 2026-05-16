const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接错误:', err.message);
        process.exit(1);
    }
    console.log(`已连接到数据库: ${dbPath}`);
});

// 获取命令行参数
const args = process.argv.slice(2);
const command = args[0];
const courseId = args[1];

// 删除课程函数
function deleteCourse(id) {
    console.log(`\n开始删除课程: ${id}`);
    console.log('='.repeat(80));

    // 首先查询课程信息
    db.get('SELECT id, title FROM courses WHERE id IS ?', [id], (err, course) => {
        if (err) {
            console.error('查询课程错误:', err.message);
            db.close();
            process.exit(1);
        }

        if (!course) {
            console.log(`错误: 未找到ID为 ${id} 的课程`);
            db.close();
            process.exit(1);
        }

        console.log(`找到课程: ${course.title}`);

        // 开始事务删除
        db.serialize(() => {
            // 1. 删除课程权限
            db.run('DELETE FROM course_permissions WHERE courseId IS ?', [id], function (err) {
                if (err) {
                    console.error('删除课程权限失败:', err.message);
                } else {
                    console.log(`✓ 删除了 ${this.changes} 条课程权限记录`);
                }
            });

            // 2. 删除内容缓存
            db.run('DELETE FROM content_cache WHERE courseId IS ?', [id], function (err) {
                if (err) {
                    console.error('删除内容缓存失败:', err.message);
                } else {
                    console.log(`✓ 删除了 ${this.changes} 条内容缓存记录`);
                }
            });

            // 3. 删除学习进度
            db.run('DELETE FROM progress WHERE courseId IS ?', [id], function (err) {
                if (err) {
                    console.error('删除学习进度失败:', err.message);
                } else {
                    console.log(`✓ 删除了 ${this.changes} 条学习进度记录`);
                }
            });

            // 4. 最后删除课程本身
            db.run('DELETE FROM courses WHERE id IS ?', [id], function (err) {
                if (err) {
                    console.error('删除课程失败:', err.message);
                    db.close();
                    process.exit(1);
                } else {
                    console.log(`✓ 已删除课程`);
                    console.log('='.repeat(80));
                    console.log('\n✅ 课程已彻底清理完成！');
                    db.close();
                }
            });
        });
    });
}

// 列出课程函数
function listCourses() {
    const query = `
        SELECT id, title, description, status, createdAt, authorId 
        FROM courses 
        WHERE title LIKE '%Test%' OR title LIKE '%Guo%' OR description LIKE '%Test%'
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('查询错误:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('\n找到以下测试课程:');
        console.log('='.repeat(80));

        if (rows.length === 0) {
            console.log('未找到匹配的课程');
        } else {
            rows.forEach((row, index) => {
                const date = new Date(row.createdAt);
                console.log(`\n课程 ${index + 1}:`);
                console.log(`  ID: ${row.id === null ? 'null' : row.id}`);
                console.log(`  标题: ${row.title}`);
                console.log(`  描述: ${row.description || '(无)'}`);
                console.log(`  状态: ${row.status}`);
                console.log(`  创建时间: ${date.toLocaleString('zh-CN')}`);
                console.log(`  作者ID: ${row.authorId || '(无)'}`);
            });
        }

        console.log('\n' + '='.repeat(80));

        // 如果找到了课程，给出删除命令提示
        if (rows.length > 0) {
            console.log('\n要删除这些课程，请使用以下命令:');
            rows.forEach((row, index) => {
                const idStr = row.id === null ? 'null' : row.id;
                console.log(`  课程 ${index + 1}: node cleanup-course.js delete "${idStr}"`);
            });
        }

        db.close();
    });
}

// 主逻辑
if (command === 'delete' && courseId !== undefined) {
    // 处理 'null' 字符串
    const id = courseId === 'null' ? null : courseId;
    deleteCourse(id);
} else {
    // 默认列出课程
    listCourses();
}
