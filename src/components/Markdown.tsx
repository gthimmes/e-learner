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

/** Renders trusted-author Markdown safely (AUTHOR-4, NFR-3). */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  if (!children?.trim()) return null;
  return (
    <div className={`prose ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, schema]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
