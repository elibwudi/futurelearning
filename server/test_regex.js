let html = \`# AI主要学派 人工智能在其发展历程中，形成了几个核心的思想流派，它们从不同角度定义和实现“智能”。 # # 符号主义 * * *核心理念* * : 智能源于对符号的操纵和逻辑推理。 * * *核心方法* * : 基于知识表示\`;

html = html.replace(/\\*\\s*\\*(.*?)\\*\\s*\\*/g, '<strong>$1</strong>');
html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
html = html.replace(/#\\s*#\\s*#\\s+(.*$)/gim, '<h3>$1</h3>');
html = html.replace(/#\\s*#\\s+(.*$)/gim, '<h2>$1</h2>');
html = html.replace(/^#\\s+(.*$)/gim, '<h1>$1</h1>');
console.log(html);
