const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

function parseMarkdown(md) {
    if (!md) return '';
    
    // 如果已经是明显的 HTML（包含 <br 或 <p>），为了防止重复转换，这里做一个简单的跳过或仅处理部分
    if (md.includes('</p>') || md.includes('<br')) {
        // 可能已经是 HTML
        // 但如果有 **，还是替换一下
        return md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    let html = md;
    
    // 1. 将 **粗体** 替换为 <strong>粗体</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 2. 将 *斜体* 替换为 <em>斜体</em> (只匹配非空白字符包围的)
    html = html.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    
    // 3. 处理标题 (# 标题)
    html = html.replace(/^### (.*$)/gim, '<h3 style="margin-top: 1em; font-weight: bold;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="margin-top: 1.2em; font-weight: bold; font-size: 1.1em;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="margin-top: 1.5em; font-weight: bold; font-size: 1.2em;">$1</h1>');
    
    // 4. 处理无序列表 (- 列表项 或 * 列表项)
    html = html.replace(/^[-\*]\s+(.*$)/gim, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>');
    
    // 5. 处理数字列表 (1. 列表项)
    html = html.replace(/^\d+\.\s+(.*$)/gim, '<li style="margin-left: 20px; list-style-type: decimal;">$1</li>');

    // 6. 换行处理
    // 连续两行以上换行作为段落，或者直接替换单行为 <br/>
    // 为了简单且符合网页展示，我们将单换行替换为 <br/>
    html = html.replace(/\n/g, '<br/>');

    // 清理可能产生的重复换行 (例如标题后面自带换行)
    html = html.replace(/<\/h[1-3]><br\/>/g, '</h$1>');
    html = html.replace(/<\/li><br\/>/g, '</li>');

    return html;
}

async function formatCache() {
    console.log('开始格式化 content_cache 中的 Markdown 内容...');
    
    // 分批读取，防止内存溢出
    const batchSize = 100;
    let skip = 0;
    let totalUpdated = 0;
    
    while (true) {
        const records = await prisma.contentCache.findMany({
            skip: skip,
            take: batchSize
        });
        
        if (records.length === 0) break;
        
        for (const record of records) {
            if (!record.data) continue;
            
            let originalText = '';
            let isJson = false;
            let obj = null;
            
            // 判断是否是 JSON 格式 (例如 AI 生成的是包含 {text: "..."} 的 JSON)
            try {
                obj = JSON.parse(record.data);
                if (obj && obj.text) {
                    originalText = obj.text;
                    isJson = true;
                } else if (typeof obj === 'string') {
                    originalText = obj;
                } else {
                    originalText = record.data; // 未知 JSON 结构，保守处理
                }
            } catch (e) {
                // 普通文本
                originalText = record.data;
            }
            
            // 只有当原文包含典型 MD 标记时才处理
            if (originalText.includes('**') || originalText.includes('\n') || originalText.startsWith('#')) {
                const formattedHtml = parseMarkdown(originalText);
                
                let newData = formattedHtml;
                if (isJson && obj) {
                    obj.text = formattedHtml;
                    newData = JSON.stringify(obj);
                }
                
                // 更新到数据库
                await prisma.contentCache.update({
                    where: { id: record.id },
                    data: { data: newData }
                });
                totalUpdated++;
            }
        }
        
        skip += batchSize;
        console.log(`已处理 ${skip} 条记录...`);
    }
    
    console.log(`✅ 格式化完成！共转换了 ${totalUpdated} 条包含 Markdown 的缓存内容。`);
    await prisma.$disconnect();
}

formatCache().catch(e => {
    console.error(e);
    prisma.$disconnect();
});
