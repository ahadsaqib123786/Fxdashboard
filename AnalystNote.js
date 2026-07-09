// The AI analyst note (lib/ai.js) always uses the same limited Markdown
// subset: "## Heading" lines, "- bullet" lines, and plain paragraphs. Rather
// than pull in a full Markdown library (a new dependency the user would have
// to `npm install`), this renders just that subset directly to JSX.
export default function AnalystNote({ text }) {
  if (!text) return null;

  const blocks = [];
  let currentList = null;

  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      currentList = null;
      continue;
    }

    if (line.startsWith("## ")) {
      currentList = null;
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      if (!currentList) {
        currentList = { type: "list", items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(line.slice(2).trim());
    } else {
      currentList = null;
      blocks.push({ type: "paragraph", text: line });
    }
  }

  return (
    <div className="analyst-note">
      {blocks.map((block, i) => {
        if (block.type === "heading") return <h4 key={i}>{block.text}</h4>;
        if (block.type === "list") {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
