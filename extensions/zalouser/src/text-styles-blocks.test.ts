import { describe, expect, it } from "vitest";
import { parseZalouserTextStyles } from "./text-styles.js";
import { TextStyle } from "./zca-constants.js";

describe("parseZalouserTextStyles blocks", () => {
  it("maps headings, block quotes, and lists into line styles", () => {
    expect(parseZalouserTextStyles(["# Title", "> quoted", "  - nested"].join("\n"))).toEqual({
      text: "Title\nquoted\nnested",
      styles: [
        { start: 0, len: 5, st: TextStyle.Bold },
        { start: 0, len: 5, st: TextStyle.Big },
        { start: 6, len: 6, st: TextStyle.Indent, indentSize: 1 },
        { start: 13, len: 6, st: TextStyle.UnorderedList },
      ],
    });
    expect(parseZalouserTextStyles("#   title")).toEqual({
      text: "  title",
      styles: [
        { start: 0, len: 7, st: TextStyle.Bold },
        { start: 0, len: 7, st: TextStyle.Big },
      ],
    });
    expect(parseZalouserTextStyles(">   quoted")).toEqual({
      text: "  quoted",
      styles: [{ start: 0, len: 8, st: TextStyle.Indent, indentSize: 1 }],
    });
  });

  it("preserves optional closing ATX hashes as heading text", () => {
    expect(parseZalouserTextStyles("# title #")).toEqual({
      text: "title #",
      styles: [
        { start: 0, len: 7, st: TextStyle.Bold },
        { start: 0, len: 7, st: TextStyle.Big },
      ],
    });
    expect(parseZalouserTextStyles("# ![](/img)")).toEqual({
      text: "![](/img)",
      styles: [
        { start: 0, len: 9, st: TextStyle.Bold },
        { start: 0, len: 9, st: TextStyle.Big },
      ],
    });
    expect(parseZalouserTextStyles("![](/img)\n---")).toEqual({
      text: "![](/img)\n---",
      styles: [],
    });
  });

  it("keeps container-only nested blockquotes empty", () => {
    expect(parseZalouserTextStyles("> >")).toEqual({ text: "", styles: [] });
    expect(parseZalouserTextStyles("- >")).toEqual({
      text: "-",
      styles: [{ start: 0, len: 1, st: TextStyle.Indent, indentSize: 1 }],
    });
    expect(parseZalouserTextStyles("> -")).toEqual({
      text: "-",
      styles: [{ start: 0, len: 1, st: TextStyle.Indent, indentSize: 1 }],
    });
    expect(parseZalouserTextStyles("> first\n>").text).toBe("first\n");
    expect(parseZalouserTextStyles("> first\n>\n").text).toBe("first\n\n");
  });

  it("classifies a long blockquote-marker line in linear time", () => {
    // The blockquote-only check ended each repetition with `[ \t]?` while the
    // next began with ` {0,3}`, so either side could claim a space and a line
    // that failed to match degraded superlinearly through this entry point,
    // which formats outgoing message text. Keep the marker count modest so a
    // reintroduced ambiguity still finishes and reports instead of hanging.
    const input = `${"> ".repeat(28)}x\nquoted`;
    const startedAt = performance.now();
    expect(parseZalouserTextStyles(input).text).toContain("x");
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it("keeps closed-fence whitespace-only payload lines byte-for-byte", () => {
    expect(parseZalouserTextStyles("```\n   \n```")).toEqual({
      text: "\u00A0\u00A0\u00A0",
      styles: [],
    });
    expect(parseZalouserTextStyles("```\ncode\n\n```")).toEqual({
      text: "code\n",
      styles: [],
    });
    expect(parseZalouserTextStyles("```\ncode\n\n```\n**next**")).toEqual({
      text: "code\n\nnext",
      styles: [{ start: 6, len: 4, st: TextStyle.Bold }],
    });
    expect(parseZalouserTextStyles("- ```\n  ```")).toEqual({ text: "", styles: [] });
    expect(parseZalouserTextStyles("> ```\n> ```")).toEqual({ text: "", styles: [] });
    expect(parseZalouserTextStyles("- ```\n    \n  ```").text).not.toContain("```");
  });

  it("keeps unclosed fenced text inside its parser-owned containers", () => {
    expect(parseZalouserTextStyles("- ```\n  code")).toEqual({
      text: "```\ncode",
      styles: [{ start: 0, len: 8, st: TextStyle.UnorderedList }],
    });
    expect(parseZalouserTextStyles("> ```\n> code")).toEqual({
      text: "```\ncode",
      styles: [
        { start: 0, len: 3, st: TextStyle.Indent, indentSize: 1 },
        { start: 4, len: 4, st: TextStyle.Indent, indentSize: 1 },
      ],
    });
    expect(parseZalouserTextStyles("```\n> literal")).toEqual({
      text: "```\n> literal",
      styles: [],
    });
    expect(parseZalouserTextStyles("-\t```\n    code")).toEqual({
      text: "```\ncode",
      styles: [{ start: 0, len: 8, st: TextStyle.UnorderedList }],
    });
    expect(parseZalouserTextStyles("- ```\n  - literal").text).toBe("```\n- literal");
    expect(parseZalouserTextStyles("   - ```\n     code").text).toBe("```\ncode");
    expect(parseZalouserTextStyles(">   ```\n>   code").text).toBe("  ```\ncode");
    expect(parseZalouserTextStyles(">\t```\n>\tcode").text).toBe("  ```\ncode");
    expect(parseZalouserTextStyles("- ```")).toEqual({
      text: "```",
      styles: [{ start: 0, len: 3, st: TextStyle.UnorderedList }],
    });
    expect(parseZalouserTextStyles("```\n")).toEqual({ text: "```\n", styles: [] });
    expect(parseZalouserTextStyles("> ```")).toEqual({
      text: "```",
      styles: [{ start: 0, len: 3, st: TextStyle.Indent, indentSize: 1 }],
    });
    expect(parseZalouserTextStyles("- parent\n  - ```")).toEqual({
      text: "parent\n```",
      styles: [
        { start: 0, len: 6, st: TextStyle.UnorderedList },
        { start: 7, len: 3, st: TextStyle.Indent, indentSize: 1 },
        { start: 7, len: 3, st: TextStyle.UnorderedList },
      ],
    });
    expect(parseZalouserTextStyles("> ```\n>    ")).toEqual({
      text: `\`\`\`\n${"\u00A0".repeat(3)}`,
      styles: [
        { start: 0, len: 3, st: TextStyle.Indent, indentSize: 1 },
        { start: 4, len: 3, st: TextStyle.Indent, indentSize: 1 },
      ],
    });
    expect(parseZalouserTextStyles("> ```\n> a\n> b")).toEqual({
      text: "```\na\nb",
      styles: [
        { start: 0, len: 3, st: TextStyle.Indent, indentSize: 1 },
        { start: 4, len: 1, st: TextStyle.Indent, indentSize: 1 },
        { start: 6, len: 1, st: TextStyle.Indent, indentSize: 1 },
      ],
    });
    const nestedNbsp = parseZalouserTextStyles("- parent\n  - ```\n    \u00A0");
    expect(
      nestedNbsp.styles
        .filter((style) => style.st === TextStyle.Indent)
        .map((style) => style.indentSize),
    ).toEqual([1, 1]);
  });
});
