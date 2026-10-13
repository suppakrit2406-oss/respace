/* ReSpace · ศูนย์ซ่อมสร้างชุมชน — ฝั่งหน้าเว็บ
   กฎสำคัญทั้งหมด (คัดกรองความเสี่ยง กันจองซ้อน ตัดสต็อก เช็กอิน สิทธิ์) ตรวจที่ฐานข้อมูล
   หน้าเว็บนี้แค่แสดงผลและเรียกฟังก์ชันของเซิร์ฟเวอร์ */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baht = n => Number(n || 0).toLocaleString('th-TH') + ' บาท';
const dkey = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const fdate = k => new Date(k + 'T00:00').toLocaleDateString('th-TH', {weekday:'short', day:'numeric', month:'short'});
const ftime = t => new Date(t).toLocaleString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
const hm = t => String(t || '').slice(0,5);

const cfg = window.RESPACE_CONFIG || {};
const sb = window.supabase.createClient(cfg.url, cfg.key, {auth:{persistSession:true, autoRefreshToken:true}});

/* ---------- ค่าคงที่ของบริการ ---------- */
const ORG = 'ศูนย์ซ่อมสร้างชุมชน', CONSENT_VER = 'v1.0', NOSHOW_LIMIT = 2;
const TYPES = ['พัดลม','หม้อหุงข้าว','เตารีด','กาต้มน้ำ','เครื่องปั่น','ไดร์เป่าผม','โทรศัพท์ / แท็บเล็ต','โน้ตบุ๊ก','ไมโครเวฟ','ตู้เย็น','อื่น ๆ'];
const SYMS = ['เปิดไม่ติด','ไม่หมุน / ทำงานไม่ครบ','มีเสียงดัง','ร้อนผิดปกติ','มีกลิ่นไหม้','น้ำรั่ว','มีประกายไฟ / ไฟดูด','แบตเตอรี่บวม','ไม่เย็น'];
const KG = {'พัดลม':3.5,'หม้อหุงข้าว':2.5,'เตารีด':1.2,'กาต้มน้ำ':1,'เครื่องปั่น':2.8,'ไดร์เป่าผม':0.6,'โทรศัพท์ / แท็บเล็ต':0.3,'โน้ตบุ๊ก':2,'ไมโครเวฟ':12,'ตู้เย็น':45,'อื่น ๆ':2};
const LEVEL = {self:['ซ่อมเองได้','ok'], tech:['ต้องใช้ช่าง','warn'], notworth:['ไม่คุ้มซ่อม','bad']};
const RISK = {low:['ความเสี่ยงเบื้องต้น: ต่ำ','ok'], review:['รอช่างพิจารณาความเสี่ยง','warn'], high:['เสี่ยงสูง ช่างทำเท่านั้น','bad']};
const CSTAT = {waiting:'รอช่างประเมิน',needinfo:'ขอข้อมูลเพิ่ม',assessed:'ประเมินแล้ว',booked:'นัดหมายแล้ว',checkedin:'เช็กอิน',repairing:'กำลังซ่อม',done_ok:'ซ่อมสำเร็จ',done_fail:'ซ่อมไม่ได้',referred:'ส่งต่อช่าง',closed:'ปิดเคส'};
const BSTAT = {confirmed:['ยืนยันแล้ว','ok'],checkedin:['เช็กอินแล้ว','acc'],inprogress:['กำลังซ่อม','acc'],completed:['จบงาน','ok'],cancelled:['ยกเลิก','bad'],noshow:['ไม่มาตามนัด','bad']};
const ROLE = {citizen:'ประชาชน', tech:'ช่าง', admin:'แอดมิน'};
const TL = ['ส่งตรวจ','รอช่างประเมิน','ประเมินแล้ว','นัดหมายแล้ว','เช็กอิน','กำลังซ่อม','ผลซ่อม','ปิดเคส'];
const TLI = {waiting:1,needinfo:1,assessed:2,booked:3,checkedin:4,repairing:5,done_ok:6,done_fail:6,referred:6,closed:7};
const TABS = {
  citizen:[['home','หน้าแรก'],['devices','เครื่องของฉัน'],['cases','ประวัติ'],['kb','ความรู้'],['me','โปรไฟล์']],
  tech:[['queue','คิวประเมิน'],['jobs','งานหน้างาน'],['me','โปรไฟล์']],
  admin:[['dash','แดชบอร์ด'],['jobs','หน้างาน'],['sched','คิว'],['stock','คลัง'],['pay','งบ'],['log','บันทึก']]
};

/* ---------- สถานะของหน้า ---------- */
let S = {ready:false, session:null, me:null, tab:'home', view:null, d:{}, busy:false, auth:{mode:'login'}, photoUrls:{}};
const blank = () => ({users:[],techs:[],stations:[],tools:[],parts:[],slots:[],kb:[],settings:{},devices:[],cases:[],assessments:[],chats:[],bookings:[],results:[],reviews:[],notifs:[],log:[]});
Object.assign(S, blank());
const by = (l, id) => S[l].find(x => x.id === id);
const role = () => S.me?.role || 'citizen';
const isStaff = () => role() === 'tech' || role() === 'admin';
const lastA = cid => S.assessments.filter(a => a.caseId === cid).sort((a,b) => a.time.localeCompare(b.time)).slice(-1)[0];
const live = b => ['confirmed','checkedin','inprogress'].includes(b.status);
const liveB = cid => S.bookings.find(b => b.caseId === cid && live(b));
const devName = d => d ? `${d.type} ${d.brand} ${d.model}`.trim() : '';
const chip = a => `<span class="chip ${a[1]||''}">${esc(a[0])}</span>`;
const userName = id => id === S.me?.id ? S.me.full_name : (by('users', id)?.full_name || '');
const techName = id => by('techs', id)?.name || '-';
const toolName = id => by('tools', id)?.name || id;
const partName = id => by('parts', id)?.name || id;
const station = id => by('stations', id) || {name:id, label:''};

let toastT;
function toast(t){ const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 3200); }
const fail = e => { toast(e?.message || String(e)); };

/* ---------- โหลดข้อมูล (RLS กรองให้เห็นเฉพาะที่มีสิทธิ์) ---------- */
async function q(p){ const {data, error} = await p; if (error) throw error; return data || []; }
async function loadAll(){
  const uid = S.session.user.id;
  const [me] = await q(sb.from('profiles').select('*').eq('id', uid));
  S.me = me || null;
  if (!S.me) return;
  const staff = isStaff(), admin = role() === 'admin';
  const R = await Promise.all([
    q(sb.from('technicians').select('*')), q(sb.from('stations').select('*').order('id')), q(sb.from('tools').select('*').order('id')),
    q(sb.from('parts').select('*').order('id')), q(sb.from('slot_times').select('*').order('slot')), q(sb.from('kb_articles').select('*').order('id')),
    q(sb.from('app_settings').select('*')), q(sb.from('devices').select('*').order('created_at')), q(sb.from('device_history').select('*').order('created_at')),
    q(sb.from('cases').select('*').order('created_at')), q(sb.from('case_photos').select('*')), q(sb.from('assessments').select('*')),
    q(sb.from('assessment_parts').select('*')), q(sb.from('assessment_tools').select('*')), q(sb.from('assessment_kb').select('*')),
    q(sb.from('chats').select('*').order('created_at')), q(sb.from('bookings').select('*').order('created_at')), q(sb.from('booking_tools').select('*')),
    q(sb.from('booking_parts').select('*')), q(sb.from('repair_results').select('*')), q(sb.from('reviews').select('*')),
    q(sb.from('notifications').select('*').order('created_at', {ascending:false}).limit(50)),
    staff ? q(sb.from('profiles').select('id,full_name,role,noshow_count,district')) : Promise.resolve([]),
    admin ? q(sb.from('audit_log').select('*').order('created_at', {ascending:false}).limit(300)) : Promise.resolve([])
  ]);
  const [techs, stations, tools, parts, slots, kb, settings, devices, hist, cases, photos, ass, aparts, atools, akb, chats, bookings, btools, bparts, results, reviews, notifs, users, log] = R;
  Object.assign(S, {
    techs, stations, tools, parts: parts.map(p => ({...p, value:Number(p.value)})), slots: slots.map(s => hm(s.slot)),
    kb: kb.map(k => ({id:k.id, type:k.device_type, sym:k.symptom, title:k.title, fix:k.steps})),
    settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
    devices: devices.map(d => ({id:d.id, userId:d.user_id, type:d.type, brand:d.brand, model:d.model, year:d.year, warranty:d.warranty,
      history: hist.filter(h => h.device_id === d.id).map(h => ({caseId:h.case_id, text:h.note, time:h.created_at}))})),
    cases: cases.map(c => ({id:c.id, userId:c.user_id, deviceId:c.device_id, syms:c.symptoms, detail:c.detail, since:c.since, dropped:c.dropped,
      risk:c.risk, reasons:c.risk_reasons || [], status:c.status, created:c.created_at, photos:photos.filter(p => p.case_id === c.id)})),
    assessments: ass.map(a => ({id:a.id, caseId:a.case_id, techId:a.tech_id, cause:a.cause, level:a.level, scope:a.scope, minutes:a.minutes, time:a.created_at,
      parts: aparts.filter(x => x.assess_id === a.id).map(x => ({partId:x.part_id, qty:x.qty})),
      tools: atools.filter(x => x.assess_id === a.id && x.kind === 'recommended').map(x => x.tool_id),
      allowed: atools.filter(x => x.assess_id === a.id && x.kind === 'allowed').map(x => x.tool_id),
      kb: akb.filter(x => x.assess_id === a.id).map(x => x.kb_id)})),
    chats: chats.map(m => ({id:m.id, caseId:m.case_id, from:m.sender_id, name:m.sender_name, text:m.body, time:m.created_at})),
    bookings: bookings.map(b => ({id:b.id, caseId:b.case_id, assessId:b.assess_id, userId:b.user_id, mode:b.mode, date:b.date, slot:hm(b.slot),
      stationId:b.station_id, techId:b.tech_id, status:b.status, token:b.token, checkedInAt:b.checked_in_at, call:b.call_status, billTotal:b.bill_total == null ? null : Number(b.bill_total),
      tools: btools.filter(t => t.booking_id === b.id).map(t => ({toolId:t.tool_id, status:t.status})),
      parts: bparts.filter(p => p.booking_id === b.id).map(p => ({partId:p.part_id, qty:p.qty, used:p.used, source:p.source, status:p.status, price:Number(p.unit_value)}))})),
    results: results.map(r => ({bookingId:r.booking_id, res:r.result, note:r.note, time:r.created_at})),
    reviews: reviews.map(r => ({bookingId:r.booking_id, stars:r.stars, text:r.body})),
    notifs, users, log
  });
}

