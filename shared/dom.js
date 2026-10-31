// Tiny DOM helpers. Text is always inserted as text nodes (never innerHTML).

const SVG_NS = "http://www.w3.org/2000/svg";

export function makeDom(doc) {
  function apply(el, props, kids) {
    for (const [key, value] of Object.entries(props ?? {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "hidden" && value === true) el.hidden = true;
      else if (value === true) el.setAttribute(key, "");
      else el.setAttribute(key, String(value));
    }
    for (const kid of kids.flat()) {
      if (kid === undefined || kid === null || kid === false) continue;
      el.append(typeof kid === "string" || typeof kid === "number" ? doc.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  const h = (tag, props, ...kids) => apply(doc.createElement(tag), props, kids);
  const svg = (tag, props, ...kids) => apply(doc.createElementNS(SVG_NS, tag), props, kids);

  // "plain **bold** plain" -> fragment with <b> for the marked parts.
  function rich(text) {
    const frag = doc.createDocumentFragment();
    text.split("**").forEach((part, i) => {
      if (part === "") return;
      frag.append(i % 2 === 1 ? h("b", {}, part) : doc.createTextNode(part));
    });
    return frag;
  }

  return { h, svg, rich };
}
