import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders the filled NDA markdown as a paper-style document. Raw HTML is not rendered. */
export function NdaPreview({ markdown }: { markdown: string }) {
  return (
    <article className="nda-document">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </article>
  );
}
