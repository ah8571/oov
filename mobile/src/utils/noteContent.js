const escapeHtml = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const applyInlineFormatting = (value) => {
  return String(value || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<u>$1</u>');
};

export const looksLikeHtml = (value) => /<\/?[a-z][\s\S]*>/i.test(String(value || ''));

const decodeHtmlEntities = (value) => {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeComparisonText = (value) => {
  return decodeHtmlEntities(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const stripLeadingTitleHeading = (html, title) => {
  const normalizedTitle = normalizeComparisonText(title);

  if (!html || !normalizedTitle) {
    return html;
  }

  const leadingHeadingMatch = String(html).match(/^\s*<h1>([\s\S]*?)<\/h1>\s*/i);

  if (!leadingHeadingMatch) {
    return html;
  }

  const headingText = normalizeComparisonText(leadingHeadingMatch[1]);

  if (headingText !== normalizedTitle) {
    return html;
  }

  return String(html).replace(/^\s*<h1>[\s\S]*?<\/h1>\s*/i, '').trim();
};

export const convertMarkdownishToHtml = (value) => {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    html.push(`<p>${applyInlineFormatting(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType) {
      return;
    }

    html.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(3, headingMatch[1].length);
      html.push(`<h${level}>${applyInlineFormatting(headingMatch[2])}</h${level}>`);
      continue;
    }

    const checklistMatch = line.match(/^\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      flushParagraph();
      if (listType !== 'checklist') {
        flushList();
        listType = 'checklist';
        html.push('<ul class="emmaline-checklist">');
      }
      const checked = checklistMatch[1].toLowerCase() === 'x' ? ' checked' : '';
      const itemText = applyInlineFormatting(checklistMatch[2]);
      html.push(`<li><input type="checkbox" class="emmaline-checkbox"${checked} /><span class="emmaline-checkbox-label">${itemText}</span></li>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${applyInlineFormatting(bulletMatch[1])}</li>`);
      continue;
    }

    const numberMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${applyInlineFormatting(numberMatch[1])}</li>`);
      continue;
    }

    flushList();
    paragraph.push(applyInlineFormatting(escapeHtml(line)));
  }

  flushParagraph();
  flushList();

  return html.join('');
};

export const convertImportedHtmlToPlainText = (value) => {
  const raw = String(value || '');

  if (!raw) {
    return '';
  }

  return raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|ul|ol|blockquote|section|article|tr|table)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const normalizeNoteContentToHtml = (value, options = {}) => {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (looksLikeHtml(raw)) {
    return stripLeadingTitleHeading(raw, options.title);
  }

  return stripLeadingTitleHeading(convertMarkdownishToHtml(raw), options.title);
};

export const normalizeImportedNoteContentToHtml = (value, options = {}) => {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const normalizedSource = looksLikeHtml(raw)
    ? convertImportedHtmlToPlainText(raw)
    : raw;

  return stripLeadingTitleHeading(convertMarkdownishToHtml(normalizedSource), options.title);
};

export const stripNoteContentToPlainText = (value) => {
  const raw = String(value || '');

  if (!raw) {
    return '';
  }

  const withoutTags = raw
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return withoutTags
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};