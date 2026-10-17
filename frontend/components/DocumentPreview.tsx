import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The page already has an h1, so the document's headings are demoted one level,
 * and the read-only task-list checkboxes get an accessible name. Deeply indented
 * template text (the DPA's lettered clauses) parses as a code block; it is shown
 * as ordinary legal text.
 */
const components: Components = {
  h1: (props) => <h2 {...domProps(props)} />,
  h2: (props) => <h3 {...domProps(props)} />,
  h3: (props) => <h4 {...domProps(props)} />,
  input: (props) => <input {...domProps(props)} aria-label={props.checked ? "Selected" : "Not selected"} />,
  pre: ({ children }) => <p className="whitespace-pre-line">{children}</p>,
  code: ({ children }) => <>{children}</>,
};

/** react-markdown passes its syntax-tree node as a prop; it must not reach the DOM. */
function domProps<P extends { node?: unknown }>({ node, ...props }: P): Omit<P, "node"> {
  void node;
  return props;
}

/** Renders the filled document's markdown as a paper-style document. Raw HTML is not rendered. */
export function DocumentPreview({ markdown }: { markdown: string }) {
  return (
    <article className="legal-document">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </article>
  );
}
