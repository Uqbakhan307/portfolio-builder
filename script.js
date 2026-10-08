/* DevNest: all tools and portfolio processing stay on this device. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const modal = $('#tool-modal');
  const content = $('#tool-content');
  const toolFeedback = $('#tool-feedback');
  const form = $('#portfolio-form');
  const STORE_KEY = 'devnest-portfolio-v2';
  const fields = ['name','title','about','skills','phone','whatsapp','email','github','linkedin','theme'];
  const toolDetails = {
    json:['JSON formatter','Paste JSON to validate, format, or compact it.'],
    regex:['Regex tester','Test a JavaScript regular expression against your sample text.'],
    color:['Color picker','Choose a base color and make a five-step palette.'],
    password:['Password maker','Generate a strong random password locally.'],
    counter:['Word counter','Live counts for words, characters, and lines.'],
    base64:['Base64 helper','Encode or decode text without breaking Unicode.'],
    image:['Image sizer','Resize and compress an image locally in your browser.']
  };
  let lastFocus = null;
  let imageUrl = null;
  let profileImage = '';
  let projectImages = {};
  let projectIndex = 0;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeUrl(value, addScheme = false) {
    let raw = String(value || '').trim();
    if (!raw) return '';
    if (addScheme && !/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = `https://${raw}`;
    try {
      const parsed = new URL(raw);
      return ['https:','http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) { return ''; }
  }
  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
  function validPhone(value) { return /^\+?[\d\s().-]{7,20}$/.test(String(value || '').trim()) && String(value).replace(/\D/g,'').length >= 7; }
  function phoneHref(value) { return validPhone(value) ? `tel:${String(value).trim().replace(/[^\d+]/g,'')}` : ''; }
  function currentData() {
    const data = {};
    fields.forEach(key => { data[key] = form.elements.namedItem(key)?.value || ''; });
    data.photo = profileImage;
    data.projects = $$('.project-editor', $('#projects-list')).map(card => ({
      id: card.dataset.projectId,
      title: $('[data-project-field="title"]', card).value,
      description: $('[data-project-field="description"]', card).value,
      link: $('[data-project-field="link"]', card).value,
      image: projectImages[card.dataset.projectId] || ''
    }));
    return data;
  }
  function feedback(message, error = false) {
    const node = $('#portfolio-feedback');
    node.textContent = message;
    node.classList.toggle('error', error);
  }
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(currentData()));
      feedback('Saved on this device.');
    } catch (error) {
      // Quota errors are common with large photos; preserve the in-memory preview and explain the limitation.
      feedback(error?.name === 'QuotaExceededError' ? 'Could not save: browser storage is full. Try smaller photos or remove some images.' : 'Could not save to this browser. Your current edits remain visible until you leave.', true);
    }
  }
  function projectMarkup(project = {}, id = `project-${projectIndex++}`, position = null) {
    const node = document.createElement('div');
    node.className = 'project-editor';
    node.dataset.projectId = project.id || id;
    projectImages[node.dataset.projectId] = project.image || '';
    const label = position || $$('.project-editor', $('#projects-list')).length + 1;
    node.innerHTML = `<h5>PROJECT ${String(label).padStart(2,'0')}</h5><button class="remove-project" type="button" aria-label="Remove project ${label}" data-testid="remove-project">Remove</button>
      <div class="field"><label>Project title</label><input data-project-field="title" maxlength="120" value="${escapeHTML(project.title || '')}" placeholder="A useful little app"></div>
      <div class="field"><label>Description</label><textarea data-project-field="description" maxlength="700" placeholder="What did you build?">${escapeHTML(project.description || '')}</textarea></div>
      <div class="field"><label>Project link</label><input data-project-field="link" type="url" value="${escapeHTML(project.link || '')}" placeholder="example.com/project"></div>
      <div class="field"><label>Project image (optional)</label><input data-project-field="image" type="file" accept="image/*" aria-label="Upload image for project ${label}"><span class="field-hint">JPEG, scaled to 900px maximum.</span></div>`;
    return node;
  }
  function addProject(project = {}) {
    const node = projectMarkup(project);
    $('#projects-list').append(node);
    updateProjectLabels();
  }
  function updateProjectLabels() {
    $$('.project-editor', $('#projects-list')).forEach((node, index) => {
      const n = index + 1;
      $('h5', node).textContent = `PROJECT ${String(n).padStart(2,'0')}`;
      $('.remove-project', node).setAttribute('aria-label', `Remove project ${n}`);
    });
  }
  function getContactLinks(data) {
    const links = [];
    const call = phoneHref(data.phone);
    if (call) links.push(['Call', call]);
    const whatsappDigits = String(data.whatsapp || '').replace(/\D/g,'');
    if (whatsappDigits.length >= 7 && validPhone(data.whatsapp)) links.push(['WhatsApp', `https://wa.me/${whatsappDigits}`]);
    if (validEmail(data.email)) links.push(['Email', `mailto:${data.email.trim()}`]);
    const github = safeUrl(data.github, true); if (github) links.push(['GitHub',github]);
    const linkedin = safeUrl(data.linkedin, true); if (linkedin) links.push(['LinkedIn',linkedin]);
    return links;
  }
  function renderPortfolio() {
    const data = currentData();
    const themeClass = data.theme === 'dark' ? 'theme-dark' : data.theme === 'gold' ? 'theme-gold' : '';
    const skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    const projects = data.projects.filter(project => project.title.trim());
    const photo = data.photo ? `<img src="${escapeHTML(data.photo)}" alt="Portrait of ${escapeHTML(data.name || 'portfolio owner')}">` : `<span class="pv-initial" aria-hidden="true">${escapeHTML((data.name || 'Y').trim().slice(0,1).toUpperCase())}</span>`;
    const projectCards = projects.map(project => {
      const href = safeUrl(project.link, true);
      const image = project.image ? `<img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)} project preview">` : '';
      return `<article class="pv-project">${image}<h4>${escapeHTML(project.title)}</h4><p>${escapeHTML(project.description)}</p>${href ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">View project ↗</a>` : ''}</article>`;
    }).join('');
    const links = getContactLinks(data).map(([label, href]) => {
      const external = /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHTML(href)}"${external}>${label}</a>`;
    }).join('');
    const preview = $('#portfolio-preview');
    preview.className = `preview-sheet ${themeClass}`;
    preview.innerHTML = `<div class="pv-hero"><div class="pv-arch">${photo}</div><div><span class="section-kicker">HELLO, I'M</span><h2>${escapeHTML(data.name || 'Your name')}</h2><div class="pv-title">${escapeHTML(data.title || 'Your professional title')}</div></div></div><p>${escapeHTML(data.about || 'A short introduction about you will appear here.')}</p><div class="pv-skills">${skills.map(skill => `<span class="pv-chip">${escapeHTML(skill)}</span>`).join('')}</div><h3>Selected work</h3><div class="pv-project-grid">${projectCards || '<p class="field-hint">Add a project to see it here.</p>'}</div><div class="pv-contact"><h3>Say hello</h3><nav class="pv-links" aria-label="Portfolio contact links">${links || '<span class="field-hint">Your contact buttons will appear here.</span>'}</nav></div>`;
  }
  function normalizeURLFields() {
    ['github','linkedin'].forEach(name => {
      const input = form.elements.namedItem(name);
      if (input.value.trim() && !/^[a-z][a-z\d+.-]*:/i.test(input.value.trim())) input.value = `https://${input.value.trim()}`;
    });
    $$('.project-editor', $('#projects-list')).forEach(card => {
      const input = $('[data-project-field="link"]', card);
      if (input.value.trim() && !/^[a-z][a-z\d+.-]*:/i.test(input.value.trim())) input.value = `https://${input.value.trim()}`;
    });
    validateFields();
  }
  function validateFields() {
    const email = form.elements.namedItem('email');
    email.setCustomValidity(email.value && !validEmail(email.value) ? 'Enter a valid email address.' : '');
    ['phone','whatsapp'].forEach(key => {
      const field = form.elements.namedItem(key);
      field.setCustomValidity(field.value && !validPhone(field.value) ? 'Enter a valid phone number with at least 7 digits.' : '');
    });
    ['github','linkedin'].forEach(key => {
      const field = form.elements.namedItem(key);
      field.setCustomValidity(field.value && !safeUrl(field.value) ? 'Use a valid http or https URL.' : '');
    });
    $$('.project-editor', $('#projects-list')).forEach(card => {
      const field = $('[data-project-field="link"]', card);
      field.setCustomValidity(field.value && !safeUrl(field.value) ? 'Use a valid http or https URL.' : '');
    });
  }
  function loadSaved() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
    catch (_) { feedback('Saved portfolio data could not be read. It may be damaged.', true); return; }
    if (!saved || typeof saved !== 'object') { addProject(); return; }
    fields.forEach(key => { if (typeof saved[key] === 'string' && form.elements.namedItem(key)) form.elements.namedItem(key).value = saved[key]; });
    profileImage = typeof saved.photo === 'string' ? saved.photo : '';
    $('#projects-list').replaceChildren();
    (Array.isArray(saved.projects) ? saved.projects : []).forEach(project => addProject(project));
    if (!saved.projects?.length) addProject();
    renderPortfolio();
    feedback('Your saved portfolio is back.');
  }
  function canvasJpeg(file, maxEdge, quality = .84) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth,image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f3ede4'; ctx.fillRect(0,0,width,height); ctx.drawImage(image,0,0,width,height);
        URL.revokeObjectURL(objectUrl);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); }
        catch (error) { reject(error); }
      };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('That image could not be opened.')); };
      image.src = objectUrl;
    });
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportedPortfolio(data) {
    const skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    const projects = data.projects.filter(p => p.title.trim());
    const color = data.theme === 'dark'
      ? {bg:'#202d2c',card:'#2b3a38',ink:'#f0e8dc',muted:'#b2c0b8',accent:'#82b9ae',chip:'#314c47'}
      : data.theme === 'gold'
        ? {bg:'#f1e4c9',card:'#fbf3e2',ink:'#49391f',muted:'#796c55',accent:'#a87525',chip:'#ead2a1'}
        : {bg:'#f3ede4',card:'#f8f3eb',ink:'#263c3a',muted:'#687774',accent:'#1f5f63',chip:'#d6e4dd'};
    const contact = getContactLinks(data).map(([label,href]) => {
      const external = /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${escapeHTML(href)}"${external}>${label}</a>`;
    }).join('');
    const projectHtml = projects.map(project => {
      const href = safeUrl(project.link, true);
      const image = project.image ? `<img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.title)} project image">` : '';
      return `<article class="project">${image}<h2>${escapeHTML(project.title)}</h2><p>${escapeHTML(project.description)}</p>${href ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">View project ↗</a>` : ''}</article>`;
    }).join('');
    const photo = data.photo ? `<img class="portrait" src="${escapeHTML(data.photo)}" alt="Portrait of ${escapeHTML(data.name || 'portfolio owner')}">` : `<div class="portrait initial" aria-hidden="true">${escapeHTML((data.name || 'Y').trim().slice(0,1).toUpperCase())}</div>`;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHTML(data.title || 'Developer portfolio')}"><title>${escapeHTML(data.name || 'Portfolio')} — Portfolio</title>
<style>
:root{color-scheme:${data.theme==='dark'?'dark':'light'};--bg:${color.bg};--card:${color.card};--ink:${color.ink};--muted:${color.muted};--accent:${color.accent};--chip:${color.chip};--gold:#e8b04a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 50% 0,#e8b04a20,transparent 45%),var(--bg);color:var(--ink);font:16px/1.65 ui-rounded,"Trebuchet MS",system-ui,sans-serif;padding:32px 18px}main{width:min(980px,100%);margin:4vh auto;padding:clamp(23px,6vw,64px);border-radius:32px;background:var(--card);box-shadow:10px 14px 30px #172a2728,inset 3px 3px 7px #ffffff75}.hero{display:grid;grid-template-columns:180px 1fr;gap:30px;align-items:center}.portrait{width:170px;height:210px;object-fit:cover;object-position:center top;border:8px solid var(--gold);border-bottom:0;border-radius:100px 100px 0 0;box-shadow:0 0 28px #e8b04a70;background:var(--chip)}.initial{display:grid;place-items:center;font-size:4rem;font-weight:900;color:var(--accent)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font:700 .76rem ui-monospace,monospace;color:var(--accent)}h1{font-size:clamp(2.6rem,8vw,5rem);letter-spacing:-.06em;line-height:1.02;margin:10px 0}.title{font-size:1.2rem;color:var(--accent);font-weight:800}.about{max-width:680px;white-space:pre-wrap;color:var(--muted)}h2{font-size:1.2rem}.skills,.links{display:flex;flex-wrap:wrap;gap:9px;margin:22px 0}.skill{border-radius:999px;padding:6px 13px;background:var(--chip);font-size:.86rem;font-weight:700}.projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:17px}.project{padding:17px;border-radius:21px;background:var(--bg);box-shadow:5px 7px 15px #172a2718,inset 2px 2px 5px #ffffff58}.project img{display:block;width:100%;height:175px;object-fit:cover;border-radius:14px;margin-bottom:12px}.project h2{margin:0}.project p{white-space:pre-wrap;color:var(--muted)}a{color:var(--accent);font-weight:800;text-decoration:none}.links a{display:inline-flex;padding:9px 15px;border-radius:999px;background:var(--accent);color:${data.theme==='dark'?'#20302e':'#fff8ec'}}.links{margin-top:18px}section{margin-top:38px}@media(max-width:620px){body{padding:15px 12px}.hero{grid-template-columns:1fr;gap:20px}.portrait{width:140px;height:170px}main{border-radius:24px;padding:24px}.project img{height:150px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
</style></head><body><main><header class="hero">${photo}<div><span class="eyebrow">Hello, I'm</span><h1>${escapeHTML(data.name || 'Your name')}</h1><div class="title">${escapeHTML(data.title || 'Developer')}</div></div></header><p class="about">${escapeHTML(data.about || '')}</p><div class="skills" aria-label="Skills">${skills.map(skill=>`<span class="skill">${escapeHTML(skill)}</span>`).join('')}</div><section><h2>Selected projects</h2><div class="projects">${projectHtml || '<p>New work is on the way.</p>'}</div></section><section><h2>Say hello</h2><nav class="links" aria-label="Contact links">${contact || '<p>Contact details coming soon.</p>'}</nav></section></main></body></html>`;
  }
  function announce(message, error = false) {
    toolFeedback.textContent = message;
    toolFeedback.classList.toggle('error', error);
  }
  function toolMarkup(id) {
    return {
      json:`<label class="field"><span>JSON input</span><textarea id="json-input" spellcheck="false" placeholder='{"hello":"world"}'></textarea></label><div class="tool-actions"><button class="button small" data-action="json-format">Format JSON</button><button class="button secondary small" data-action="json-minify">Minify</button><button class="button secondary small" data-action="json-copy">Copy output</button></div><label class="field"><span>Result</span><textarea id="json-output" data-testid="json-output" spellcheck="false" aria-label="Formatted JSON result"></textarea></label>`,
      regex:`<div class="form-row"><label class="field"><span>Pattern</span><input id="regex-pattern" value="dev\\w*"></label><label class="field"><span>Flags</span><input id="regex-flags" value="gi" maxlength="6"></label></div><label class="field"><span>Test text</span><textarea id="regex-text" placeholder="Paste a sentence to test…"></textarea></label><div class="tool-actions"><button class="button small" data-action="regex-run">Find matches</button></div><div class="result-box" id="regex-result" data-testid="regex-result" aria-live="polite">Matches will appear here.</div>`,
      color:`<div class="form-row"><label class="field"><span>Choose a color</span><input type="color" id="color-input" value="#1f5f63"></label><label class="field"><span>Hex value</span><input id="color-hex" value="#1f5f63"></label></div><div class="tool-actions"><button class="button small" data-action="color-generate">Generate palette</button></div><div class="palette" id="color-palette" data-testid="color-palette" aria-live="polite"></div>`,
      password:`<label class="field"><span>Password length: <output id="password-length-value">20</output></span><input id="password-length" type="range" min="8" max="64" value="20"></label><div class="tool-actions"><label><input type="checkbox" id="password-symbols" checked> Include symbols</label></div><div class="tool-actions"><button class="button small" data-action="password-generate">Generate password</button><button class="button secondary small" data-action="password-copy">Copy</button></div><div class="result-box" id="password-result" data-testid="password-result" aria-live="polite">Your password appears here.</div><p class="notice">Generated using crypto.getRandomValues() on this device.</p>`,
      counter:`<label class="field"><span>Your text</span><textarea id="counter-text" placeholder="Start typing or paste your draft…"></textarea></label><div class="result-box" id="counter-result" data-testid="counter-result" aria-live="polite">0 words · 0 characters · 0 lines</div>`,
      base64:`<label class="field"><span>Text</span><textarea id="base64-input" placeholder="Type text to encode or paste Base64 to decode…"></textarea></label><div class="tool-actions"><button class="button small" data-action="base64-encode">Encode</button><button class="button secondary small" data-action="base64-decode">Decode</button><button class="button secondary small" data-action="base64-copy">Copy result</button></div><label class="field"><span>Result</span><textarea id="base64-output" data-testid="base64-output" aria-label="Base64 result"></textarea></label>`,
      image:`<label class="field"><span>Choose an image (processed only in this browser)</span><input type="file" id="image-file" accept="image/*"></label><img class="image-preview" id="image-preview" data-testid="image-preview" alt="Preview of the selected image" hidden><div class="form-row"><label class="field"><span>Width (px)</span><input id="image-width" type="number" min="1" placeholder="Original"></label><label class="field"><span>Height (px)</span><input id="image-height" type="number" min="1" placeholder="Original"></label></div><label class="field"><span>JPEG quality: <output id="image-quality-value">82%</output></span><input id="image-quality" type="range" min="20" max="100" value="82"></label><p class="notice">Images export as JPEG; transparency appears on a warm paper background.</p><div class="tool-actions"><button class="button small" data-action="image-process" disabled id="image-process">Resize &amp; compress</button><a class="button secondary small" id="image-download" hidden download="devnest-image.jpg">Download image</a></div>`
    }[id];
  }
  function openTool(id, trigger) {
    if (!toolDetails[id]) return;
    lastFocus = trigger;
    $('#tool-title').textContent = toolDetails[id][0];
    $('#tool-description').textContent = toolDetails[id][1];
    content.innerHTML = toolMarkup(id);
    announce('');
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden'; $('.close-modal',modal).focus();
    if (id === 'color') makePalette('#1f5f63');
  }
  function closeTool() {
    modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null; if (lastFocus) lastFocus.focus();
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); announce('Copied to clipboard.'); }
    catch (_) { announce('Clipboard access is unavailable. Select and copy the result instead.',true); }
  }
  function hexRgb(hex) {
    const raw = hex.replace('#','');
    const normalized = raw.length===3 ? raw.split('').map(c=>c+c).join('') : raw;
    if (!/^[\da-f]{6}$/i.test(normalized)) throw new Error('Enter a valid 3- or 6-digit hex color.');
    return [0,2,4].map(i=>parseInt(normalized.slice(i,i+2),16));
  }
  function makePalette(hex) {
    if (!$('#color-input',content)) return;
    try {
      const rgb=hexRgb(hex); const normalized=`#${rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`;
      $('#color-input',content).value=normalized; $('#color-hex',content).value=normalized;
      const colors=[.62,.82,1,1.16,1.34].map(f=>rgb.map(n=>Math.max(0,Math.min(255,Math.round(f<1?n*f:n+(255-n)*(f-1)/.34)))));
      $('#color-palette',content).innerHTML=colors.map(c=>{const code=`#${c.map(n=>n.toString(16).padStart(2,'0')).join('')}`;return `<button type="button" class="swatch" title="Copy ${code}" aria-label="Copy color ${code}" data-color="${code}" style="background:${code}">${code}</button>`}).join('');
      announce('Palette ready. Select a swatch to copy its hex value.');
    } catch(error) { announce(error.message,true); }
  }
  function generatePassword() {
    const length=Number($('#password-length').value), symbols=$('#password-symbols').checked;
    const alphabet=`ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${symbols?'!@#$%&*+-_=.?~':''}`;
    const values=new Uint32Array(length); crypto.getRandomValues(values);
    $('#password-result').textContent=[...values].map(value=>alphabet[value%alphabet.length]).join('');
    announce('A fresh password is ready. Copy it somewhere safe.');
  }
  async function processImage() {
    const file=$('#image-file').files[0]; if(!file) throw new Error('Choose an image first.');
    const image=new Image(), objectUrl=URL.createObjectURL(file);
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('This image could not be opened.'));image.src=objectUrl});
    const width=Math.max(1,Math.min(8000,Number($('#image-width').value)||image.naturalWidth));
    const height=Math.max(1,Math.min(8000,Number($('#image-height').value)||image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--paper');ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);URL.revokeObjectURL(objectUrl);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Number($('#image-quality').value)/100));
    if(!blob) throw new Error('Could not create the compressed image.');
    if(imageUrl) URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(blob);
    $('#image-preview').src=imageUrl;$('#image-preview').hidden=false;
    const link=$('#image-download');link.href=imageUrl;link.hidden=false;
    announce(`Ready: ${width} × ${height}px · ${(blob.size/1024).toFixed(1)} KB. Download when ready.`);
  }
  document.addEventListener('click',async event=>{
    const card=event.target.closest('[data-tool]');if(card)openTool(card.dataset.tool,card);
    if(event.target.closest('.close-modal')||event.target===modal)closeTool();
    const swatch=event.target.closest('[data-color]');if(swatch)await copyText(swatch.dataset.color);
    if(event.target.closest('#add-project')){addProject();persist();renderPortfolio();return}
    const remove=event.target.closest('.remove-project');
    if(remove){const node=remove.closest('.project-editor');delete projectImages[node.dataset.projectId];node.remove();updateProjectLabels();persist();renderPortfolio();return}
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    try {
      if(action==='json-format'||action==='json-minify'){const parsed=JSON.parse($('#json-input').value);$('#json-output').value=JSON.stringify(parsed,null,action==='json-format'?2:0);announce(action==='json-format'?'Valid JSON, neatly formatted.':'Valid JSON, compacted.')}
      else if(action==='json-copy')await copyText($('#json-output').value);
      else if(action==='regex-run'){const pattern=$('#regex-pattern').value,flags=$('#regex-flags').value,source=$('#regex-text').value;if(/[^dgimsuvy]/.test(flags)||new Set(flags).size!==flags.length)throw new Error('Use valid, unique JavaScript regex flags.');const regex=new RegExp(pattern,flags.includes('g')?flags:`${flags}g`);const found=[...source.matchAll(regex)];$('#regex-result').textContent=found.length?found.map((m,i)=>`${i+1}. “${m[0]}” at ${m.index}`).join('\n'):'No matches found.';announce(`${found.length} match${found.length===1?'':'es'} found.`)}
      else if(action==='color-generate')makePalette($('#color-hex').value);
      else if(action==='password-generate')generatePassword();
      else if(action==='password-copy')await copyText($('#password-result').textContent);
      else if(action==='base64-encode'){const bytes=new TextEncoder().encode($('#base64-input').value);let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));$('#base64-output').value=btoa(binary);announce('Text encoded as UTF-8 Base64.')}
      else if(action==='base64-decode'){const binary=atob($('#base64-input').value.trim());const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));$('#base64-output').value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);announce('Base64 decoded as UTF-8 text.')}
      else if(action==='base64-copy')await copyText($('#base64-output').value);
      else if(action==='image-process')await processImage();
    } catch(error) { announce(error.message||'Something went wrong. Check the input and try again.',true); }
  });
  form.addEventListener('input',event=>{
    if(event.target.matches('[data-project-field]')) { validateFields(); renderPortfolio(); persist(); return; }
    if(event.target.type==='file')return;
    validateFields();renderPortfolio();persist();
  });
  form.addEventListener('change',event=>{
    if(event.target.id==='p-photo'){
      const file=event.target.files[0];if(!file)return;
      canvasJpeg(file,600,.82).then(result=>{profileImage=result;renderPortfolio();persist();feedback('Profile photo processed and saved locally.')}).catch(error=>feedback(error.message,true));
    } else if(event.target.matches('[data-project-field="image"]')){
      const file=event.target.files[0];if(!file)return;
      const node=event.target.closest('.project-editor'), id=node.dataset.projectId;
      canvasJpeg(file,900,.82).then(result=>{projectImages[id]=result;renderPortfolio();persist();feedback('Project image processed and saved locally.')}).catch(error=>feedback(error.message,true));
    } else { validateFields();renderPortfolio();persist(); }
  });
  form.addEventListener('blur',event=>{
    if(event.target.name==='github'||event.target.name==='linkedin'||event.target.matches('[data-project-field="link"]')){normalizeURLFields();renderPortfolio();persist();}
  },true);
  $('#download-portfolio').addEventListener('click',()=>{
    const data=currentData();validateFields();
    if(!form.reportValidity()){feedback('Please correct the highlighted contact details or links before downloading.',true);return;}
    const filename=(data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'portfolio')+'.html';
    downloadBlob(new Blob([exportedPortfolio(data)],{type:'text/html;charset=utf-8'}),filename);
    feedback('Standalone portfolio downloaded. It contains its own styles and embedded images.');
  });
  $('#clear-portfolio').addEventListener('click',()=>{
    if(!window.confirm('Clear all portfolio details and saved images from this browser?'))return;
    try { localStorage.removeItem(STORE_KEY); } catch (_) { feedback('Could not clear browser storage.',true);return; }
    form.reset();profileImage='';projectImages={};$('#projects-list').replaceChildren();addProject();renderPortfolio();feedback('Portfolio cleared from this device.');
  });
  $('#theme-toggle').addEventListener('click',event=>{
    const dark=document.documentElement.dataset.theme!=='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    event.currentTarget.setAttribute('aria-pressed',String(dark));
    event.currentTarget.setAttribute('aria-label',`Switch to ${dark?'light':'dark'} mode`);
    try { localStorage.setItem('devnest-theme',dark?'dark':'light'); } catch (_) { /* Theme preference is optional. */ }
  });
  try {
    if(localStorage.getItem('devnest-theme')==='dark'){document.documentElement.dataset.theme='dark';$('#theme-toggle').setAttribute('aria-pressed','true');$('#theme-toggle').setAttribute('aria-label','Switch to light mode');}
  } catch (_) { /* The page remains usable when storage is disabled. */ }
  $('#menu-toggle').addEventListener('click',event=>{const expanded=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',String(expanded));event.currentTarget.setAttribute('aria-label',expanded?'Close navigation menu':'Open navigation menu');$('#main-nav').classList.toggle('open',expanded);});
  $$('#main-nav a').forEach(link=>link.addEventListener('click',()=>{$('#main-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').setAttribute('aria-label','Open navigation menu');}));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&modal.classList.contains('open'))closeTool();
    if(event.key==='Tab'&&modal.classList.contains('open')){const focusable=$$('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',modal).filter(el=>!el.hidden);const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  });
  content.addEventListener('input',event=>{
    const target=event.target;
    if(target.id==='counter-text'){const text=target.value,words=text.trim()?text.trim().split(/\s+/u).length:0,chars=[...text].length,lines=text.length?text.split(/\r\n|\r|\n/).length:0;$('#counter-result').textContent=`${words} word${words===1?'':'s'} · ${chars} character${chars===1?'':'s'} · ${lines} line${lines===1?'':'s'}`;}
    if(target.id==='color-input')makePalette(target.value);
    if(target.id==='password-length')$('#password-length-value').value=target.value;
    if(target.id==='image-quality')$('#image-quality-value').value=`${target.value}%`;
    if(target.id==='image-file'){const file=target.files[0];$('#image-process').disabled=!file;if(file){if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(file);$('#image-preview').src=imageUrl;$('#image-preview').hidden=false;const image=new Image();image.onload=()=>{$('#image-width').placeholder=String(image.naturalWidth);$('#image-height').placeholder=String(image.naturalHeight)};image.src=imageUrl;announce(`${file.name} selected. Dimensions and quality are processed locally.`);}}
  });
  content.addEventListener('change',event=>{if(event.target.id==='color-hex')makePalette(event.target.value);});
  const motionOff=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if('IntersectionObserver'in window&&!motionOff){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.13});
    $$('.reveal').forEach((el,i)=>{el.style.transitionDelay=`${Math.min(i%4,3)*65}ms`;observer.observe(el)});
    const ribbonObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');ribbonObserver.unobserve(entry.target)}}),{threshold:.02});
    $$('.ribbon').forEach(el=>ribbonObserver.observe(el));
  } else { $$('.reveal').forEach(el=>el.classList.add('visible')); $$('.ribbon').forEach(el=>el.classList.add('is-visible')); }
  if(!motionOff&&matchMedia('(hover: hover)').matches)document.addEventListener('pointermove',event=>{const art=$('.hero-art');if(!art||event.target.closest('button,a,input,textarea'))return;const rect=art.getBoundingClientRect();art.style.setProperty('--parallax-x',`${((event.clientX-rect.left)/rect.width-.5)*4}px`);art.style.setProperty('--parallax-y',`${((event.clientY-rect.top)/rect.height-.5)*4}px`)},{passive:true});
  if(!motionOff){const art=$('.hero-art');let queued=false;window.addEventListener('scroll',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{art.style.setProperty('--scroll-parallax',`${Math.min(window.scrollY*.035,24)}px`);queued=false})},{passive:true});}
  loadSaved();renderPortfolio();
})();
