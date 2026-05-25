// SAML XML walkers — regex-based, sufficient for SAML 2.0 assertions.

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function extractTagText(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${localName}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

export function extractTagBlock(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${localName}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w-]+:)?${localName}>`);
  const m = xml.match(re);
  return m ? m[0] : null;
}

export function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*\\s${attr}="([^"]+)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

export function extractAttributes(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<(?:[\w-]+:)?Attribute\s+[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Attribute>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = m[1];
    const inner = m[2];
    const vm = inner.match(/<(?:[\w-]+:)?AttributeValue[^>]*>([^<]*)<\/(?:[\w-]+:)?AttributeValue>/);
    if (vm) out[name] = vm[1].trim();
  }
  return out;
}
