import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import '../styles/richtext.css';

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    placeholder?: string;
    readOnly?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder = '开始编辑内容...',
    readOnly = false
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Image.configure({
                inline: true,
                allowBase64: false,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                },
            }),
        ],
        content: value,
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'tiptap-editor',
                placeholder: placeholder,
            },
        },
    });

    const handleImageUpload = useCallback(() => {
        if (!editor) return;

        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                // Upload image to server
                const formData = new FormData();
                formData.append('file', file);

                const token = localStorage.getItem('cognitive_map_jwt_token');
                const response = await fetch('/api/upload/image', {
                    method: 'POST',
                    headers: token ? {
                        'Authorization': `Bearer ${token}`
                    } : {},
                    body: formData
                });

                if (!response.ok) throw new Error('上传失败');

                const data = await response.json();

                // Insert image at current position
                editor.chain().focus().setImage({ src: data.url }).run();
            } catch (error) {
                console.error('Image upload failed:', error);
                alert('图片上传失败，请重试');
            }
        };
    }, [editor]);

    const addLink = useCallback(() => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('输入链接URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="tiptap-container">
            {!readOnly && (
                <div className="tiptap-toolbar">
                    <div className="toolbar-group">
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                            title="标题 1"
                            type="button"
                        >
                            H1
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                            title="标题 2"
                            type="button"
                        >
                            H2
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                            title="标题 3"
                            type="button"
                        >
                            H3
                        </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={editor.isActive('bold') ? 'is-active' : ''}
                            title="粗体"
                            type="button"
                        >
                            <strong>B</strong>
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={editor.isActive('italic') ? 'is-active' : ''}
                            title="斜体"
                            type="button"
                        >
                            <em>I</em>
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={editor.isActive('strike') ? 'is-active' : ''}
                            title="删除线"
                            type="button"
                        >
                            <s>S</s>
                        </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={editor.isActive('bulletList') ? 'is-active' : ''}
                            title="无序列表"
                            type="button"
                        >
                            •••
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={editor.isActive('orderedList') ? 'is-active' : ''}
                            title="有序列表"
                            type="button"
                        >
                            1.2.3.
                        </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            className={editor.isActive('blockquote') ? 'is-active' : ''}
                            title="引用"
                            type="button"
                        >
                            " "
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                            className={editor.isActive('codeBlock') ? 'is-active' : ''}
                            title="代码块"
                            type="button"
                        >
                            &lt;/&gt;
                        </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <button
                            onClick={addLink}
                            className={editor.isActive('link') ? 'is-active' : ''}
                            title="链接"
                            type="button"
                        >
                            🔗
                        </button>
                        <button
                            onClick={handleImageUpload}
                            title="上传图片"
                            type="button"
                        >
                            🖼️
                        </button>
                    </div>

                    <div className="toolbar-divider"></div>

                    <div className="toolbar-group">
                        <button
                            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                            title="清除格式"
                            type="button"
                        >
                            ✖️
                        </button>
                    </div>
                </div>
            )}
            <EditorContent editor={editor} />
        </div>
    );
};

export default RichTextEditor;