/* ================= หน้าเข้าสู่ระบบ / ลงทะเบียน ================= */
const DEMO = [['citizen@respace.demo','ประชาชน (สมชาย)'],['wit@respace.demo','ช่าง (ช่างวิทย์)']];
function vAuth(){
  const a = S.auth, signup = a.mode === 'signup';
  return `<div class="stack" style="max-width:440px;margin-inline:auto;width:100%">
  <div><p class="eyebrow">${ORG} · บริการสาธารณะ ไม่มีค่าใช้จ่าย</p><h1 tabindex="-1">${signup ? 'ลงทะเบียนใช้บริการ' : 'เข้าสู่ระบบ'}</h1></div>
  <div class="seg" role="group" aria-label="เลือกหน้า"><button type="button" data-a="authMode" data-id="login" aria-pressed="${!signup}">เข้าสู่ระบบ</button><button type="button" data-a="authMode" data-id="signup" aria-pressed="${signup}">ลงทะเบียน</button></div>
  <form class="card" id="auth-form" novalidate>
    ${signup ? `<label class="f">ชื่อ–นามสกุล<input id="au-name" data-m="name" autocomplete="name" required value="${esc(a.name)}"></label>
    <label class="f">เบอร์โทร<input id="au-phone" data-m="phone" type="tel" autocomplete="tel" inputmode="tel" value="${esc(a.phone)}"></label>
    <label class="f">อำเภอ / เขตที่อยู่<input id="au-district" data-m="district" value="${esc(a.district)}"></label>` : ''}
    <label class="f">อีเมล<input id="au-email" data-m="email" type="email" autocomplete="email" required value="${esc(a.email)}"></label>
    <label class="f">รหัสผ่าน${signup ? ' (อย่างน้อย 8 ตัวอักษร)' : ''}<input id="au-pw" data-m="pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required value="${esc(a.pw)}"></label>
    ${signup ? `<label class="row small"><input type="checkbox" id="au-pdpa" data-m="pdpa" style="width:auto" ${a.pdpa ? 'checked' : ''}> ยินยอมให้ศูนย์เก็บชื่อ เบอร์โทร และรูปเครื่องที่ส่ง เพื่อให้บริการซ่อมเท่านั้น</label>` : ''}
    <button class="btn pri" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'กำลังดำเนินการ…' : signup ? 'ลงทะเบียน' : 'เข้าสู่ระบบ'}</button>
  </form>
  ${a.msg ? `<div class="banner info" role="status">${esc(a.msg)}</div>` : ''}
  ${signup ? '' : `<div class="card"><h2>บัญชีทดลอง</h2><p class="small muted">สำหรับสาธิตเท่านั้น รหัสผ่านทุกบัญชี <span class="mono">ReSpace#Demo2026</span></p>
  <div class="opt">${DEMO.map(([e,t]) => `<button type="button" data-a="demoLogin" data-id="${e}">${t}</button>`).join('')}</div></div>`}
  </div>`;
}

/* ================= มุมมองประชาชน ================= */
function citizenView(){
  const v = S.view;
  if (v){ const f = {triage:vTriage, addDevice:vAddDevice, case:vCase, book:vBook, booking:vBooking, device:vDevice, pickCase:vPickCase}[v.n]; if (f) return back() + f(v); }
  return ({home:vHome, devices:vDevices, cases:vCases, kb:vKb, me:vMe}[S.tab] || vHome)();
}
const back = () => `<div><button type="button" class="link" data-a="back">← กลับ</button></div>`;
const mine = l => S[l].filter(x => x.userId === S.me.id);
function caseCard(c){ const d = by('devices', c.deviceId), a = lastA(c.id);
  return `<div class="card tag"><div class="row between"><span class="mono">${c.id}</span>${chip([CSTAT[c.status], c.status === 'needinfo' ? 'warn' : 'acc'])}</div>
  <h3>${esc(devName(d))}</h3><p class="small muted">${esc(c.detail || c.syms.join(', '))}</p>
  <div class="row">${chip(RISK[c.risk])}${a ? chip(LEVEL[a.level]) : ''}</div>
  <div><button type="button" class="btn sm" data-a="go" data-n="case" data-id="${c.id}">เปิดเคส ${c.id}</button></div></div>`; }
function bookingCard(b){ const c = by('cases', b.caseId);
  return `<div class="card"><div class="row between"><span class="mono">${b.id}</span>${chip(BSTAT[b.status])}</div>
  <h3>${fdate(b.date)} เวลา ${b.slot} น. · ${esc(station(b.stationId).name)}</h3>
  <p class="small muted">${esc(devName(by('devices', c?.deviceId)))} · ${b.mode === 'self' ? 'ซ่อมเองในพื้นที่' : 'ช่างดำเนินการ'}</p>
  <div><button type="button" class="btn sm pri" data-a="go" data-n="booking" data-id="${b.id}">เปิดคิว ${b.id}</button></div></div>`; }
