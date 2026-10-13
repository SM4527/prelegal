import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The page already has an h1, so the document's headings are demoted one level,
 * and the read-only task-list checkboxes get an accessible name.
 */
const components: Components = {
  h1: (props) => <h2 {...domProps(props)} />,
  h2: (props) => <h3 {...domProps(props)} />,
  h3: (props) => <h4 {...domProps(props)} />,
  input: (props) => <input {...domProps(props)} aria-label={props.checked ? "Selected" : "Not selected"} />,
};

/** react-markdown passes its syntax-tree node as a prop; it must not reach the DOM. */
function domProps<P extends { node?: unknown }>({ node, ...props }: P): Omit<P, "node"> {
  void node;
  return props;
}

/** Renders the filled NDA markdown as a paper-style document. Raw HTML is not rendered. */
export function NdaPreview({ markdown }: { markdown: string }) {
  return (
    <article className="nda-document">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </article>
  );
}
