import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Allow class names on code blocks (syntax highlighting hooks) and task-list checkboxes.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
    input: [...(defaultSchema.attributes?.input ?? []), "type", "checked", "disabled"],
  },
};

// GFM task-list checkboxes are rendered disabled with no label; give them an accessible name (WCAG 4.1.2).
const components = {
  input: ({ node, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { node?: unknown }) => {
    void node; // hast node — not a DOM prop
    return props.type === "checkbox" ? <input {...props} aria-label={props.checked ? "Completed task" : "Task"} /> : <input {...props} />;
  },
};

/** Renders trusted-author Markdown safely (AUTHOR-4, NFR-3). */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <div className={`prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
