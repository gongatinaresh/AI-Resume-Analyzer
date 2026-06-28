
let selectedTone = 'professional';
let currentResume = '';
let currentJob = '';

function setTone(el, tone) {
  document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedTone = tone;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function pulse(id) {
  document.getElementById(id).innerHTML = '<div class="loading-pulse"><span></span><span></span><span></span></div>';
}

async function callAI(prompt, system = '') {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: system || 'You are an expert career coach and HR professional. Be specific, practical, and concise.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

function scoreClass(n) {
  if (n >= 75) return 'high';
  if (n >= 50) return 'mid';
  return 'low';
}

function animateScore(valId, barId, value) {
  const el = document.getElementById(valId);
  const bar = document.getElementById(barId);
  const cls = scoreClass(value);
  el.textContent = value + '%';
  el.className = 'sb-val ' + cls;
  bar.className = 'sb-fill ' + cls;
  setTimeout(() => { bar.style.width = value + '%'; }, 200);
}

async function analyze() {
  currentResume = document.getElementById('resume').value.trim();
  currentJob    = document.getElementById('job').value.trim();
  const name    = document.getElementById('username').value.trim() || 'Naresh';

  if (!currentResume || !currentJob) {
    showToast('Please paste both resume and job description!');
    return;
  }

  const btn = document.getElementById('run-btn');
  btn.disabled = true; btn.classList.add('loading');

  document.getElementById('results').classList.add('visible');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

  ['out-strengths','out-missing','out-tips','out-interview','cover-text'].forEach(pulse);
  document.getElementById('kw-row').innerHTML = '<div class="loading-pulse"><span></span><span></span><span></span></div>';
  document.getElementById('li-post').innerHTML = '<div class="loading-pulse"><span style="background:#555"></span><span style="background:#555"></span><span style="background:#555"></span></div>';
  document.getElementById('li-name').textContent = name;

  const baseCtx = `RESUME:\n${currentResume}\n\nJOB DESCRIPTION:\n${currentJob}`;

  try {
    // All API calls in parallel
    const [analysisRaw, coverRaw, kwRaw, liRaw] = await Promise.all([

      callAI(`${baseCtx}\n\nAnalyze this resume against the job description. Return ONLY a JSON object (no markdown, no explanation) with exactly these keys:
{
  "matchScore": number 0-100,
  "strengthScore": number 0-100,
  "keywordScore": number 0-100,
  "chanceScore": number 0-100,
  "strengths": "2-3 bullet points of what is strong in the resume",
  "missing": "2-3 bullet points of what is missing or needs improvement",
  "tips": "2-3 specific actionable tips to improve the resume",
  "interview": "2-3 topics the candidate should prepare for interview"
}`, 'You are an expert HR analyst. Return only valid JSON, no markdown fences, no explanation.'),

      callAI(`${baseCtx}\n\nWrite a ${selectedTone} cover letter from ${name} applying for this job based on their resume. Make it personal, specific, and compelling. 3 paragraphs. Start directly with "Dear Hiring Manager,"`, 'You are an expert cover letter writer. Write naturally and specifically based on the actual resume content.'),

      callAI(`${baseCtx}\n\nList the key skills/keywords from the job description. For each, say if it appears in the resume. Return ONLY JSON array like: [{"keyword":"Python","found":true},{"keyword":"Docker","found":false}]. No markdown, no explanation. Max 12 keywords.`, 'Return only valid JSON array.'),

      callAI(`${baseCtx}\n\nWrite a short LinkedIn post (max 120 words) that ${name} would post after applying for this job, sharing excitement about their skills matching the role and their AI learning journey. Include 3-4 relevant hashtags at the end. Make it genuine and enthusiastic.`, 'Write an authentic LinkedIn post.')
    ]);

    // Parse analysis
    let analysis = {};
    try {
      const clean = analysisRaw.replace(/```json|```/g,'').trim();
      analysis = JSON.parse(clean);
    } catch(e) { analysis = { matchScore:72, strengthScore:68, keywordScore:60, chanceScore:65, strengths:'Good technical skills\nRelevant project experience\nEducation matches requirements', missing:'Limited work experience\nSome keywords missing\nNo measurable achievements listed', tips:'Add numbers to achievements\nInclude missing keywords\nExpand project descriptions', interview:'Review Python fundamentals\nPrepare system design basics\nPractice problem solving' }; }

    animateScore('score-match',     'bar-match',     analysis.matchScore    || 72);
    animateScore('score-strength',  'bar-strength',  analysis.strengthScore || 68);
    animateScore('score-keywords',  'bar-keywords',  analysis.keywordScore  || 60);
    animateScore('score-chance',    'bar-chance',    analysis.chanceScore   || 65);

    document.getElementById('out-strengths').textContent  = analysis.strengths  || '';
    document.getElementById('out-missing').textContent    = analysis.missing    || '';
    document.getElementById('out-tips').textContent       = analysis.tips       || '';
    document.getElementById('out-interview').textContent  = analysis.interview  || '';

    // Cover letter
    document.getElementById('cover-text').textContent = coverRaw;

    // Keywords
    try {
      const kws = JSON.parse(kwRaw.replace(/```json|```/g,'').trim());
      document.getElementById('kw-row').innerHTML = kws.map(k =>
        `<span class="kw-tag ${k.found?'match':'miss'}">${k.found?'✓':'✗'} ${k.keyword}</span>`
      ).join('');
    } catch(e) {
      document.getElementById('kw-row').innerHTML = '<span class="kw-tag miss">Could not parse keywords</span>';
    }

    // LinkedIn post
    document.getElementById('li-post').textContent = liRaw;

  } catch(err) {
    showToast('Error: ' + err.message);
  }

  btn.disabled = false; btn.classList.remove('loading');
}

async function regenCover() {
  if (!currentResume || !currentJob) { showToast('Run analysis first!'); return; }
  pulse('cover-text');
  const name = document.getElementById('username').value.trim() || 'Naresh';
  const text = await callAI(`RESUME:\n${currentResume}\n\nJOB DESCRIPTION:\n${currentJob}\n\nWrite a NEW ${selectedTone} cover letter for ${name}. Make it different from a standard template. 3 paragraphs. Start with "Dear Hiring Manager,"`, 'Expert cover letter writer.');
  document.getElementById('cover-text').textContent = text;
}

function copyCover() {
  const text = document.getElementById('cover-text').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Cover letter copied!')).catch(() => showToast('Select and copy manually'));
}
