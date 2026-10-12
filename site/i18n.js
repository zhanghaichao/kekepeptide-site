'use strict';
// Translate text nodes and presentation attributes only. Product data, URLs,
// identifiers and user-entered values remain unchanged when switching language.
window.I18n = (() => {
  const supported = ['en', 'de', 'fr', 'es', 'it', 'pl', 'nl', 'pt'];
  let language = 'en', dictionaries = {};
  try { const saved = localStorage.getItem('keke-language'); if (supported.includes(saved)) language = saved; } catch {}
  const originals = new WeakMap();
  const attributes = new WeakMap();
  let titleOriginal = '', titleRendered = '';
  function translate(text) {
    const dict = dictionaries[language] || {};
    if (language === 'en') return text;
    if (dict[text]) return dict[text];
    const count = text.match(/^(\d+) products?$/);
    if (count) {
      const plural = new Intl.PluralRules(language).select(Number(count[1]));
      return `${count[1]} ${dict[plural === 'one' ? 'product' : plural === 'few' ? 'productsFew' : 'products']}`;
    }
    // Keep original research names and numeric specifications intact.
    let result = text;
    for (const prefix of ['Specification:', 'Batch:', 'Product photograph unavailable for']) {
      if (result.startsWith(prefix + ' ')) result = dict[prefix] + result.slice(prefix.length);
    }
    for (const suffix of ['product photograph', 'image unavailable']) {
      if (result.endsWith(' ' + suffix)) result = result.slice(0, -suffix.length) + dict[suffix];
    }
    if (result.endsWith(' ·')) result = translate(result.slice(0, -2)) + ' ·';
    if (result.endsWith(' ↗')) result = translate(result.slice(0, -2)) + ' ↗';
    result = result.replace(/\bvials\b/g, dict.vials || 'vials');
    return result;
  }
  function textValue(value) {
    const trimmed = value.trim();
    return trimmed ? value.replace(trimmed, () => translate(trimmed)) : value;
  }
  function apply(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('script,style,noscript,textarea,#languageSelect')) continue;
      const previous = originals.get(node);
      const source = previous && node.nodeValue === previous.rendered ? previous.source : node.nodeValue;
      const rendered = textValue(source);
      originals.set(node, {source, rendered});
      if (node.nodeValue !== rendered) node.nodeValue = rendered;
    }
    const elements = [root, ...root.querySelectorAll('[aria-label],[alt],[placeholder],[title]')];
    for (const el of elements) {
      if (!el.getAttribute || el.closest('#languageSelect option')) continue;
      const history = attributes.get(el) || {};
      for (const attr of ['aria-label', 'alt', 'placeholder', 'title']) {
        if (!el.hasAttribute(attr)) continue;
        const current = el.getAttribute(attr), old = history[attr];
        const source = old && current === old.rendered ? old.source : current;
        const rendered = translate(source);
        history[attr] = {source, rendered};
        if (current !== rendered) el.setAttribute(attr, rendered);
      }
      attributes.set(el, history);
    }
    document.documentElement.lang = language;
    if (document.title !== titleRendered) titleOriginal = document.title;
    titleRendered = titleOriginal.split(' | ').map(translate).join(' | ');
    document.title = titleRendered;
    const select = document.getElementById('languageSelect');
    if (select) select.value = language;
  }
  async function init() {
    try {
      const response = await fetch('data/translations.json?v=5', {cache:'no-cache'});
      if (!response.ok) throw new Error('Translation data unavailable');
      dictionaries = await response.json();
    } catch {
      language = 'en';
      const status = document.getElementById('languageStatus');
      status.textContent = 'Translations could not load. Refresh to try again.';
      status.hidden = false;
      document.getElementById('languageSelect').disabled = true;
    }
    document.getElementById('languageSelect').addEventListener('change', event => {
      if (!supported.includes(event.target.value)) return;
      language = event.target.value;
      try { localStorage.setItem('keke-language', language); } catch {}
      apply();
    });
    apply();
  }
  return {init, apply, translate, get language() { return language; }};
})();
