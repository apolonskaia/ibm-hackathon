const MERMAID_START_PATTERN = /^\s*(graph|flowchart)\b/i;
const MERMAID_EDGE_PATTERN = /\s(?:-->|==>|-\.->|---|===|-\.\-|-.->)\s/;

function sanitizeIdentifier(identifier: string): string {
  const sanitized = identifier
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized) {
    return 'node';
  }

  return /^\d/.test(sanitized) ? `node_${sanitized}` : sanitized;
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    return trimmed;
  }

  const firstBracketIndex = trimmed.search(/[\[({]/);

  if (firstBracketIndex === -1) {
    if (/^[A-Za-z0-9_]+$/.test(trimmed)) {
      return trimmed;
    }

    const sanitizedId = sanitizeIdentifier(trimmed);
    const safeLabel = trimmed.replace(/"/g, "'");
    return `${sanitizedId}["${safeLabel}"]`;
  }

  if (firstBracketIndex === 0) {
    return trimmed;
  }

  const identifier = trimmed.slice(0, firstBracketIndex).trim();
  const suffix = trimmed.slice(firstBracketIndex);

  if (/^[A-Za-z0-9_]+$/.test(identifier)) {
    return trimmed;
  }

  return `${sanitizeIdentifier(identifier)}${suffix}`;
}

function normalizeSubgraphLine(line: string): string {
  const match = line.match(/^(\s*subgraph)\s+(.+)$/i);

  if (!match) {
    return line;
  }

  const [, prefix, rawDefinition] = match;
  const definition = rawDefinition.trim();
  const bracketIndex = definition.indexOf('[');

  if (bracketIndex <= 0) {
    return line;
  }

  const identifier = definition.slice(0, bracketIndex).trim();
  const suffix = definition.slice(bracketIndex);

  if (/^[A-Za-z0-9_]+$/.test(identifier)) {
    return line;
  }

  return `${prefix} ${sanitizeIdentifier(identifier)}${suffix}`;
}

function stripListPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, '');
}

function isLikelyMermaidLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  return (
    MERMAID_START_PATTERN.test(trimmed)
    || /^\s*%%/.test(trimmed)
    || /^\s*subgraph\b/i.test(trimmed)
    || /^\s*end\s*$/i.test(trimmed)
    || /^\s*(direction|classDef|class|style|linkStyle|click)\b/i.test(trimmed)
    || MERMAID_EDGE_PATTERN.test(trimmed)
    || /^\s*[A-Za-z0-9_]+\s*[[({]/.test(trimmed)
  );
}

function splitTopLevelTargets(targets: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (const character of targets) {
    if (character === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += character;
      continue;
    }

    if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += character;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (character === '(') {
        parenDepth += 1;
      } else if (character === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      } else if (character === '[') {
        bracketDepth += 1;
      } else if (character === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      } else if (character === '{') {
        braceDepth += 1;
      } else if (character === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (character === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
        continue;
      }
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function expandCommaSeparatedEdges(line: string): string[] {
  const match = line.match(/^(\s*.+?)\s+(-->|==>|-\.->)\s*(\|[^|]+\|\s*)?(.+)$/);

  if (!match) {
    return [line];
  }

  const [, source, arrow, label = '', rawTargets] = match;
  const targets = splitTopLevelTargets(rawTargets);

  if (targets.length <= 1) {
    return [
      `${normalizeEndpoint(source)} ${arrow} ${label}${normalizeEndpoint(rawTargets)}`.trimEnd(),
    ];
  }

  return targets.map((target) => `${normalizeEndpoint(source)} ${arrow} ${label}${normalizeEndpoint(target)}`.trimEnd());
}

export function normalizeMermaidDiagram(code: string): string {
  const sanitizedLines = code
    .replace(/```mermaid\s*/gi, '')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => stripListPrefix(line.replace(/\t/g, '    ')));

  const startIndex = sanitizedLines.findIndex((line) => MERMAID_START_PATTERN.test(line.trim()));
  const relevantLines = startIndex >= 0 ? sanitizedLines.slice(startIndex) : sanitizedLines;

  const normalizedLines = relevantLines
    .filter((line) => isLikelyMermaidLine(line))
    .map((line) => normalizeSubgraphLine(line))
    .flatMap((line) => expandCommaSeparatedEdges(line));

  const normalizedDiagram = normalizedLines.join('\n').trim();

  if (!normalizedDiagram) {
    return 'graph TB';
  }

  if (!MERMAID_START_PATTERN.test(normalizedLines[0]?.trim() ?? '')) {
    return `graph TB\n${normalizedDiagram}`;
  }

  return normalizedDiagram;
}