function vHome(){
  const qs = mine('bookings').filter(live), cs = mine('cases').filter(c => ['assessed','needinfo','waiting'].includes(c.status) && !liveB(c.id));
  return `<div><p class="eyebrow">${ORG}</p><h1 tabindex="-1">สวัสดี คุณ${esc(S.me.full_name || '')}</h1></div>
  <div class="banner info small"><b>บริการสาธารณะ ไม่มีค่าใช้จ่าย</b><span>โต๊ะ เครื่องมือ คำแนะนำจากช่าง และอะไหล่พื้นฐานของศูนย์ ให้บริการฟรีสำหรับประชาชนในพื้นที่ ดำเนินการโดยหน่วยงานท้องถิ่น (ตัวอย่าง)</span></div>
  ${S.me.noshow_count >= NOSHOW_LIMIT ? `<div class="banner bad" role="alert"><b>สิทธิ์การจองถูกพักไว้</b><span class="small">ไม่มาตามนัดครบ ${NOSHOW_LIMIT} ครั้ง ติดต่อเจ้าหน้าที่ศูนย์เพื่อขอคืนสิทธิ์</span></div>` : ''}
  <div class="big"><button type="button" class="pri" data-a="newTriage"><b>ตรวจเบื้องต้น</b><span class="small">ส่งรูปและอาการให้ช่างประเมินออนไลน์</span></button>
  <button type="button" data-a="go" data-n="pickCase"><b>จองซ่อม</b><span class="small muted">เลือกวัน เวลา โต๊ะ และอุปกรณ์</span></button></div>
  <h2>คิวของฉัน</h2>${qs.length ? qs.map(bookingCard).join('') : `<p class="muted small">ยังไม่มีคิว จองได้ฟรีจากเคสที่ประเมินแล้ว</p>`}
  <h2>เคสที่รอดำเนินการ</h2>${cs.length ? cs.map(caseCard).join('') : `<p class="muted small">ไม่มีเคสค้าง</p>`}
  <h2>เคล็ดลับ</h2>${S.kb.filter(k => k.type === 'ทั่วไป').map(kbCard).join('')}`;
}
const kbCard = k => `<details class="card"><summary><b>${esc(k.title)}</b> <span class="small muted">· ${esc(k.type)}</span></summary><ul class="plain small">${k.fix.map(f => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
function vDevices(){ const ds = mine('devices');
  return `<div class="row between"><h1 tabindex="-1">เครื่องของฉัน</h1><button type="button" class="btn sm" data-a="go" data-n="addDevice">เพิ่มเครื่อง</button></div>
  ${ds.map(d => `<div class="card"><h3>${esc(devName(d))}</h3><p class="small muted">ซื้อปี ${esc(d.year || '-')} · ประกัน: ${esc(d.warranty)} · ประวัติซ่อม ${d.history.length} ครั้ง</p>
  <div><button type="button" class="btn sm" data-a="go" data-n="device" data-id="${d.id}">ดูประวัติ ${esc(d.type)}</button></div></div>`).join('') || `<p class="muted small">ยังไม่มีเครื่อง เพิ่มเครื่องแรกเพื่อแจ้งอาการได้เร็วขึ้น</p>`}`; }
function vDevice(v){ const d = by('devices', v.id); if (!d) return `<p>ไม่พบเครื่องนี้ในบัญชีของคุณ</p>`;
  const cs = S.cases.filter(c => c.deviceId === d.id);
  return `<h1 tabindex="-1">${esc(devName(d))}</h1><dl class="kv"><dt>ปีที่ซื้อ</dt><dd>${esc(d.year || '-')}</dd><dt>ประกัน</dt><dd>${esc(d.warranty)}</dd></dl>
  <h2>ประวัติซ่อม</h2>${d.history.length ? d.history.map(h => `<div class="card"><div class="row between"><span class="mono">${esc(h.caseId)}</span><span class="small muted">${ftime(h.time)}</span></div><p>${esc(h.text.replace(/^done_ok/, 'ซ่อมสำเร็จ').replace(/^done_fail/, 'ซ่อมไม่ได้').replace(/^referred/, 'ส่งต่อช่าง'))}</p></div>`).join('') : `<p class="small muted">ยังไม่มีประวัติ</p>`}
  <h2>เคสของเครื่องนี้</h2>${cs.map(caseCard).join('') || `<p class="small muted">ยังไม่มีเคส</p>`}`; }
function devForm(){ const d = S.d; return `<div class="grid2">
  <label class="f">ประเภท<select id="dv-type" data-m="type">${TYPES.map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
  <label class="f">ยี่ห้อ<input id="dv-brand" data-m="brand" value="${esc(d.brand)}" required></label>
  <label class="f">รุ่น<input id="dv-model" data-m="model" value="${esc(d.model)}"></label>
  <label class="f">ปีที่ซื้อ (พ.ศ.)<input id="dv-year" data-m="year" inputmode="numeric" value="${esc(d.year)}"></label>
  <label class="f">ประกัน<select id="dv-war" data-m="warranty">${['ไม่ทราบ','ยังมีประกัน','หมดแล้ว'].map(t => `<option ${d.warranty === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>`; }
function vAddDevice(){ return `<h1 tabindex="-1">เพิ่มเครื่อง</h1><div class="card">${devForm()}<button type="button" class="btn pri" data-a="saveDevice">บันทึกเครื่อง</button></div>`; }
function vCases(){ return `<h1 tabindex="-1">ประวัติและสถานะ</h1>${mine('cases').slice().reverse().map(caseCard).join('') || `<p class="muted small">ยังไม่มีเคส</p>`}
  <h2>การจองทั้งหมด</h2>${mine('bookings').slice().reverse().map(bookingCard).join('') || `<p class="small muted">ยังไม่มีการจอง</p>`}`; }
function vKb(){ return `<h1 tabindex="-1">คลังความรู้</h1><p class="muted small">จัดตามประเภทเครื่อง ทำเฉพาะขั้นตอนที่ช่างอนุมัติในเคสของคุณ</p>${S.kb.map(kbCard).join('')}`; }
function vMe(){ const u = S.me, d = S.d;
  return `<h1 tabindex="-1">โปรไฟล์และแจ้งเตือน</h1>
  <div class="card"><dl class="kv"><dt>บทบาท</dt><dd>${ROLE[u.role]}</dd><dt>อีเมล</dt><dd>${esc(S.session.user.email)}</dd>
  ${u.role === 'citizen' ? `<dt>สิทธิ์การจอง</dt><dd>${u.noshow_count >= NOSHOW_LIMIT ? chip(['พักสิทธิ์ ติดต่อเจ้าหน้าที่','bad']) : chip(['ใช้ได้','ok'])} ไม่มาตามนัด ${u.noshow_count} / ${NOSHOW_LIMIT} ครั้ง</dd>` : ''}
  <dt>แจ้งเตือน</dt><dd>ในแอป (LINE / SMS อยู่ในเฟส 2)</dd></dl>
  <div class="grid2"><label class="f">ชื่อ–นามสกุล<input id="me-name" data-m="full_name" value="${esc(d.full_name ?? u.full_name)}"></label>
  <label class="f">เบอร์โทร<input id="me-phone" data-m="phone" type="tel" value="${esc(d.phone ?? u.phone)}"></label>
  <label class="f">อำเภอ / เขต<input id="me-district" data-m="district" value="${esc(d.district ?? u.district)}"></label></div>
  <div><button type="button" class="btn sm" data-a="saveProfile">บันทึกโปรไฟล์</button></div></div>
  <h2>แจ้งเตือน</h2>${S.notifs.map(x => `<div class="card"><p>${x.read ? '' : chip(['ใหม่','acc']) + ' '}${esc(x.body)}</p><span class="small muted">${ftime(x.created_at)}</span></div>`).join('') || `<p class="small muted">ยังไม่มีแจ้งเตือน</p>`}`; }

/* ----- ตรวจเบื้องต้น ----- */
function previewRisk(type, syms, dropped){
  const s = syms.concat(dropped === 'เคยตกน้ำ / โดนน้ำ' ? ['น้ำรั่ว'] : []), r = []; let lv = 'low';
  if (type === 'ไมโครเวฟ'){ lv = 'high'; r.push('ไมโครเวฟมีตัวเก็บประจุแรงดันสูง'); }
  if (type === 'ตู้เย็น' && s.includes('ไม่เย็น')){ lv = 'high'; r.push('งานระบบคอมเพรสเซอร์และสารทำความเย็น'); }
  if (s.includes('แบตเตอรี่บวม')){ lv = 'high'; r.push('แบตเตอรี่ลิเธียมบวม เสี่ยงติดไฟ'); }
  if (lv !== 'high') ['มีกลิ่นไหม้','มีประกายไฟ / ไฟดูด','น้ำรั่ว'].forEach(x => { if (s.includes(x)){ lv = 'review'; r.push(`อาการ “${x}” ต้องให้ช่างพิจารณาก่อน`); } });
  return {lv, r};
}
const steps = (n, st) => `<div class="steps" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${st}" aria-label="ขั้นที่ ${st} จาก ${n}">${Array.from({length:n}, (_, i) => `<i class="${i < st ? 'on' : ''}"></i>`).join('')}</div>`;
function vTriage(){ const d = S.d, st = d.step || 1, dev = by('devices', d.deviceId);
  const head = `<h1 tabindex="-1">ตรวจเบื้องต้น</h1>${steps(4, st)}`;
  if (st === 1) return head + `<h2>เลือกเครื่อง</h2><div class="opt">${mine('devices').map(x => `<button type="button" data-a="pickDev" data-id="${x.id}" aria-pressed="${d.deviceId === x.id}">${esc(devName(x))}</button>`).join('')}<button type="button" data-a="pickDev" data-id="new" aria-pressed="${d.deviceId === 'new'}">+ เครื่องใหม่</button></div>
    ${d.deviceId === 'new' ? `<div class="card">${devForm()}</div>` : ''}<button type="button" class="btn pri" data-a="tNext">ถัดไป</button>`;
  if (st === 2){ const P = [['a','ภาพรวมของเครื่อง'],['b','จุดที่เสีย (จากภายนอก)'],['c','ป้ายรุ่น / ป้ายไฟ']];
    return head + `<h2>แนบภาพ 3 มุม</h2><div class="banner info small">ถ่ายจากจุดที่เข้าถึงได้อย่างปลอดภัย ไม่ต้องเปิดฝาเครื่องเพื่อถ่ายจุดที่เสีย ภาพเห็นได้เฉพาะคุณและเจ้าหน้าที่</div>
    <div class="photos">${P.map(([k, t]) => { const p = d.photos[k]; return `<label class="ph ${p ? 'has' : ''} ${p === 'demo' ? 'demo' : ''}" style="${p && p !== 'demo' ? `background-image:url(${p})` : ''}"><span>${p ? '✓ ' : ''}${t}</span><input type="file" accept="image/*" id="ph-${k}" data-ph="${k}" aria-label="แนบภาพ${t}"></label>`; }).join('')}</div>
    <div class="row"><button type="button" class="btn sm" data-a="demoPhotos">ใช้ภาพตัวอย่าง (เดโม)</button></div>
    <div class="row"><button type="button" class="btn" data-a="tPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="tNext">ถัดไป</button></div>`; }
  if (st === 3) return head + `<h2 id="sym-h">อาการและคำถามคัดกรอง</h2><div class="opt" role="group" aria-labelledby="sym-h">${SYMS.map(s => `<button type="button" data-a="sym" data-id="${esc(s)}" aria-pressed="${d.syms.includes(s)}">${s}</button>`).join('')}</div>
    <label class="f">รายละเอียดเพิ่มเติม<textarea id="t-detail" data-m="detail">${esc(d.detail)}</textarea></label>
    <div class="grid2"><label class="f">เกิดอาการตั้งแต่เมื่อไร<input id="t-since" data-m="since" value="${esc(d.since)}"></label>
    <label class="f">เคยตกน้ำหรือตกพื้นหรือไม่<select id="t-drop" data-m="dropped">${['ไม่เคย','เคยตกพื้น','เคยตกน้ำ / โดนน้ำ','ไม่แน่ใจ'].map(t => `<option ${d.dropped === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <div class="row"><button type="button" class="btn" data-a="tPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="tNext">ตรวจความเสี่ยง</button></div>`;
  const r = previewRisk(dev.type, d.syms, d.dropped);
  const ban = r.lv === 'high' ? `<div class="banner bad" role="alert"><b>หยุดใช้เครื่องนี้และถอดปลั๊กทันที</b><span class="small">${esc(r.r.join(' · '))} งานนี้ต้องให้ช่างทำเท่านั้น ระบบจะส่งเคสให้ช่างทันที</span></div>`
    : r.lv === 'review' ? `<div class="banner warn" role="alert"><b>งดใช้เครื่องจนกว่าช่างจะตอบ</b><span class="small">${esc(r.r.join(' · '))}</span></div>`
    : `<div class="banner ok"><b>ไม่พบสัญญาณเสี่ยงสูงจากข้อมูลเบื้องต้น</b><span class="small">ยังซ่อมเองไม่ได้จนกว่าช่างจะประเมินและอนุมัติขอบเขตงาน</span></div>`;
  return head + `<h2>ผลคัดกรองเบื้องต้น</h2>${ban}<div class="card"><dl class="kv"><dt>เครื่อง</dt><dd>${esc(devName(dev))}</dd><dt>อาการ</dt><dd>${esc(d.syms.join(', '))}</dd><dt>รายละเอียด</dt><dd>${esc(d.detail || '-')}</dd></dl></div>
    <p class="small muted">ระบบคัดกรองซ้ำที่เซิร์ฟเวอร์เมื่อส่งเคส</p>
    <div class="row"><button type="button" class="btn" data-a="tPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="submitCase" ${S.busy ? 'disabled' : ''}>${S.busy ? 'กำลังส่ง…' : 'ส่งให้ช่างประเมิน'}</button></div>`;
}

/* ----- หน้าเคส (ใช้ร่วมกับช่าง) ----- */
function timeline(c){ const i = TLI[c.status]; return `<ol class="tl" aria-label="สถานะเคส">${TL.map((t, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}" ${k === i ? 'aria-current="step"' : ''}>${k === 6 && i >= 6 && c.status !== 'closed' ? CSTAT[c.status] : t}</li>`).join('')}</ol>`; }
function assessCard(a){ const cost = a.parts.reduce((s, p) => s + (by('parts', p.partId)?.value || 0) * p.qty, 0);
  return `<div class="card"><div class="row between"><h2>ผลประเมิน</h2>${chip(LEVEL[a.level])}</div>
  <dl class="kv"><dt>สาเหตุที่คาด</dt><dd>${esc(a.cause)}</dd>${a.level === 'self' ? `<dt>ขอบเขตที่อนุญาต</dt><dd>${esc(a.scope)}</dd>` : ''}
  <dt>มูลค่าอะไหล่ประมาณ</dt><dd>${baht(cost)} <span class="small muted">(ศูนย์สนับสนุน ไม่เก็บเงิน)</span></dd><dt>เวลาโดยประมาณ</dt><dd>${a.minutes} นาที</dd>
  <dt>เครื่องมือ</dt><dd>${a.tools.map(toolName).join(', ') || '-'}</dd><dt>อะไหล่</dt><dd>${a.parts.map(p => partName(p.partId) + ' ×' + p.qty).join(', ') || '-'}</dd>
  <dt>ประเมินโดย</dt><dd>${esc(techName(a.techId))} · ${ftime(a.time)}</dd></dl>
  ${a.level === 'notworth' ? `<div class="banner warn small">มูลค่าอะไหล่และเวลาที่ต้องใช้ไม่คุ้มเมื่อเทียบกับเครื่องใหม่ แนะนำส่งที่จุดรับขยะอิเล็กทรอนิกส์ของศูนย์</div>` : ''}</div>`; }
function photoStrip(c){
  const real = c.photos.filter(p => p.path !== 'demo');
  if (!c.photos.length) return '<dd>ยังไม่มีภาพ</dd>';
  if (!real.length) return '<dd>3 มุม (ภาพตัวอย่าง)</dd>';
  return `<dd><div class="row">${real.map(p => { const u = S.photoUrls[p.path]; return u ? `<img src="${u}" alt="ภาพเคส ${c.id} มุม ${p.kind}" width="72" height="72" style="object-fit:cover;border-radius:6px">` : `<span class="small muted">กำลังโหลดภาพ…</span>`; }).join('')}</div></dd>`;
}
function chatBox(c){ const ms = S.chats.filter(m => m.caseId === c.id), me = S.me.id;
  return `<div class="card"><h2 id="chat-h-${c.id}">แชตในเคส ${c.id}</h2><div class="chat" id="chatlog" role="log" aria-labelledby="chat-h-${c.id}">${ms.map(m => `<div class="msg ${m.from === me ? 'me' : ''}"><small>${esc(m.name)} · ${ftime(m.time)}</small>${esc(m.text)}</div>`).join('') || '<p class="small muted">ยังไม่มีข้อความ</p>'}</div>
  <div class="row"><input id="chat-in" class="grow" placeholder="พิมพ์ข้อความ" aria-label="ข้อความถึง${role() === 'citizen' ? 'ช่าง' : 'ผู้แจ้ง'}" data-enter="sendChat" data-id="${c.id}" maxlength="2000"><button type="button" class="btn pri" data-a="sendChat" data-id="${c.id}">ส่ง</button></div></div>`; }
function vCase(v){ const c = by('cases', v.id); if (!c) return `<p>ไม่พบเคสนี้</p>`;
  const a = lastA(c.id), b = liveB(c.id), d = by('devices', c.deviceId);
  needPhotos(c);
  return `<div class="row between"><h1 tabindex="-1">${esc(devName(d))}</h1><span class="mono">${c.id}</span></div>${timeline(c)}
  <div class="row">${chip(RISK[c.risk])}${c.reasons.map(r => `<span class="small muted">${esc(r)}</span>`).join('')}</div>
  ${c.status === 'needinfo' ? `<div class="banner warn"><b>ช่างขอข้อมูลเพิ่ม</b><span class="small">ตอบในแชตด้านล่าง เคสจะกลับเข้าคิวประเมิน</span></div>` : ''}
  <div class="card"><dl class="kv"><dt>อาการ</dt><dd>${esc(c.syms.join(', '))}</dd><dt>รายละเอียด</dt><dd>${esc(c.detail || '-')}</dd><dt>เริ่มเป็น</dt><dd>${esc(c.since || '-')}</dd><dt>ตกน้ำ / ตกพื้น</dt><dd>${esc(c.dropped)}</dd><dt>ภาพ</dt>${photoStrip(c)}</dl></div>
  ${a ? assessCard(a) : `<p class="muted small">ช่างจะตอบภายใน 24 ชั่วโมงหลังส่งเคส</p>`}
  ${b ? bookingCard(b) : (['assessed','waiting'].includes(c.status) && (!a || a.level !== 'notworth')) ? `<button type="button" class="btn pri" data-a="startBook" data-id="${c.id}">${a ? 'จองซ่อมต่อ' : 'จองให้ช่างตรวจและซ่อม'}</button>` : ''}
  ${chatBox(c)}`; }
function vPickCase(){ const cs = mine('cases').filter(c => ['assessed','waiting'].includes(c.status) && !liveB(c.id) && (lastA(c.id) || {}).level !== 'notworth');
  return `<h1 tabindex="-1">จองซ่อม</h1><p class="muted small">ทุกการจองต้องมีเคสและผ่านการคัดกรองก่อน</p>${cs.map(caseCard).join('')}
  <div class="card"><h3>ยังไม่มีเคสสำหรับเครื่องนี้</h3><p class="small muted">จองตรงจะสร้างเคสและคัดกรองความเสี่ยงให้ก่อน จากนั้นจองโต๊ะช่างได้ทันที ส่วนการซ่อมเองต้องรอผลประเมิน</p><div><button type="button" class="btn" data-a="newTriage" data-direct="1">สร้างเคสแล้วจอง</button></div></div>`; }

/* ----- จองซ่อม ----- */
const days = () => Array.from({length:14}, (_, i) => dkey(new Date(Date.now() + i * 864e5)));
function vBook(){ const d = S.d, c = by('cases', d.caseId), a = lastA(c.id), st = d.step || 1;
  const selfOK = a && a.level === 'self' && c.risk !== 'high', opts = d.opts || [], cur = opts.find(o => o.slot === d.slot);
  const head = `<h1 tabindex="-1">จองซ่อม <span class="mono">${c.id}</span></h1>${steps(4, st)}`;
  if (st === 1) return head + `<h2 id="mode-h">รูปแบบบริการ</h2><div class="opt" role="group" aria-labelledby="mode-h"><button type="button" data-a="bMode" data-id="self" aria-pressed="${d.mode === 'self'}" ${selfOK ? '' : 'disabled'}>ซ่อมเองในพื้นที่</button><button type="button" data-a="bMode" data-id="tech" aria-pressed="${d.mode === 'tech'}">ช่างดำเนินการ</button></div>
    ${selfOK ? '' : `<div class="banner warn small">${a ? 'ผลประเมินระบุว่าต้องใช้ช่าง' : 'เคสนี้ยังไม่มีผลประเมินจากช่าง'} จึงจองแบบซ่อมเองไม่ได้</div>`}
    <h2 id="date-h">วัน</h2><div class="opt" role="group" aria-labelledby="date-h">${days().map(k => `<button type="button" data-a="bDate" data-id="${k}" aria-pressed="${d.date === k}">${fdate(k)}</button>`).join('')}</div>
    <h2 id="slot-h">ช่วงเวลา (1 ชั่วโมง)</h2>${d.loading ? `<p class="small muted" role="status">กำลังตรวจคิวว่าง…</p>` : `<div class="opt" role="group" aria-labelledby="slot-h">${S.slots.map(s => { const o = opts.find(x => x.slot === s); return `<button type="button" data-a="bSlot" data-id="${s}" aria-pressed="${d.slot === s}" ${o && o.ok ? '' : 'disabled'}>${s}${o && o.ok ? '' : ' (เต็ม)'}</button>`; }).join('')}</div>`}
    <p class="small muted">แสดงเฉพาะช่วงที่โต๊ะ ${d.mode === 'tech' ? 'ช่าง ' : ''}และเครื่องมือว่างพร้อมกัน</p>
    <button type="button" class="btn pri" data-a="bNext" ${d.slot ? '' : 'disabled'}>ถัดไป</button>`;
  if (st === 2){ const fs = (cur?.stations || []).map(station), allow = a ? [...new Set(a.tools.concat(a.allowed))] : [];
    return head + `<h2 id="st-h">โต๊ะ</h2><div class="opt" role="group" aria-labelledby="st-h">${fs.map(x => `<button type="button" data-a="bStation" data-id="${x.id}" aria-pressed="${d.stationId === x.id}">${esc(x.name)} · ${esc(x.label)}</button>`).join('') || '<p class="small muted">ไม่มีโต๊ะว่าง ย้อนกลับไปเลือกช่วงเวลาใหม่</p>'}</div>
    ${d.mode === 'self' ? `<h2 id="tool-h">อุปกรณ์</h2><p class="small muted">เพิ่มได้เฉพาะรายการที่ช่างอนุญาตสำหรับเคสนี้ ระบบตรวจว่าว่างในช่วงเวลาที่เลือก</p><div class="opt" role="group" aria-labelledby="tool-h">${allow.map(t => { const rec = a.tools.includes(t), on = d.tools.includes(t); return `<button type="button" data-a="bTool" data-id="${t}" aria-pressed="${on}" ${rec ? 'disabled style="text-decoration:none;opacity:1"' : ''}>${esc(toolName(t))}${rec ? ' (ช่างแนะนำ)' : ''}</button>`; }).join('')}</div>`
      : `<p class="small muted">ช่างเตรียมเครื่องมือของพื้นที่ให้ ไม่ต้องจองอุปกรณ์</p>`}
    <div class="row"><button type="button" class="btn" data-a="bPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="bNext" ${d.stationId ? '' : 'disabled'}>ถัดไป</button></div>`; }
  if (st === 3) return head + `<h2>อะไหล่</h2>${d.parts.length ? d.parts.map(p => { const x = by('parts', p.partId), avail = x.stock - x.reserved, ok = avail >= p.qty; if (!ok && p.source === 'stock') p.source = 'order';
      return `<div class="card"><div class="row between"><h3>${esc(x.name)} ×${p.qty}</h3><span class="chip ok">ฟรี</span></div>
      ${ok ? `<span class="chip ok">ศูนย์มีให้ พร้อมกันไว้ ${avail} ชิ้น</span>` : `<span class="chip warn">สต็อกไม่พอ</span>`}
      <div class="opt" role="group" aria-label="แหล่งอะไหล่ ${esc(x.name)}">${ok ? `<button type="button" data-a="bSrc" data-id="${p.partId}" data-s="stock" aria-pressed="${p.source === 'stock'}">ใช้ของศูนย์</button>` : `<button type="button" data-a="bSrc" data-id="${p.partId}" data-s="order" aria-pressed="${p.source === 'order'}">ศูนย์จัดหาให้</button>`}
      <button type="button" data-a="bSrc" data-id="${p.partId}" data-s="own" aria-pressed="${p.source === 'own'}">นำมาเอง</button></div>
      ${p.source === 'order' ? `<p class="small muted">ศูนย์จะจัดหาตามรอบจัดซื้อ เจ้าหน้าที่จะแจ้งเมื่ออะไหล่มาถึง หากยังไม่มาอาจต้องเลื่อนนัด</p>` : ''}</div>`; }).join('') : `<p class="muted small">ยังไม่มีรายการอะไหล่จากผลประเมิน ช่างจะแจ้งหน้างาน</p>`}
    <div class="row"><button type="button" class="btn" data-a="bPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="bNext">ถัดไป</button></div>`;
  return head + `<h2>ตรวจสอบและยืนยัน</h2><div class="card"><dl class="kv"><dt>นัดหมาย</dt><dd>${fdate(d.date)} ${d.slot} น. · ${esc(station(d.stationId).name)}</dd><dt>รูปแบบ</dt><dd>${d.mode === 'self' ? 'ซ่อมเองในพื้นที่ มีช่างกำกับ' : 'ช่างดำเนินการ'}</dd>
    <dt>อุปกรณ์</dt><dd>${d.tools.map(toolName).join(', ') || '-'}</dd><dt>อะไหล่</dt><dd>${d.parts.map(p => partName(p.partId)).join(', ') || '-'}</dd><dt>ค่าใช้จ่าย</dt><dd><b>ไม่มีค่าใช้จ่าย</b></dd></dl></div>
  <div class="card"><h3>ข้อตกลงการใช้บริการ ${CONSENT_VER}</h3><ul class="plain small"><li>ทำงานเฉพาะขอบเขตที่ช่างอนุมัติ และหยุดทันทีเมื่อช่างสั่ง</li><li>ช่างหน้างานปรับระดับผลประเมินหรือรับช่วงงานได้</li><li>ข้อตกลงนี้เป็นบันทึกการรับทราบ ไม่ได้ใช้แทนการดูแลจากช่าง</li><li>มาไม่ได้ให้ยกเลิกในแอปก่อนเวลานัด เพื่อคืนคิวให้คนอื่น ไม่มาตามนัดครบ ${NOSHOW_LIMIT} ครั้งจะถูกพักสิทธิ์การจอง</li></ul>
    <label class="row small"><input type="checkbox" id="b-consent" data-m="consent" style="width:auto" ${d.consent ? 'checked' : ''}> ฉันอ่านและรับทราบข้อตกลงนี้</label></div>
  <div class="row"><button type="button" class="btn" data-a="bPrev">ย้อนกลับ</button><button type="button" class="btn pri" data-a="commit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'กำลังจอง…' : 'ยืนยันการจอง'}</button></div>`;
}
function billCard(b){ const lines = b.parts.filter(p => p.source !== 'own' && p.used).map(p => [partName(p.partId) + ' ×' + p.used, p.used * p.price]);
  lines.push([b.mode === 'self' ? 'ใช้โต๊ะและเครื่องมือ 1 ชม.' : 'ช่างดำเนินการซ่อม', 0]);
  return `<div class="card"><h2>สรุปการใช้บริการ</h2><div class="tw" tabindex="0"><table><tbody>
  ${lines.map(l => `<tr><td>${esc(l[0])}</td><td class="num">${l[1] ? 'มูลค่า ' + baht(l[1]) : 'ฟรี'}</td></tr>`).join('')}
  <tr><th scope="row">ค่าใช้จ่ายของคุณ</th><th class="num">0 บาท</th></tr></tbody></table></div><p class="small muted">ศูนย์สนับสนุนอะไหล่มูลค่า ${baht(b.billTotal)} จากงบประมาณบริการสาธารณะ</p></div>`; }
function toolChips(b){ const t = b.tools.length ? (b.tools.every(t => ['returned','released'].includes(t.status)) ? ['คืนเครื่องมือครบ','ok'] : b.tools.some(t => t.status === 'out') ? ['เครื่องมืออยู่ที่โต๊ะ','warn'] : ['กันเครื่องมือไว้','']) : ['ไม่มีเครื่องมือยืม',''];
  return `<div class="row">${chip(BSTAT[b.status])}${chip(['ไม่มีค่าใช้จ่าย','ok'])}${chip(t)}</div>`; }
function vBooking(v){ const b = by('bookings', v.id); if (!b) return `<p>ไม่พบการจองนี้ในบัญชีของคุณ</p>`;
  const c = by('cases', b.caseId), a = by('assessments', b.assessId), kb = a && a.kb[0] ? by('kb', a.kb[0]) : null, rv = S.reviews.find(r => r.bookingId === b.id), safety = S.kb.find(k => k.id === 'K3');
  let h = `<div class="row between"><h1 tabindex="-1">คิว ${fdate(b.date)} ${b.slot} น.</h1><span class="mono">${b.id}</span></div>${toolChips(b)}
  <div class="card"><dl class="kv"><dt>เครื่อง</dt><dd>${esc(devName(by('devices', c.deviceId)))}</dd><dt>โต๊ะ</dt><dd>${esc(station(b.stationId).name)}</dd><dt>ช่าง</dt><dd>${esc(techName(b.techId))} (${b.mode === 'self' ? 'กำกับหน้างาน' : 'ผู้ซ่อม'})</dd>
  <dt>อุปกรณ์</dt><dd>${b.tools.map(t => toolName(t.toolId)).join(', ') || '-'}</dd><dt>อะไหล่</dt><dd>${b.parts.map(p => partName(p.partId) + ' ×' + p.qty + ({stock:' (กันไว้)', order:' (ศูนย์จัดหาให้)', own:' (นำมาเอง)'})[p.source]).join(', ') || '-'}</dd></dl></div>`;
  if (b.status === 'confirmed') h += `<div class="card"><h2>QR เช็กอิน</h2><div class="qr" data-qr="${esc(b.token)}" role="img" aria-label="คิวอาร์โค้ดเช็กอิน รหัส ${esc(b.token)}"></div><div class="code">${esc(b.token)}</div><p class="small muted">รหัสนี้สุ่มขึ้นและไม่มีข้อมูลส่วนตัว แสดงให้เจ้าหน้าที่สแกนหน้างานในวันนัด</p></div>`;
  if (['checkedin','inprogress'].includes(b.status)){
    if (safety) h += `<div class="card"><h2>ก่อนเริ่ม</h2><ul class="plain small">${safety.fix.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
    if (b.mode === 'self' && kb) h += `<div class="card"><h2>ขั้นตอนซ่อม: ${esc(kb.title)}</h2><p class="small muted">ขอบเขตที่อนุญาต: ${esc(a.scope)}</p><ol class="plain">${kb.fix.map(f => `<li>${esc(f)}</li>`).join('')}</ol></div>`;
    h += b.call ? `<div class="banner info" role="status"><b>เรียกช่างแล้ว</b><span class="small">${b.call === 'ack' ? 'ช่างกำลังเดินมาที่โต๊ะ' : 'รอช่างรับเรื่อง'}</span></div>` : `<button type="button" class="btn pri" data-a="callTech" data-id="${b.id}">เรียกช่างมาที่โต๊ะ</button>`; }
  if (b.billTotal != null){ h += billCard(b); if (b.tools.some(t => t.status === 'out')) h += `<p class="small muted">นำเครื่องมือคืนที่เคาน์เตอร์ เจ้าหน้าที่จะสแกนตรวจให้ครบก่อนปิดเคส</p>`; }
  if (c.status === 'closed') h += rv ? `<div class="card"><h2>รีวิวของคุณ</h2><p><span aria-label="${rv.stars} ดาว">${'★'.repeat(rv.stars)}${'☆'.repeat(5 - rv.stars)}</span> ${esc(rv.text)}</p></div>`
    : `<div class="card"><h2 id="rv-h">ให้คะแนนบริการ</h2><div class="stars" role="group" aria-labelledby="rv-h">${[1,2,3,4,5].map(i => `<button type="button" data-a="star" data-id="${i}" class="${(S.d.stars || 0) >= i ? 'on' : ''}" aria-pressed="${(S.d.stars || 0) === i}" aria-label="${i} ดาว">★</button>`).join('')}</div><label class="f">ความคิดเห็น<textarea id="rv-text" data-m="rv">${esc(S.d.rv)}</textarea></label><button type="button" class="btn pri" data-a="review" data-id="${b.id}">ส่งรีวิว</button></div>`;
  if (b.status === 'confirmed') h += `<div><button type="button" class="btn sm danger" data-a="cancel" data-id="${b.id}">${S.d.cf === b.id ? 'กดอีกครั้งเพื่อยืนยันการยกเลิก' : 'ยกเลิกการจอง'}</button></div>`;
  return h; }

/* ================= มุมมองช่าง ================= */
function techView(){ const v = S.view;
  if (v && v.n === 'assess') return back() + vAssess(v);
  if (v && v.n === 'job') return back() + vJob(v);
  if (S.tab === 'jobs') return vJobs();
  if (S.tab === 'me') return vMe();
  const qs = S.cases.filter(c => ['waiting','needinfo'].includes(c.status)).sort((a, b) => (b.risk === 'high') - (a.risk === 'high') || a.created.localeCompare(b.created));
  return `<div><p class="eyebrow">${esc(S.me.full_name)} · ${esc(S.techs.find(t => t.user_id === S.me.id)?.id || 'ช่าง')}</p><h1 tabindex="-1">คิวประเมิน</h1></div>${qs.map(c => { const left = Math.max(0, 24 - Math.floor((Date.now() - new Date(c.created)) / 36e5));
    return `<div class="card tag"><div class="row between"><span class="mono">${c.id}</span>${chip(c.status === 'needinfo' ? ['รอผู้แจ้งตอบ','warn'] : [`เหลือ ${left} ชม.`, left < 6 ? 'bad' : ''])}</div>
    <h3>${esc(devName(by('devices', c.deviceId)))}</h3><p class="small muted">${esc(c.syms.join(', '))}</p><div class="row">${chip(RISK[c.risk])}</div>
    <div><button type="button" class="btn sm pri" data-a="openAssess" data-id="${c.id}">เปิดประเมิน ${c.id}</button></div></div>`; }).join('') || `<p class="muted">ไม่มีเคสรอประเมิน</p>`}`; }
function vAssess(v){ const c = by('cases', v.id), d = S.d, dev = by('devices', c.deviceId);
  needPhotos(c);
  const canAssess = ['waiting','needinfo'].includes(c.status);
  return `<div class="row between"><h1 tabindex="-1">ประเมิน ${c.id}</h1>${chip(RISK[c.risk])}</div>
  <div class="card"><dl class="kv"><dt>เครื่อง</dt><dd>${esc(devName(dev))} · ซื้อปี ${esc(dev?.year || '-')}</dd><dt>อาการ</dt><dd>${esc(c.syms.join(', '))}</dd><dt>รายละเอียด</dt><dd>${esc(c.detail || '-')}</dd><dt>เริ่มเป็น</dt><dd>${esc(c.since || '-')}</dd><dt>ตกน้ำ / ตกพื้น</dt><dd>${esc(c.dropped)}</dd><dt>ผู้แจ้ง</dt><dd>${esc(userName(c.userId))} <span class="small muted">(เบอร์โทรซ่อนไว้ ติดต่อผ่านแชต)</span></dd><dt>ภาพ</dt>${photoStrip(c)}</dl></div>
  ${canAssess ? `<div class="card"><h2 id="lv-h">ผลประเมิน</h2><div class="opt" role="group" aria-labelledby="lv-h">${Object.keys(LEVEL).map(k => `<button type="button" data-a="aLevel" data-id="${k}" aria-pressed="${d.level === k}" ${k === 'self' && c.risk === 'high' ? 'disabled' : ''}>${LEVEL[k][0]}</button>`).join('')}</div>
  ${c.risk === 'high' ? `<p class="small muted">เคสเสี่ยงสูง ระบบล็อกไม่ให้เลือก “ซ่อมเองได้”</p>` : ''}
  <label class="f">สาเหตุที่น่าจะเป็น<input id="a-cause" data-m="cause" value="${esc(d.cause)}"></label>
  ${d.level === 'self' ? `<label class="f">ขอบเขตงานที่อนุญาตให้ผู้แจ้งทำ<textarea id="a-scope" data-m="scope">${esc(d.scope)}</textarea></label>` : ''}
  <label class="f">เวลาที่ใช้ (นาที)<input id="a-min" data-m="minutes" inputmode="numeric" value="${esc(d.minutes)}"></label>
  <h3 id="ap-h">อะไหล่ที่คาดว่าต้องใช้</h3><div class="opt" role="group" aria-labelledby="ap-h">${S.parts.map(p => `<button type="button" data-a="aPart" data-id="${p.id}" aria-pressed="${d.parts.includes(p.id)}">${esc(p.name)}</button>`).join('')}</div>
  <h3 id="at-h">เครื่องมือที่แนะนำ</h3><div class="opt" role="group" aria-labelledby="at-h">${S.tools.map(t => `<button type="button" data-a="aTool" data-id="${t.id}" aria-pressed="${d.tools.includes(t.id)}">${esc(t.name)}</button>`).join('')}</div>
  ${d.level === 'self' ? `<h3 id="aa-h">เครื่องมือที่ผู้แจ้งเพิ่มเองได้</h3><div class="opt" role="group" aria-labelledby="aa-h">${S.tools.filter(t => !d.tools.includes(t.id)).map(t => `<button type="button" data-a="aAllow" data-id="${t.id}" aria-pressed="${d.allowed.includes(t.id)}">${esc(t.name)}</button>`).join('')}</div>` : ''}
  <div class="row"><button type="button" class="btn pri" data-a="submitAssess" data-id="${c.id}" ${S.busy ? 'disabled' : ''}>ส่งผลประเมิน</button><button type="button" class="btn" data-a="needInfo" data-id="${c.id}">ขอข้อมูลเพิ่ม</button></div></div>`
  : (lastA(c.id) ? assessCard(lastA(c.id)) : '')}${chatBox(c)}`; }
function vJobs(){ const bs = S.bookings.filter(b => ['confirmed','checkedin','inprogress'].includes(b.status) || (b.status === 'completed' && by('cases', b.caseId)?.status !== 'closed')).sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
  const early = S.settings.allow_early_checkin === 'true', next = bs.find(b => b.status === 'confirmed');
  return `<h1 tabindex="-1">งานหน้างาน</h1><div class="card"><h2>เช็กอินผู้รับบริการ</h2><div class="row"><input id="ci-code" class="grow mono" data-m="code" aria-label="รหัสเช็กอิน" placeholder="สแกนหรือพิมพ์รหัส RS-XXXXX-XXXXX" value="${esc(S.d.code)}" data-enter="checkin"><button type="button" class="btn pri" data-a="checkin">เช็กอิน</button></div>
  ${early && next ? `<button type="button" class="link small" data-a="fillCode" data-id="${esc(next.token)}">เดโม: เติมรหัสของคิวถัดไป</button>` : ''}
  <p class="small muted">${early ? 'โหมดทดลองเปิดอยู่: เช็กอินก่อนวันนัดได้ (แอดมินปิดได้ที่หน้าบันทึก)' : 'รหัสใช้ได้เฉพาะวันนัด'}</p></div>
  ${bs.map(b => { const c = by('cases', b.caseId); return `<div class="card"><div class="row between"><span class="mono">${b.id} · ${c.id}</span>${chip(BSTAT[b.status])}</div><h3>${fdate(b.date)} ${b.slot} · ${esc(station(b.stationId).name)}</h3>
  <p class="small muted">${esc(devName(by('devices', c.deviceId)))} · ${b.mode === 'self' ? 'ผู้แจ้งซ่อมเอง' : 'ช่างซ่อม'}</p>${b.call === 'open' ? `<span class="chip bad">ผู้รับบริการเรียกช่าง</span>` : ''}
  <div><button type="button" class="btn sm" data-a="go" data-n="job" data-id="${b.id}">เปิดงาน ${b.id}</button></div></div>`; }).join('') || `<p class="muted">ยังไม่มีคิวที่ยืนยันแล้ว</p>`}`; }
function vJob(v){ const b = by('bookings', v.id), c = by('cases', b.caseId), a = by('assessments', b.assessId), d = S.d;
  let h = `<div class="row between"><h1 tabindex="-1">งาน ${b.id}</h1>${chip(BSTAT[b.status])}</div><div class="card"><dl class="kv"><dt>นัด</dt><dd>${fdate(b.date)} ${b.slot} · ${esc(station(b.stationId).name)}</dd><dt>เครื่อง</dt><dd>${esc(devName(by('devices', c.deviceId)))}</dd><dt>ผู้รับบริการ</dt><dd>${esc(userName(b.userId))}</dd><dt>รูปแบบ</dt><dd>${b.mode === 'self' ? 'ผู้แจ้งซ่อมเอง' : 'ช่างดำเนินการ'}</dd>${a ? `<dt>สาเหตุที่คาด</dt><dd>${esc(a.cause)}</dd><dt>ขอบเขต</dt><dd>${esc(a.scope || '-')}</dd>` : '<dt>ผลประเมิน</dt><dd>ยังไม่มี ตรวจหน้างาน</dd>'}</dl></div>`;
  if (b.call === 'open') h += `<div class="banner bad" role="alert"><b>ผู้รับบริการเรียกช่างที่ ${esc(station(b.stationId).name)}</b><div><button type="button" class="btn sm" data-a="ack" data-id="${b.id}">รับเรื่อง</button></div></div>`;
  if (b.status === 'confirmed') h += `<p class="muted small">รอเช็กอินด้วยรหัส QR ของผู้รับบริการ</p>`;
  if (b.status === 'checkedin') h += `<button type="button" class="btn pri" data-a="startRepair" data-id="${b.id}">ส่งมอบโต๊ะและเครื่องมือ เริ่มซ่อม</button>`;
  if (b.status === 'inprogress'){
    if (b.mode === 'self') h += `<div><button type="button" class="btn danger" data-a="takeOver" data-id="${b.id}">หยุดงานซ่อมเอง ช่างรับช่วงต่อ</button></div>`;
    h += `<div class="card"><h2 id="res-h">บันทึกผล</h2><div class="opt" role="group" aria-labelledby="res-h">${[['ok','ซ่อมได้'],['fail','ซ่อมไม่ได้'],['refer','ต้องส่งต่อ']].map(([k, t]) => `<button type="button" data-a="res" data-id="${k}" aria-pressed="${d.res === k}">${t}</button>`).join('')}</div>
    ${b.parts.filter(p => p.source !== 'own').map(p => `<label class="f">${esc(partName(p.partId))} ใช้จริง (กันไว้ ${p.qty})<input id="u-${p.partId}" data-m="u_${p.partId}" inputmode="numeric" value="${esc(d['u_' + p.partId] ?? p.qty)}"></label>`).join('')}
    <label class="f">รายละเอียด<textarea id="r-note" data-m="note">${esc(d.note)}</textarea></label><button type="button" class="btn pri" data-a="saveResult" data-id="${b.id}" ${S.busy ? 'disabled' : ''}>บันทึกผลและสรุป</button></div>`; }
  if (b.status === 'completed'){ h += billCard(b);
    if (b.tools.length) h += `<div class="card"><h2>ตรวจรับเครื่องมือคืน</h2>${b.tools.map(t => `<div class="row between"><span>${esc(toolName(t.toolId))}</span>${t.status === 'returned' ? chip(['คืนแล้ว','ok']) : `<button type="button" class="btn sm" data-a="ret" data-id="${b.id}" data-t="${t.toolId}">สแกนรับคืน ${esc(toolName(t.toolId))}</button>`}</div>`).join('')}</div>`;
    h += `<p class="small muted">เคสปิดเองเมื่อบันทึกผลแล้วและคืนเครื่องมือครบ</p>`; }
  return h + chatBox(c); }

/* ================= มุมมองแอดมิน ================= */
function adminView(){ const v = S.view; if (v && v.n === 'job') return back() + vJob(v); if (v && v.n === 'case') return back() + vCase(v);
  return ({dash:aDash, jobs:vJobs, sched:aSched, stock:aStock, pay:aPay, log:aLog}[S.tab] || aDash)(); }
function aDash(){ const today = dkey(new Date()), done = S.results, ok = done.filter(r => r.res === 'ok');
  const kg = ok.reduce((s, r) => { const b = by('bookings', r.bookingId), c = b && by('cases', b.caseId), d = c && by('devices', c.deviceId); return s + (d ? KG[d.type] || 0 : 0); }, 0);
  const avg = S.reviews.length ? (S.reviews.reduce((s, r) => s + r.stars, 0) / S.reviews.length).toFixed(1) : '–';
  const support = S.bookings.reduce((s, b) => s + (b.billTotal || 0), 0);
  const suspended = S.users.filter(u => u.noshow_count >= NOSHOW_LIMIT);
  return `<div><p class="eyebrow">เจ้าหน้าที่ศูนย์</p><h1 tabindex="-1">แดชบอร์ด</h1></div><div class="stat">
  <div><b>${S.cases.filter(c => c.status === 'waiting').length}</b><span class="small muted">เคสรอประเมิน</span></div>
  <div><b>${S.bookings.filter(b => live(b) && b.date === today).length}</b><span class="small muted">คิววันนี้</span></div>
  <div><b>${S.bookings.filter(b => b.status === 'noshow').length}</b><span class="small muted">ไม่มาตามนัด</span></div>
  <div><b>${S.parts.filter(p => p.stock - p.reserved <= 1).length}</b><span class="small muted">อะไหล่ใกล้หมด</span></div></div>
  <h2>รายงาน</h2><div class="stat"><div><b>${done.length}</b><span class="small muted">งานที่จบ</span></div><div><b>${done.length ? Math.round(ok.length / done.length * 100) + '%' : '–'}</b><span class="small muted">ซ่อมสำเร็จ</span></div>
  <div><b>${kg.toFixed(1)} กก.</b><span class="small muted">ขยะอิเล็กทรอนิกส์ที่ลดได้ (ประมาณ)</span></div><div><b>${avg}</b><span class="small muted">คะแนนรีวิวเฉลี่ย</span></div><div><b>${baht(support)}</b><span class="small muted">มูลค่าอะไหล่ที่สนับสนุนประชาชน</span></div></div>
  ${suspended.length ? `<h2>ผู้ใช้ที่ถูกพักสิทธิ์</h2>${suspended.map(u => `<div class="card"><div class="row between"><span>${esc(u.full_name)} · ไม่มาตามนัด ${u.noshow_count} ครั้ง</span><button type="button" class="btn sm" data-a="resetNoshow" data-id="${u.id}">คืนสิทธิ์</button></div></div>`).join('')}` : ''}
  ${S.reviews.length ? `<h2>รีวิวล่าสุด</h2>` + S.reviews.slice(-5).reverse().map(r => `<div class="card"><p><span aria-label="${r.stars} ดาว">${'★'.repeat(r.stars)}</span> ${esc(r.text)}</p><span class="small muted mono">${r.bookingId}</span></div>`).join('') : ''}`; }
function aSched(){ const ds = days().slice(0, 3), act = S.bookings.filter(live);
  return `<h1 tabindex="-1">ตารางคิว</h1>${ds.map(k => `<h2>${fdate(k)}</h2><div class="tw" tabindex="0"><table><caption class="small muted" style="text-align:left">คิวรายโต๊ะ ${fdate(k)}</caption><thead><tr><th scope="col">เวลา</th>${S.stations.map(s => `<th scope="col">${s.id}</th>`).join('')}</tr></thead><tbody>
  ${S.slots.map(s => `<tr><th scope="row">${s}</th>${S.stations.map(st => { const b = act.find(x => x.date === k && x.slot === s && x.stationId === st.id); return `<td>${b ? `<span class="chip ${BSTAT[b.status][1]}">${b.id}</span>` : '<span class="muted">ว่าง</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}
  <h2>การจองทั้งหมด</h2><div class="tw" tabindex="0"><table><thead><tr><th scope="col">รหัส</th><th scope="col">นัด</th><th scope="col">ผู้รับบริการ</th><th scope="col">สถานะ</th><th scope="col"><span class="sr">การดำเนินการ</span></th></tr></thead><tbody>${S.bookings.slice().reverse().map(b => `<tr><td class="mono">${b.id}</td><td>${fdate(b.date)} ${b.slot}</td><td>${esc(userName(b.userId))}</td><td>${chip(BSTAT[b.status])}</td><td>${b.status === 'confirmed' ? `<button type="button" class="btn sm" data-a="noshow" data-id="${b.id}">${S.d.ns === b.id ? 'กดอีกครั้งเพื่อยืนยัน' : 'ไม่มาตามนัด'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">ยังไม่มีการจอง</td></tr>'}</tbody></table></div>`; }
function aStock(){ return `<h1 tabindex="-1">อุปกรณ์และอะไหล่</h1><h2>เครื่องมือ</h2><div class="tw" tabindex="0"><table><thead><tr><th scope="col">เครื่องมือ</th><th class="num" scope="col">ทั้งหมด</th><th class="num" scope="col">ซ่อมบำรุง</th><th class="num" scope="col">พร้อมจอง</th><th scope="col"><span class="sr">การดำเนินการ</span></th></tr></thead><tbody>
  ${S.tools.map(t => `<tr><td>${esc(t.name)}</td><td class="num">${t.qty}</td><td class="num">${t.maint}</td><td class="num">${t.qty - t.maint}</td><td><button type="button" class="btn sm" data-a="maint" data-id="${t.id}" data-v="1" ${t.maint >= t.qty ? 'disabled' : ''}>ส่งซ่อมบำรุง</button> <button type="button" class="btn sm" data-a="maint" data-id="${t.id}" data-v="-1" ${t.maint ? '' : 'disabled'}>กลับมาใช้</button></td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">จำนวนที่ถูกจองคิดแยกตามช่วงเวลา จึงจองล่วงหน้าได้แม้ตอนนี้มีคนใช้อยู่</p>
  <h2>อะไหล่</h2><div class="tw" tabindex="0"><table><thead><tr><th scope="col">รหัส</th><th scope="col">อะไหล่</th><th class="num" scope="col">คงเหลือ</th><th class="num" scope="col">กันไว้</th><th class="num" scope="col">พร้อมจ่าย</th><th class="num" scope="col">ใช้จริง</th><th class="num" scope="col">มูลค่า</th><th scope="col"><span class="sr">การดำเนินการ</span></th></tr></thead><tbody>
  ${S.parts.map(p => `<tr><td class="mono">${p.id}</td><td>${esc(p.name)}<br><span class="muted">${esc(p.fits)}</span></td><td class="num">${p.stock}</td><td class="num">${p.reserved}</td><td class="num">${p.stock - p.reserved}</td><td class="num">${p.used}</td><td class="num">${p.value}</td><td><button type="button" class="btn sm" data-a="restock" data-id="${p.id}">รับเข้า +5</button></td></tr>`).join('')}</tbody></table></div>`; }
function aPay(){ const bs = S.bookings.filter(b => b.billTotal != null);
  return `<h1 tabindex="-1">งบสนับสนุน</h1><p class="small muted">บริการไม่เก็บเงินจากประชาชน หน้านี้ใช้รายงานมูลค่าอะไหล่ที่ศูนย์จ่ายออก เพื่อประกอบการของบประมาณ</p><div class="tw" tabindex="0"><table><thead><tr><th scope="col">การจอง</th><th scope="col">วันที่</th><th scope="col">รายการ</th><th class="num" scope="col">มูลค่า (บาท)</th></tr></thead><tbody>
  ${bs.map(b => `<tr><td class="mono">${b.id}</td><td>${fdate(b.date)}</td><td>${b.parts.filter(p => p.used && p.source !== 'own').map(p => esc(partName(p.partId)) + ' ×' + p.used).join(', ') || '-'}</td><td class="num">${b.billTotal}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีงานที่จบ</td></tr>'}
  <tr><th scope="row" colspan="3">รวม</th><th class="num">${bs.reduce((s, b) => s + b.billTotal, 0)}</th></tr></tbody></table></div>`; }
function aLog(){ const early = S.settings.allow_early_checkin === 'true';
  return `<h1 tabindex="-1">บันทึกและการตั้งค่า</h1>
  <div class="card"><div class="row between"><div class="grow"><h3>อนุญาตเช็กอินก่อนวันนัด</h3><p class="small muted">เปิดไว้สำหรับทดลองระบบ ควรปิดก่อนเปิดให้บริการจริง</p></div><button type="button" class="btn sm" data-a="toggleEarly" aria-pressed="${early}">${early ? 'เปิดอยู่ · กดเพื่อปิด' : 'ปิดอยู่ · กดเพื่อเปิด'}</button></div></div>
  <div class="tw" tabindex="0"><table><thead><tr><th scope="col">เวลา</th><th scope="col">ผู้ทำ</th><th scope="col">รายการ</th></tr></thead><tbody>${S.log.map(l => `<tr><td>${ftime(l.created_at)}</td><td>${esc(l.actor_name)}</td><td>${esc(l.action)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีบันทึก</td></tr>'}</tbody></table></div>`; }

/* ================= การกระทำ ================= */
const go = (n, id) => { S.view = {n, id}; S.d = {}; };
async function rpc(fn, args){ const {data, error} = await sb.rpc(fn, args); if (error) throw error; return data; }
async function refresh(){ await loadAll(); }
async function bookOptions(){ const d = S.d; d.loading = true; render();
  try { d.opts = (await rpc('booking_options', {p_mode:d.mode, p_date:d.date, p_tools:d.tools})).map(o => ({slot:hm(o.slot), ok:o.ok, stations:o.stations || []})); }
  catch (e) { d.opts = []; fail(e); }
  d.loading = false; }
async function resize(file){ const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement('canvas'), s = Math.min(1, 1280 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .8); }
const dataUrlBlob = u => fetch(u).then(r => r.blob());
function needPhotos(c){ const paths = c.photos.filter(p => p.path !== 'demo' && !(p.path in S.photoUrls)).map(p => p.path); if (!paths.length) return;
  paths.forEach(p => S.photoUrls[p] = '');
  sb.storage.from('case-photos').createSignedUrls(paths, 600).then(({data}) => { (data || []).forEach(x => { if (x.signedUrl) S.photoUrls[x.path] = x.signedUrl; }); render(); }); }

const A = {
  authMode(e){ S.auth = {mode:e.id, email:S.auth.email, pw:''}; },
  demoLogin(e){ S.auth.email = e.id; S.auth.pw = 'ReSpace#Demo2026'; return A.signin(); },
  async signin(){ const a = S.auth; if (!a.email || !a.pw) return toast('กรอกอีเมลและรหัสผ่าน');
    S.busy = true; render(); const {error} = await sb.auth.signInWithPassword({email:a.email.trim(), password:a.pw}); S.busy = false;
    if (error) return toast(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message); },
  async signup(){ const a = S.auth;
    if (!a.name?.trim()) return toast('กรอกชื่อ–นามสกุล'); if (!a.email?.trim()) return toast('กรอกอีเมล'); if ((a.pw || '').length < 8) return toast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); if (!a.pdpa) return toast('กรุณายินยอมการเก็บข้อมูลเพื่อให้บริการ');
    S.busy = true; render();
    const {data, error} = await sb.auth.signUp({email:a.email.trim(), password:a.pw, options:{emailRedirectTo:location.origin + location.pathname, data:{full_name:a.name.trim(), phone:(a.phone || '').trim(), district:(a.district || '').trim()}}});
    S.busy = false; if (error) return toast(error.message);
    if (!data.session) S.auth = {mode:'login', email:a.email, msg:'ลงทะเบียนแล้ว เปิดอีเมลเพื่อยืนยันบัญชี จากนั้นกลับมาเข้าสู่ระบบ'}; },
  async logout(){ await sb.auth.signOut(); },
  tab(e){ S.tab = e.id; S.view = null; S.d = {}; if (e.id === 'me') markRead(); },
  go(e){ go(e.n, e.id); }, back(){ S.view = null; S.d = {}; },
  newTriage(e){ go('triage'); S.d = {step:1, deviceId:mine('devices')[0]?.id || 'new', type:TYPES[0], brand:'', model:'', year:'', warranty:'ไม่ทราบ', photos:{}, syms:[], detail:'', since:'', dropped:'ไม่เคย', direct:!!e.direct}; },
  pickDev(e){ S.d.deviceId = e.id; },
  async addDevice(d){ const {data, error} = await sb.from('devices').insert({type:d.type || TYPES[0], brand:d.brand.trim(), model:(d.model || '').trim(), year:(d.year || '').trim(), warranty:d.warranty || 'ไม่ทราบ'}).select().single(); if (error) throw error; return data; },
  async saveDevice(){ const d = S.d; if (!d.brand?.trim()) return toast('กรอกยี่ห้อก่อนบันทึก'); await A.addDevice(d); await refresh(); S.view = null; S.tab = 'devices'; toast('เพิ่มเครื่องแล้ว'); },
  tPrev(){ S.d.step--; },
  async tNext(){ const d = S.d;
    if (d.step === 1 && d.deviceId === 'new'){ if (!d.brand.trim()) return toast('กรอกยี่ห้อของเครื่องใหม่'); const x = await A.addDevice(d); await refresh(); d.deviceId = x.id; }
    if (d.step === 2 && !(d.photos.a && d.photos.b && d.photos.c)) return toast('แนบภาพให้ครบ 3 มุม');
    if (d.step === 3 && !d.syms.length) return toast('เลือกอาการอย่างน้อย 1 ข้อ');
    d.step++; },
  demoPhotos(){ S.d.photos = {a:'demo', b:'demo', c:'demo'}; },
  sym(e){ const s = S.d.syms, i = s.indexOf(e.id); i < 0 ? s.push(e.id) : s.splice(i, 1); },
  async submitCase(){ const d = S.d; S.busy = true; render();
    try {
      const id = await rpc('submit_case', {p_device:d.deviceId, p_symptoms:d.syms, p_detail:d.detail, p_since:d.since, p_dropped:d.dropped});
      const uid = S.me.id;
      for (const k of ['a','b','c']){ const p = d.photos[k]; let path = 'demo';
        if (p && p !== 'demo'){ path = `${uid}/${id}/${k}.jpg`; const {error} = await sb.storage.from('case-photos').upload(path, await dataUrlBlob(p), {contentType:'image/jpeg', upsert:true}); if (error) throw error; }
        const {error} = await sb.from('case_photos').insert({case_id:id, kind:k, path}); if (error) throw error; }
      await refresh();
      if (d.direct) return A.startBook({id});
      go('case', id); toast('ส่งเคสเข้าคิวช่างแล้ว');
    } finally { S.busy = false; } },
  async sendChat(e){ const i = $('#chat-in'), t = i.value.trim(); if (!t) return; i.value = '';
    const {error} = await sb.from('chats').insert({case_id:e.id, body:t}); if (error) throw error; await refresh(); },
  async saveProfile(){ const d = S.d, patch = {}; ['full_name','phone','district'].forEach(k => { if (d[k] != null) patch[k] = d[k].trim(); });
    if (!Object.keys(patch).length) return toast('ยังไม่มีการเปลี่ยนแปลง');
    const {error} = await sb.from('profiles').update(patch).eq('id', S.me.id); if (error) throw error; await refresh(); S.d = {}; toast('บันทึกโปรไฟล์แล้ว'); },
  /* ช่าง */
  openAssess(e){ go('assess', e.id); S.d = {level:'tech', cause:'', scope:'', minutes:'40', parts:[], tools:[], allowed:[]}; },
  aLevel(e){ S.d.level = e.id; },
  aPart(e){ const a = S.d.parts, i = a.indexOf(e.id); i < 0 ? a.push(e.id) : a.splice(i, 1); },
  aTool(e){ const a = S.d.tools, i = a.indexOf(e.id); i < 0 ? a.push(e.id) : a.splice(i, 1); S.d.allowed = S.d.allowed.filter(x => x !== e.id); },
  aAllow(e){ const a = S.d.allowed, i = a.indexOf(e.id); i < 0 ? a.push(e.id) : a.splice(i, 1); },
  async needInfo(e){ await rpc('request_info', {p_case:e.id}); await refresh(); S.view = null; toast('ส่งคำขอข้อมูลเพิ่มแล้ว'); },
  async submitAssess(e){ const d = S.d; S.busy = true;
    try { await rpc('submit_assessment', {p_case:e.id, p_level:d.level, p_cause:d.cause, p_scope:d.scope, p_minutes:parseInt(d.minutes) || 40, p_parts:d.parts, p_tools:d.tools, p_allowed:d.allowed});
      await refresh(); S.view = null; toast('ส่งผลประเมินแล้ว'); } finally { S.busy = false; } },
  /* จอง */
  async startBook(e){ const c = by('cases', e.id), a = lastA(c.id);
    if (a && a.level === 'notworth') return toast('เคสนี้ประเมินว่าไม่คุ้มซ่อม');
    if (liveB(c.id)) return go('booking', liveB(c.id).id);
    const self = a && a.level === 'self' && c.risk !== 'high'; go('book');
    S.d = {step:1, caseId:c.id, mode:self ? 'self' : 'tech', date:days()[1], slot:'', stationId:'', tools:self ? [...a.tools] : [], parts:a ? a.parts.map(p => ({...p, source:'stock'})) : [], consent:false};
    await bookOptions(); },
  async bMode(e){ const d = S.d, a = lastA(d.caseId); d.mode = e.id; d.tools = e.id === 'self' ? [...a.tools] : []; d.slot = ''; d.stationId = ''; await bookOptions(); },
  async bDate(e){ S.d.date = e.id; S.d.slot = ''; S.d.stationId = ''; await bookOptions(); },
  bSlot(e){ S.d.slot = e.id; S.d.stationId = ''; },
  bStation(e){ S.d.stationId = e.id; },
  async bTool(e){ const d = S.d, prev = [...d.tools], i = d.tools.indexOf(e.id); i < 0 ? d.tools.push(e.id) : d.tools.splice(i, 1);
    await bookOptions(); const cur = (d.opts || []).find(o => o.slot === d.slot);
    if (!cur || !cur.ok){ d.tools = prev; await bookOptions(); return toast('เครื่องมือนี้ไม่ว่างในช่วงเวลาที่เลือก'); }
    if (!cur.stations.includes(d.stationId)){ d.stationId = cur.stations[0] || ''; toast('งานบัดกรีใช้โต๊ะงานไฟฟ้า ระบบเปลี่ยนโต๊ะให้แล้ว'); } },
  bSrc(e){ S.d.parts.find(p => p.partId === e.id).source = e.s; },
  bPrev(){ S.d.step--; },
  bNext(){ const d = S.d; if (d.step === 1){ const cur = (d.opts || []).find(o => o.slot === d.slot); d.stationId = cur?.stations[0] || ''; } d.step++; },
  async commit(){ const d = S.d; if (!d.consent) return toast('ติ๊กรับทราบข้อตกลงก่อนยืนยัน');
    S.busy = true; render();
    try { const id = await rpc('create_booking', {p_case:d.caseId, p_mode:d.mode, p_date:d.date, p_slot:d.slot, p_station:d.stationId, p_tools:d.tools, p_sources:Object.fromEntries(d.parts.map(p => [p.partId, p.source])), p_consent:CONSENT_VER});
      await refresh(); go('booking', id); toast('ยืนยันคิวแล้ว'); }
    catch (err){ if (/เพิ่งถูกจอง|ไม่ว่าง/.test(err.message)){ d.step = 1; d.slot = ''; await bookOptions(); } throw err; }
    finally { S.busy = false; } },
  async cancel(e){ if (S.d.cf !== e.id){ S.d.cf = e.id; return; } await rpc('cancel_booking', {p_booking:e.id}); await refresh(); S.d = {}; toast('ยกเลิกแล้ว ขอบคุณที่คืนคิวให้คนอื่น'); },
  async callTech(e){ await rpc('call_tech', {p_booking:e.id}); await refresh(); toast('เรียกช่างแล้ว'); },
  star(e){ S.d.stars = +e.id; },
  async review(e){ if (!S.d.stars) return toast('เลือกจำนวนดาว'); await rpc('submit_review', {p_booking:e.id, p_stars:S.d.stars, p_body:S.d.rv || ''}); await refresh(); S.d = {}; toast('ขอบคุณสำหรับรีวิว'); },
  /* หน้างาน */
  fillCode(e){ S.d.code = e.id; },
  async checkin(){ const id = await rpc('check_in', {p_token:S.d.code || ''}); await refresh(); go('job', id); toast('เช็กอินแล้ว'); },
  async ack(e){ await rpc('ack_call', {p_booking:e.id}); await refresh(); },
  async startRepair(e){ await rpc('start_repair', {p_booking:e.id}); await refresh(); },
  async takeOver(e){ await rpc('take_over', {p_booking:e.id}); await refresh(); toast('ช่างรับช่วงงานแล้ว'); },
  res(e){ S.d.res = e.id; },
  async saveResult(e){ const d = S.d, b = by('bookings', e.id); if (!d.res) return toast('เลือกผลซ่อม');
    const used = Object.fromEntries(b.parts.filter(p => p.source !== 'own').map(p => [p.partId, Math.max(0, parseInt(d['u_' + p.partId] ?? p.qty) || 0)]));
    S.busy = true; try { await rpc('save_result', {p_booking:e.id, p_result:d.res, p_note:d.note || '', p_used:used}); await refresh(); S.d = {}; toast('บันทึกผลแล้ว'); } finally { S.busy = false; } },
  async ret(e){ await rpc('return_tool', {p_booking:e.id, p_tool:e.t}); await refresh(); },
  /* แอดมิน */
  async noshow(e){ if (S.d.ns !== e.id){ S.d.ns = e.id; return; } await rpc('mark_noshow', {p_booking:e.id}); await refresh(); S.d = {}; toast('บันทึกไม่มาตามนัดแล้ว'); },
  async resetNoshow(e){ await rpc('reset_noshow', {p_user:e.id}); await refresh(); toast('คืนสิทธิ์แล้ว'); },
  async maint(e){ await rpc('set_tool_maint', {p_tool:e.id, p_delta:+e.v}); await refresh(); },
  async restock(e){ await rpc('restock_part', {p_part:e.id, p_qty:5}); await refresh(); toast('รับอะไหล่เข้าแล้ว'); },
  async toggleEarly(){ await rpc('set_setting', {p_key:'allow_early_checkin', p_value:S.settings.allow_early_checkin === 'true' ? 'false' : 'true'}); await refresh(); }
};
async function markRead(){ if (!S.notifs.some(n => !n.read)) return; await sb.from('notifications').update({read:true}).eq('user_id', S.me.id).eq('read', false); }

/* ================= วาดหน้าจอ ================= */
let lastViewKey = '';
function render(){
  const main = $('#main'), user = $('#user'), tabs = $('#tabs');
  if (!S.ready){ main.innerHTML = `<p class="muted" role="status">กำลังโหลด…</p>`; return; }
  if (!S.session || !S.me){ user.innerHTML = ''; tabs.innerHTML = ''; $('nav.tabs').hidden = true; main.innerHTML = vAuth(); }
  else {
    $('nav.tabs').hidden = false;
    user.innerHTML = `<span class="small"><b>${esc(S.me.full_name || S.session.user.email)}</b> · ${ROLE[role()]}</span><button type="button" class="btn sm" data-a="logout">ออกจากระบบ</button>`;
    main.innerHTML = role() === 'citizen' ? citizenView() : role() === 'tech' ? techView() : adminView();
    tabs.innerHTML = TABS[role()].map(([k, t]) => `<button type="button" data-a="tab" data-id="${k}" ${!S.view && S.tab === k ? 'aria-current="page"' : ''}>${t}</button>`).join('');
  }
  document.querySelectorAll('[data-qr]').forEach(el => { try { const q = qrcode(0, 'M'); q.addData(el.dataset.qr); q.make(); el.innerHTML = q.createSvgTag({cellSize:4, margin:0, scalable:true}); } catch (e) { el.hidden = true; } });
  const cl = $('#chatlog'); if (cl) cl.scrollTop = cl.scrollHeight;
  const key = (S.session ? role() + S.tab : 'auth' + S.auth.mode) + JSON.stringify(S.view) + (S.d.step || '');
  if (key !== lastViewKey){ lastViewKey = key; const h = main.querySelector('h1'); if (h && document.activeElement !== h && !main.contains(document.activeElement)) h.focus({preventScroll:false}); }
}
async function act(el){
  const name = el.dataset.a, nav = ['tab','go','back'].includes(name);
  try { await A[name](el.dataset); } catch (e) { fail(e); }
  render(); if (nav) window.scrollTo(0, 0);
}
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; act(el); });
document.addEventListener('submit', e => { if (e.target.id === 'auth-form'){ e.preventDefault(); (S.auth.mode === 'signup' ? A.signup() : A.signin()).catch(fail).finally(render); } });
document.addEventListener('input', e => { const el = e.target; if (!el.dataset.m) return; const tgt = S.session && S.me ? S.d : S.auth; tgt[el.dataset.m] = el.type === 'checkbox' ? el.checked : el.value; });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.enter){ e.preventDefault(); act({dataset:{...e.target.dataset, a:e.target.dataset.enter}}).then(() => $('#' + e.target.id)?.focus()); } });
document.addEventListener('change', async e => { const el = e.target; if (!el.dataset.ph || !el.files[0]) return;
  try { S.d.photos[el.dataset.ph] = await resize(el.files[0]); } catch (err) { toast('อ่านไฟล์ภาพไม่ได้ ลองภาพอื่น'); } render(); });

/* โหลดข้อมูลใหม่เป็นระยะ เมื่อไม่ได้กรอกฟอร์มอยู่ */
setInterval(async () => {
  if (!S.session || !S.me || document.hidden || S.busy) return;
  if (S.view && ['triage','book','assess','addDevice'].includes(S.view.n)) return;
  const a = document.activeElement; if (a && ['INPUT','TEXTAREA','SELECT'].includes(a.tagName)) return;
  try { await loadAll(); render(); } catch (e) {}
}, 20000);

sb.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    const changed = (S.session?.user.id) !== (session?.user.id);
    S.session = session;
    if (!session){ Object.assign(S, blank(), {me:null, view:null, d:{}, tab:'home'}); S.ready = true; render(); return; }
    if (changed || event === 'SIGNED_IN' || !S.me){
      try { await loadAll(); S.tab = TABS[role()][0][0]; S.view = null; S.d = {}; } catch (e) { fail(e); }
    }
    S.ready = true; render();
  }, 0);
});
render();
