// ReSpace AI triage — advisory only. Reads a case (text + up to 3 photos) and returns a structured
// first opinion for the technician. It can only RAISE a case's risk (via private.save_ai), never lower it.
// Needs secret ANTHROPIC_API_KEY (set by the agency in Supabase → Edge Functions → Secrets).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PROMPT = `คุณเป็นผู้ช่วยช่างซ่อมเครื่องใช้ไฟฟ้าในศูนย์ซ่อมสาธารณะ อ่านอาการและรูปถ่าย แล้วให้ "ความเห็นเบื้องต้น" สำหรับช่างเท่านั้น
กฎ:
- ห้ามสรุปแทนช่าง ให้เป็นข้อสันนิษฐาน
- ระบุสัญญาณอันตรายที่เห็นในรูปหรืออาการ เช่น แบตเตอรี่บวม รอยไหม้ กลิ่นไหม้ คราบน้ำ สายไฟฉีก ตัวเก็บประจุแรงดันสูง (ไมโครเวฟ) สารทำความเย็น (ตู้เย็น)
- self_repair_ok เป็น true ได้เฉพาะงานง่ายที่ไม่เกี่ยวกับไฟแรงดันสูง แบตเตอรี่ลิเธียม หรือแก๊ส
ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบ:
{"summary":"สรุป 1–2 ประโยค","likely_causes":[{"cause":"...","confidence":"สูง|กลาง|ต่ำ"}],"parts":["..."],"hazards":["..."],"self_repair_ok":false}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  const body = await req.json().catch(() => ({}));
  if (body.ping) return json({ enabled: !!key });
  if (!key) return json({ enabled: false, error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await user.auth.getUser();
  if (!who?.user) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

  const caseId = String(body.case_id || "");
  const { data: c } = await admin.from("cases").select("id,user_id,device_id,symptoms,detail,since,dropped").eq("id", caseId).maybeSingle();
  if (!c) return json({ error: "ไม่พบเคส" }, 404);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", who.user.id).single();
  const staff = prof && prof.role !== "citizen";
  if (c.user_id !== who.user.id && !staff) return json({ error: "ไม่มีสิทธิ์" }, 403);
  const { data: consent } = await admin.from("ai_consents").select("case_id").eq("case_id", caseId).maybeSingle();
  if (!consent) return json({ error: "ผู้แจ้งไม่ได้ยินยอมให้ใช้ AI กับเคสนี้" }, 403);

  const { data: dev } = await admin.from("devices").select("type,brand,model,year").eq("id", c.device_id).single();
  const { data: photos } = await admin.from("case_photos").select("path").eq("case_id", caseId);
  const content: unknown[] = [];
  for (const p of (photos || []).filter((x) => x.path && x.path !== "demo").slice(0, 3)) {
    const { data: blob } = await admin.storage.from("case-photos").download(p.path);
    if (!blob) continue;
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: btoa(bin) } });
  }
  content.push({ type: "text", text: `${PROMPT}\n\nเครื่อง: ${dev?.type} ${dev?.brand} ${dev?.model} (ซื้อปี ${dev?.year || "-"})\nอาการ: ${(c.symptoms || []).join(", ")}\nรายละเอียด: ${c.detail || "-"}\nเริ่มเป็น: ${c.since || "-"}\nตกน้ำ/ตกพื้น: ${c.dropped}\nจำนวนรูป: ${content.length}` });

  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
  const save = (s: string, r: Record<string, unknown> = {}, err: string | null = null) =>
    admin.rpc("ai_save", { p_case: caseId, p_status: s, p_summary: (r.summary as string) ?? null, p_causes: r.likely_causes ?? null, p_parts: r.parts ?? null,
      p_hazards: (r.hazards as string[]) ?? [], p_self: (r.self_repair_ok as boolean) ?? null, p_model: model, p_error: err });
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) { const t = await res.text(); await save("error", {}, `API ${res.status}: ${t.slice(0, 300)}`); return json({ error: "AI ไม่ตอบสนอง" }, 502); }
    const out = await res.json();
    const text = (out.content || []).map((x: { text?: string }) => x.text || "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    const r = m ? JSON.parse(m[0]) : null;
    if (!r) { await save("error", {}, "อ่านผลจาก AI ไม่ได้"); return json({ error: "อ่านผลจาก AI ไม่ได้" }, 502); }
    r.hazards = Array.isArray(r.hazards) ? r.hazards.map(String).slice(0, 6) : [];
    await save("done", r);
    return json({ ok: true });
  } catch (e) {
    await save("error", {}, String(e).slice(0, 300));
    return json({ error: "เกิดข้อผิดพลาด" }, 500);
  }
});
