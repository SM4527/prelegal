import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { List, ListItem, Nodes, PhrasingContent, Root, Table } from "mdast";
import type { ReactNode } from "react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/**
 * Renders the NDA markdown as a PDF document. The markdown is parsed into an
 * mdast tree and each node type the NDA uses is mapped to react-pdf primitives.
 * This module pulls in @react-pdf/renderer, so it is only loaded on download.
 */

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.45 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 10 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 6 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  paragraph: { marginBottom: 6 },
  strong: { fontFamily: "Helvetica-Bold" },
  emphasis: { fontFamily: "Helvetica-Oblique" },
  link: { color: "#1d4ed8" },
  list: { marginBottom: 6 },
  listItem: { flexDirection: "row", marginBottom: 4 },
  bullet: { width: 22 },
  listBody: { flex: 1 },
  table: { borderWidth: 1, borderColor: "#9ca3af", marginVertical: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#9ca3af", minHeight: 24 },
  tableCell: { flex: 1, padding: 5, borderRightWidth: 1, borderColor: "#9ca3af" },
  tableHeader: { fontFamily: "Helvetica-Bold" },
});

const headingStyles = { 1: styles.h1, 2: styles.h2, 3: styles.h3 } as const;

function renderInline(nodes: PhrasingContent[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return node.value;
      case "strong":
        return <Text key={i} style={styles.strong}>{renderInline(node.children)}</Text>;
      case "emphasis":
        return <Text key={i} style={styles.emphasis}>{renderInline(node.children)}</Text>;
      case "link":
        return <Link key={i} src={node.url} style={styles.link}>{renderInline(node.children)}</Link>;
      case "break":
        return "\n";
      default:
        return "value" in node ? node.value : null;
    }
  });
}

function renderList(list: List, key: number): ReactNode {
  const start = list.start ?? 1;
  return (
    <View key={key} style={styles.list}>
      {list.children.map((item: ListItem, i) => {
        const marker =
          item.checked != null ? (item.checked ? "[X]" : "[  ]") : list.ordered ? `${start + i}.` : "•";
        return (
          <View key={i} style={styles.listItem}>
            <Text style={styles.bullet}>{marker}</Text>
            <View style={styles.listBody}>{item.children.map(renderBlock)}</View>
          </View>
        );
      })}
    </View>
  );
}

function renderTable(table: Table, key: number): ReactNode {
  return (
    <View key={key} style={styles.table} wrap={false}>
      {table.children.map((row, r) => (
        <View key={r} style={styles.tableRow}>
          {row.children.map((cell, c) => (
            <Text key={c} style={r === 0 ? [styles.tableCell, styles.tableHeader] : styles.tableCell}>
              {renderInline(cell.children)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function renderBlock(node: Nodes, key: number): ReactNode {
  switch (node.type) {
    case "heading":
      return (
        <Text
          key={key}
          style={headingStyles[node.depth as 1 | 2 | 3] ?? styles.h3}
          // Each top-level section after the first (i.e. the Standard Terms) starts a new page.
          break={node.depth === 1 && key > 0}
          minPresenceAhead={40}
        >
          {renderInline(node.children)}
        </Text>
      );
    case "paragraph":
      return <Text key={key} style={styles.paragraph}>{renderInline(node.children)}</Text>;
    case "list":
      return renderList(node, key);
    case "table":
      return renderTable(node, key);
    default:
      // The NDA templates use only the block types above, and user input is fully
      // escaped, so it can't introduce others (code blocks, quotes, images, ...).
      return null;
  }
}

export function DocumentPdf({ markdown, title }: { markdown: string; title: string }) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  return (
    <Document title={title} creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        {tree.children.map(renderBlock)}
      </Page>
    </Document>
  );
}
