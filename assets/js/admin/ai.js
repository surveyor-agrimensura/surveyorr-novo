(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const form = $('adminAiForm');
  if (!form) return;

  const auth = window.GeoRuralAuth;
  const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
  const MAX_IMAGE_OUTPUT_BYTES = Math.round(1.2 * 1024 * 1024);
  const conversation = [];
  let attachment = null;
  let recognition = null;
  let dictationActive = false;
  let dictationBaseText = '';
  let dictationFinalText = '';
  let dictationRestartTimer = null;

  function setConfig(text, state = '') {
    const node = $('adminAiConfig');
    if (!node) return;
    node.textContent = text;
    node.className = `admin-ai-config ${state}`.trim();
  }

  function inlineNodes(text) {
    const fragment = document.createDocumentFragment();
    const source = String(text || '');
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let index = 0;
    for (const match of source.matchAll(regex)) {
      if (match.index > index) fragment.append(document.createTextNode(source.slice(index, match.index)));
      const token = match[0];
      if (token.startsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = token.slice(2, -2);
        fragment.append(strong);
      } else {
        const code = document.createElement('code');
        code.textContent = token.slice(1, -1);
        fragment.append(code);
      }
      index = match.index + token.length;
    }
    if (index < source.length) fragment.append(document.createTextNode(source.slice(index)));
    return fragment;
  }

  function parseMarkdownTableCells(line) {
    let value = String(line || '').trim();
    if (!value.includes('|')) return null;
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    const cells = [];
    let current = '';
    let escaped = false;
    let inlineCode = false;
    for (const char of value) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '`') {
        inlineCode = !inlineCode;
        current += char;
        continue;
      }
      if (char === '|' && !inlineCode) {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells.length >= 2 ? cells : null;
  }

  function isMarkdownTableSeparator(line) {
    const cells = parseMarkdownTableCells(line);
    return Boolean(cells?.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim())));
  }

  function sectionClassFromTitle(title) {
    const value = String(title || '').toLocaleLowerCase('pt-BR');
    if (/alerta|risco|aten[cç][aã]o/.test(value)) return 'alert';
    if (/a[cç][aã]o|recomenda|pr[oó]ximo passo/.test(value)) return 'actions';
    if (/achado|usu[aá]rio|resultado|detalhe/.test(value)) return 'findings';
    if (/resumo|vis[aã]o geral/.test(value)) return 'summary';
    return 'default';
  }

  function normalizedTableValue(value) {
    const text = String(value ?? '').trim();
    const lower = text.toLocaleLowerCase('pt-BR');
    const translations = new Map([
      ['null', 'Não informado'],
      ['undefined', 'Não informado'],
      ['n/a', 'Não informado'],
      ['active', 'Ativo'],
      ['inactive', 'Inativo'],
      ['blocked', 'Bloqueado'],
      ['complete', 'Completo'],
      ['incomplete', 'Incompleto'],
      ['true', 'Sim'],
      ['false', 'Não']
    ]);
    return translations.get(lower) || text || '—';
  }

  function appendTableCellContent(cell, value) {
    const normalized = normalizedTableValue(value);
    const lower = normalized.toLocaleLowerCase('pt-BR');
    if (['ativo', 'completo', 'sim', 'ok', 'publicada'].includes(lower)) {
      const badge = document.createElement('span');
      badge.className = 'admin-ai-table-badge positive';
      badge.textContent = normalized;
      cell.append(badge);
      return;
    }
    if (['inativo', 'incompleto', 'não informado', '—'].includes(lower)) {
      const badge = document.createElement('span');
      badge.className = 'admin-ai-table-badge neutral';
      badge.textContent = normalized;
      cell.append(badge);
      return;
    }
    if (['bloqueado', 'vencido', 'erro', 'falha'].includes(lower)) {
      const badge = document.createElement('span');
      badge.className = 'admin-ai-table-badge danger';
      badge.textContent = normalized;
      cell.append(badge);
      return;
    }
    cell.append(inlineNodes(normalized));
  }

  function createMarkdownTable(headerCells, bodyRows) {
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-ai-table-wrap';
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Tabela da resposta da IA');
    wrapper.tabIndex = 0;
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerCells.forEach((value) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.append(inlineNodes(normalizedTableValue(value)));
      headerRow.append(th);
    });
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    bodyRows.forEach((row) => {
      const tr = document.createElement('tr');
      headerCells.forEach((_, index) => {
        const td = document.createElement('td');
        td.dataset.label = normalizedTableValue(headerCells[index]);
        appendTableCellContent(td, row[index] ?? '—');
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
  }

  function renderMarkdownSafe(markdown) {
    const root = document.createElement('div');
    root.className = 'admin-ai-rich';
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let container = root;
    let list = null;
    let listType = '';
    let code = null;
    let paragraph = [];

    const append = (node) => container.append(node);
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const p = document.createElement('p');
      p.append(inlineNodes(paragraph.join(' ')));
      append(p);
      paragraph = [];
    };
    const flushList = () => { list = null; listType = ''; };
    const openSection = (title) => {
      flushParagraph();
      flushList();
      const section = document.createElement('section');
      section.className = `admin-ai-section ${sectionClassFromTitle(title)}`;
      const h2 = document.createElement('h2');
      h2.append(inlineNodes(title));
      section.append(h2);
      root.append(section);
      container = section;
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim().startsWith('```')) {
        flushParagraph();
        flushList();
        if (code) {
          append(code);
          code = null;
        } else {
          code = document.createElement('pre');
          const inner = document.createElement('code');
          code.append(inner);
        }
        continue;
      }
      if (code) {
        code.firstChild.textContent += `${line}\n`;
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      const headerCells = parseMarkdownTableCells(trimmed);
      if (headerCells && isMarkdownTableSeparator(lines[index + 1] || '')) {
        flushParagraph();
        flushList();
        const bodyRows = [];
        index += 2;
        while (index < lines.length) {
          const rowText = lines[index].trim();
          const rowCells = parseMarkdownTableCells(rowText);
          if (!rowText || !rowCells || isMarkdownTableSeparator(rowText)) break;
          bodyRows.push(rowCells);
          index += 1;
        }
        index -= 1;
        append(createMarkdownTable(headerCells, bodyRows));
        continue;
      }

      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        if (heading[1].length <= 2) {
          openSection(heading[2]);
        } else {
          flushParagraph();
          flushList();
          const h = document.createElement(heading[1].length === 3 ? 'h3' : 'h4');
          h.append(inlineNodes(heading[2]));
          append(h);
        }
        continue;
      }

      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushParagraph();
        flushList();
        append(document.createElement('hr'));
        continue;
      }

      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        flushParagraph();
        const nextType = bullet ? 'ul' : 'ol';
        if (!list || listType !== nextType) {
          list = document.createElement(nextType);
          listType = nextType;
          append(list);
        }
        const li = document.createElement('li');
        li.append(inlineNodes((bullet || numbered)[1]));
        list.append(li);
        continue;
      }

      if (trimmed.startsWith('> ')) {
        flushParagraph();
        flushList();
        const quote = document.createElement('blockquote');
        quote.append(inlineNodes(trimmed.slice(2)));
        append(quote);
        continue;
      }

      paragraph.push(trimmed);
    }
    flushParagraph();
    if (code) append(code);
    return root;
  }

  function appendMessage(role, content, options = {}) {
    const box = $('adminAiMessages');
    if (!box) return null;
    const article = document.createElement('article');
    article.className = `${role === 'user' ? 'user' : 'assistant'}${options.loading ? ' admin-ai-loading' : ''}`;
    const avatar = document.createElement('div');
    avatar.className = 'admin-ai-avatar';
    avatar.textContent = role === 'user' ? 'EU' : 'IA';
    const bubble = document.createElement('div');
    bubble.className = 'admin-ai-bubble';
    const header = document.createElement('header');
    const title = document.createElement('b');
    title.textContent = role === 'user' ? 'Você' : 'Assistente administrativo';
    header.append(title);
    if (options.meta) { const small = document.createElement('small'); small.textContent = options.meta; header.append(small); }
    if (role !== 'user' && !options.loading) {
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'admin-ai-copy'; copy.textContent = 'Copiar';
      copy.addEventListener('click', async () => { await navigator.clipboard?.writeText(String(content || '')); copy.textContent = 'Copiado'; setTimeout(() => { copy.textContent = 'Copiar'; }, 1200); });
      header.append(copy);
    }
    bubble.append(header, renderMarkdownSafe(content));
    if (options.imageDataUrl) { const img = document.createElement('img'); img.className = 'admin-ai-user-image'; img.src = options.imageDataUrl; img.alt = options.imageName || 'Imagem enviada'; bubble.append(img); }
    article.append(avatar, bubble);
    box.append(article);
    box.scrollTop = box.scrollHeight;
    return article;
  }

  function bytesFromDataUrl(dataUrl) {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    return Math.floor(base64.length * 0.75);
  }

  async function imageFromFile(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('Use uma imagem PNG, JPEG ou WEBP.');
    if (file.size > MAX_IMAGE_INPUT_BYTES) throw new Error('A imagem original deve ter no máximo 8 MB.');
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Não foi possível abrir a imagem.')); img.src = objectUrl;
      });
      const maxSide = 1280;
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      let quality = .88;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (bytesFromDataUrl(dataUrl) > MAX_IMAGE_OUTPUT_BYTES && quality > .56) {
        quality -= .07;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (bytesFromDataUrl(dataUrl) > MAX_IMAGE_OUTPUT_BYTES) throw new Error('A imagem continua muito grande depois da otimização.');
      const safeName = String(file.name || 'imagem').replace(/\.[^.]+$/, '').slice(0, 110) + '.jpg';
      return { name: safeName, mimeType: 'image/jpeg', dataUrl, bytes: bytesFromDataUrl(dataUrl), width, height };
    } finally { URL.revokeObjectURL(objectUrl); }
  }

  function showAttachment(value) {
    attachment = value || null;
    const bar = $('adminAiAttachmentBar');
    if (!bar) return;
    bar.classList.toggle('hidden', !attachment);
    if (!attachment) return;
    $('adminAiAttachmentPreview').src = attachment.dataUrl;
    $('adminAiAttachmentName').textContent = attachment.name;
    $('adminAiAttachmentMeta').textContent = `${attachment.width}×${attachment.height} · ${(attachment.bytes / 1024).toFixed(0)} KB`;
  }

  function joinDictationParts(...parts) {
    return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function updateMicButton(active) {
    const button = $('adminAiMicBtn');
    if (!button) return;
    button.classList.toggle('recording', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.innerHTML = active
      ? '<span aria-hidden="true">■</span> Parar ditado'
      : '<span aria-hidden="true">●</span> Ditar';
  }

  function writeDictation(interimText = '') {
    const field = $('adminAiQuestion');
    if (!field) return;
    field.value = joinDictationParts(dictationBaseText, dictationFinalText, interimText);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    field.setSelectionRange?.(field.value.length, field.value.length);
  }

  function stopBrowserDictation(message = 'Ditado concluído. Revise o texto e envie quando estiver pronto.') {
    dictationActive = false;
    clearTimeout(dictationRestartTimer);
    dictationRestartTimer = null;
    const current = recognition;
    recognition = null;
    try { current?.stop?.(); } catch {}
    updateMicButton(false);
    const status = $('adminAiVoiceStatus');
    if (status) status.textContent = message;
  }

  function speechRecognitionErrorMessage(code = '') {
    const value = String(code || '').toLowerCase();
    if (value === 'not-allowed' || value === 'service-not-allowed') return 'Permita o uso do microfone no navegador para usar o ditado.';
    if (value === 'audio-capture') return 'Nenhum microfone disponível foi encontrado.';
    if (value === 'network') return 'O serviço de reconhecimento de voz do navegador está indisponível.';
    if (value === 'language-not-supported') return 'O navegador não oferece reconhecimento em português do Brasil.';
    return 'Não foi possível continuar o ditado por voz.';
  }

  function createBrowserRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) throw new Error('O ditado por voz não é compatível com este navegador. Use Chrome ou Edge atualizado.');
    const instance = new SpeechRecognition();
    instance.lang = 'pt-BR';
    instance.interimResults = true;
    instance.continuous = true;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      updateMicButton(true);
      const status = $('adminAiVoiceStatus');
      if (status) status.textContent = 'Ouvindo e escrevendo… nenhum arquivo de áudio será enviado ao Surveyor ou ao OpenRouter.';
    };

    instance.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index]?.[0]?.transcript || '').trim();
        if (!transcript) continue;
        if (event.results[index].isFinal) dictationFinalText = joinDictationParts(dictationFinalText, transcript);
        else interim = joinDictationParts(interim, transcript);
      }
      writeDictation(interim);
    };

    instance.onerror = (event) => {
      const code = String(event?.error || '');
      if (code === 'no-speech' && dictationActive) {
        const status = $('adminAiVoiceStatus');
        if (status) status.textContent = 'Aguardando sua fala…';
        return;
      }
      stopBrowserDictation(speechRecognitionErrorMessage(code));
    };

    instance.onend = () => {
      recognition = null;
      if (!dictationActive) {
        updateMicButton(false);
        return;
      }
      dictationBaseText = String($('adminAiQuestion')?.value || '').trim();
      dictationFinalText = '';
      dictationRestartTimer = setTimeout(() => {
        if (!dictationActive) return;
        try {
          recognition = createBrowserRecognition();
          recognition.start();
        } catch (error) {
          stopBrowserDictation(error.message || 'Não foi possível retomar o ditado.');
        }
      }, 250);
    };
    return instance;
  }

  function toggleBrowserDictation() {
    if (dictationActive) {
      stopBrowserDictation();
      return;
    }
    dictationBaseText = String($('adminAiQuestion')?.value || '').trim();
    dictationFinalText = '';
    dictationActive = true;
    recognition = createBrowserRecognition();
    recognition.start();
  }

  async function ask(question) {
    const text = String(question || '').trim();
    if (!text && !attachment) return;
    const sentAttachment = attachment;
    appendMessage('user', text || 'Analise a imagem anexada.', { imageDataUrl: sentAttachment?.dataUrl, imageName: sentAttachment?.name });
    conversation.push({ role: 'user', content: text || 'Analise a imagem anexada.' });
    const submit = $('adminAiSubmit'); const field = $('adminAiQuestion');
    submit.disabled = true; field.disabled = true; $('adminAiAttachBtn').disabled = true; $('adminAiMicBtn').disabled = true;
    const loading = appendMessage('assistant', sentAttachment ? 'Analisando a imagem e os dados administrativos atuais…' : 'Analisando os dados administrativos atuais…', { loading: true });
    try {
      const data = await auth.apiFetch('/api/admin/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ question: text || 'Analise a imagem anexada e relacione-a com a administração do Surveyor.', image: sentAttachment ? { name: sentAttachment.name, mimeType: sentAttachment.mimeType, dataUrl: sentAttachment.dataUrl } : null, history: conversation.slice(-10) }),
        timeoutMs: sentAttachment ? 75_000 : 55_000
      });
      loading?.remove();
      const answer = data.answer || 'A IA não retornou conteúdo.';
      appendMessage('assistant', answer, { meta: data.model ? `Modelo: ${data.model}` : '' });
      conversation.push({ role: 'assistant', content: answer });
      field.value = ''; showAttachment(null); $('adminAiImageInput').value = '';
      setConfig(`OpenRouter configurado · modelo: ${data.model || 'automático'}${data.imageProcessed ? ' · imagem analisada' : ''}`, 'ok');
    } catch (error) {
      loading?.remove(); appendMessage('assistant', `## Não foi possível concluir\n\n${error.message || 'Falha ao consultar a IA.'}\n\n- Verifique a configuração do OpenRouter.\n- Tente novamente sem o anexo, se a falha estiver relacionada ao modelo visual.`);
      setConfig(error.message || 'Falha ao consultar a IA.', 'error');
    } finally {
      submit.disabled = false; field.disabled = false; $('adminAiAttachBtn').disabled = false; $('adminAiMicBtn').disabled = false; field.focus();
    }
  }

  $('adminAiAttachBtn')?.addEventListener('click', () => $('adminAiImageInput')?.click());
  $('adminAiImageInput')?.addEventListener('change', async (event) => {
    try { const file = event.target.files?.[0]; if (!file) return; setConfig('Otimizando imagem…'); showAttachment(await imageFromFile(file)); setConfig('Imagem pronta para análise.', 'ok'); }
    catch (error) { showAttachment(null); event.target.value = ''; setConfig(error.message || 'Não foi possível anexar a imagem.', 'error'); }
  });
  $('adminAiRemoveAttachment')?.addEventListener('click', () => { showAttachment(null); $('adminAiImageInput').value = ''; });
  $('adminAiMicBtn')?.addEventListener('click', () => {
    try { toggleBrowserDictation(); }
    catch (error) {
      stopBrowserDictation(error.message || 'Não foi possível iniciar o ditado.');
      setConfig(error.message || 'Falha no ditado do navegador.', 'error');
    }
  });
  $('adminAiClear')?.addEventListener('click', () => {
    conversation.splice(0); const box = $('adminAiMessages'); if (box) box.innerHTML = ''; appendMessage('assistant', '## Nova conversa\n\nOs dados serão consultados novamente na próxima pergunta.'); showAttachment(null); $('adminAiQuestion').value = '';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (dictationActive) stopBrowserDictation('Ditado encerrado. Enviando o texto para análise…');
    ask($('adminAiQuestion')?.value);
  });
  $('adminAiQuestion')?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.querySelectorAll('[data-ai-question]').forEach((button) => button.addEventListener('click', () => ask(button.dataset.aiQuestion)));
  window.addEventListener('beforeunload', () => { dictationActive = false; clearTimeout(dictationRestartTimer); try { recognition?.abort?.(); } catch {} });
  $('adminAiVoiceStatus').textContent = 'Ditado do navegador: nenhum arquivo de áudio é enviado ao Surveyor ou ao OpenRouter.';
  setConfig('OpenRouter disponível quando a chave estiver configurada na API.');
})();
