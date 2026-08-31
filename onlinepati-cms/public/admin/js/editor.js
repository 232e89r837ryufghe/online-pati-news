/**
 * Online Pati News CMS — TipTap WYSIWYG Editor Integration
 * Uses TipTap via CDN for a rich text editing experience
 */

// TipTap modules loaded via importmap in HTML

let editorInstance = null;


export async function initEditor(containerId = 'editorContent') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Wait for TipTap to load
  const { Editor } = await import('https://esm.sh/@tiptap/core@2.11.0');
  const { StarterKit } = await import('https://esm.sh/@tiptap/starter-kit@2.11.0');
  const { Link } = await import('https://esm.sh/@tiptap/extension-link@2.11.0');
  const { Image } = await import('https://esm.sh/@tiptap/extension-image@2.11.0');
  const { Underline } = await import('https://esm.sh/@tiptap/extension-underline@2.11.0');
  const { Placeholder } = await import('https://esm.sh/@tiptap/extension-placeholder@2.11.0');
  const { TextAlign } = await import('https://esm.sh/@tiptap/extension-text-align@2.11.0');

  editorInstance = new Editor({
    element: container,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' }
      }),
      Image.configure({
        HTMLAttributes: { class: 'editor-img' }
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write your news content here...'
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'editor-content',
      }
    },
    onUpdate: ({ editor }) => {
      updateToolbarState(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      updateToolbarState(editor);
    }
  });

  window.editor = editorInstance;
  setupToolbar(editorInstance);

  return editorInstance;
}

// ─── Toolbar Setup ──────────────────────────────────────────

function setupToolbar(editor) {
  const actions = {
    'btnBold': () => editor.chain().focus().toggleBold().run(),
    'btnItalic': () => editor.chain().focus().toggleItalic().run(),
    'btnUnderline': () => editor.chain().focus().toggleUnderline().run(),
    'btnStrike': () => editor.chain().focus().toggleStrike().run(),
    'btnH2': () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    'btnH3': () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    'btnH4': () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    'btnBulletList': () => editor.chain().focus().toggleBulletList().run(),
    'btnOrderedList': () => editor.chain().focus().toggleOrderedList().run(),
    'btnBlockquote': () => editor.chain().focus().toggleBlockquote().run(),
    'btnCode': () => editor.chain().focus().toggleCode().run(),
    'btnCodeBlock': () => editor.chain().focus().toggleCodeBlock().run(),
    'btnHR': () => editor.chain().focus().setHorizontalRule().run(),
    'btnUndo': () => editor.chain().focus().undo().run(),
    'btnRedo': () => editor.chain().focus().redo().run(),
    'btnAlignLeft': () => editor.chain().focus().setTextAlign('left').run(),
    'btnAlignCenter': () => editor.chain().focus().setTextAlign('center').run(),
    'btnAlignRight': () => editor.chain().focus().setTextAlign('right').run(),
    'btnLink': () => {
      const url = prompt('Enter URL:');
      if (url) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    },
    'btnUnlink': () => editor.chain().focus().unsetLink().run(),
    'btnImage': () => {
      if (window.openMediaPicker) {
        window.openMediaPicker('editor');
      } else {
        const url = prompt('Enter Image URL:');
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      }
    },
    'btnClearFormat': () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    'btnSource': () => toggleSourceView(editor)
  };

  Object.entries(actions).forEach(([id, action]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        action();
      });
    }
  });
}

// ─── Toolbar Active State ───────────────────────────────────

function updateToolbarState(editor) {
  const toggles = {
    'btnBold': editor.isActive('bold'),
    'btnItalic': editor.isActive('italic'),
    'btnUnderline': editor.isActive('underline'),
    'btnStrike': editor.isActive('strike'),
    'btnH2': editor.isActive('heading', { level: 2 }),
    'btnH3': editor.isActive('heading', { level: 3 }),
    'btnH4': editor.isActive('heading', { level: 4 }),
    'btnBulletList': editor.isActive('bulletList'),
    'btnOrderedList': editor.isActive('orderedList'),
    'btnBlockquote': editor.isActive('blockquote'),
    'btnCode': editor.isActive('code'),
    'btnCodeBlock': editor.isActive('codeBlock'),
    'btnAlignLeft': editor.isActive({ textAlign: 'left' }),
    'btnAlignCenter': editor.isActive({ textAlign: 'center' }),
    'btnAlignRight': editor.isActive({ textAlign: 'right' }),
  };

  Object.entries(toggles).forEach(([id, isActive]) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', isActive);
  });
}

// ─── Source View Toggle ─────────────────────────────────────

let isSourceView = false;

function toggleSourceView(editor) {
  const container = editor.options.element;

  if (!isSourceView) {
    // Switch to source view
    const html = editor.getHTML();
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.id = 'sourceEditor';
    textarea.style.minHeight = '400px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '0.85rem';
    textarea.value = html;

    container.style.display = 'none';
    container.parentNode.insertBefore(textarea, container.nextSibling);
    isSourceView = true;

    document.getElementById('btnSource')?.classList.add('active');
  } else {
    // Switch back to editor
    const textarea = document.getElementById('sourceEditor');
    if (textarea) {
      editor.commands.setContent(textarea.value);
      textarea.remove();
    }
    container.style.display = 'block';
    isSourceView = false;

    document.getElementById('btnSource')?.classList.remove('active');
  }
}
