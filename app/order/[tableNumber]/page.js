'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ADULT_PRICE = 289;
const CHILD_PRICE = 145;
const MAX_QTY = 5;

const C = {
  bg: '#fff8ee',
  card: '#ffffff',
  red: '#b71c1c',
  redDark: '#7f1010',
  gold: '#e0a526',
  text: '#3b2a1a',
  muted: '#8a7560',
  line: '#ecd9bd',
};

const s = {
  page: { background: C.bg, color: C.text, minHeight: '100vh', paddingBottom: 120, fontSize: 18 },
  header: { background: C.red, color: '#fff', padding: '1rem 1.25rem' },
  tabsWrap: {
    position: 'sticky', top: 0, zIndex: 10, background: C.bg,
    borderBottom: `2px solid ${C.line}`, display: 'flex', gap: 8,
    overflowX: 'auto', padding: '0.7rem 1rem',
  },
  tab: (active) => ({
    flex: '0 0 auto', minHeight: 48, padding: '0 1.1rem', fontSize: 18, fontWeight: 700,
    borderRadius: 24, cursor: 'pointer',
    border: `2px solid ${active ? C.red : C.line}`,
    background: active ? C.red : '#fff', color: active ? '#fff' : C.text,
  }),
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 14,
    padding: '0.8rem 1rem', marginBottom: 10,
  },
  round: (bg) => ({
    width: 52, height: 52, borderRadius: '50%', border: 'none', background: bg,
    color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1, cursor: 'pointer', flex: '0 0 auto',
  }),
  bar: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: '#fff',
    borderTop: `3px solid ${C.red}`, padding: '0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.12)',
  },
  big: (bg, extra = {}) => ({
    minHeight: 56, padding: '0 1.2rem', fontSize: 20, fontWeight: 700, border: 'none',
    borderRadius: 14, background: bg, color: '#fff', cursor: 'pointer', ...extra,
  }),
  full: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '2rem', fontSize: 28, fontWeight: 700,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  dialog: { background: '#fff', borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 420 },
};

export default function OrderPage({ params }) {
  const { tableNumber } = use(params);
  const table = Number(tableNumber);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState({}); // { [itemId]: { name, quantity } }
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showBill, setShowBill] = useState(false);
  const [billing, setBilling] = useState(false);
  const [closed, setClosed] = useState(false);

  // 1) find the open session, then load the menu
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!Number.isInteger(table) || table < 1) {
        setLoading(false);
        return;
      }
      try {
        const { data: found, error: sErr } = await supabase
          .from('sessions')
          .select('id, adult_count, child_count')
          .eq('table_number', table)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);
        if (sErr) throw sErr;
        if (cancelled) return;

        if (!found || found.length === 0) {
          setLoading(false);
          return;
        }
        setSession(found[0]);

        const [catRes, itemRes] = await Promise.all([
          supabase.from('menu_categories').select('id, name, sort_order').order('sort_order'),
          supabase.from('menu_items').select('id, category_id, name').order('id'),
        ]);
        if (catRes.error) throw catRes.error;
        if (itemRes.error) throw itemRes.error;
        if (cancelled) return;

        setCategories(catRes.data || []);
        setItems(itemRes.data || []);
        setActiveCat(catRes.data?.[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(`โหลดข้อมูลไม่สำเร็จ: ${err.message || err}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [table]);

  const cartList = useMemo(() => Object.entries(cart).map(([id, v]) => ({ id, ...v })), [cart]);
  const totalQty = cartList.reduce((sum, i) => sum + i.quantity, 0);
  const visibleItems = items.filter((i) => i.category_id === activeCat);

  function changeQty(item, delta) {
    setNotice('');
    setCart((prev) => {
      const current = prev[item.id]?.quantity || 0;
      const next = Math.min(MAX_QTY, Math.max(0, current + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[item.id];
      else copy[item.id] = { name: item.name, quantity: next };
      return copy;
    });
  }

  async function sendOrder() {
    if (cartList.length === 0 || sending) return;
    setSending(true);
    setError('');
    try {
      const { error: oErr } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: table,
        items: cartList.map(({ name, quantity }) => ({ name, quantity })),
        status: 'received',
      });
      if (oErr) throw oErr;
      setCart({});
      setShowCart(false);
      setNotice('ส่งออเดอร์แล้ว');
    } catch (err) {
      setError(`ส่งออเดอร์ไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setSending(false);
    }
  }

  async function confirmBill() {
    setBilling(true);
    setError('');
    try {
      const { error: uErr } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open')
        .select('id');
      if (uErr) throw uErr;
      setShowBill(false);
      setClosed(true);
    } catch (err) {
      setShowBill(false);
      setError(`เรียกเก็บเงินไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setBilling(false);
    }
  }

  // ---------- full-screen states ----------
  if (closed) {
    return <main style={{ ...s.full, background: C.bg, color: C.red }}>ขอบคุณที่ใช้บริการ</main>;
  }
  if (loading) {
    return <main style={{ ...s.full, background: C.bg, color: C.muted }}>กำลังโหลด...</main>;
  }
  if (!session) {
    return (
      <main style={{ ...s.full, background: C.bg, color: C.red }}>
        {error || 'โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน'}
      </main>
    );
  }

  const total = session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE;

  // ---------- ordering view ----------
  return (
    <main style={s.page}>
      <header style={s.header}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>สุกี้ผีน้อย</div>
        <div>โต๊ะ {table}</div>
      </header>

      <nav style={s.tabsWrap}>
        {categories.map((c) => (
          <button key={c.id} style={s.tab(c.id === activeCat)} onClick={() => setActiveCat(c.id)}>
            {c.name}
          </button>
        ))}
      </nav>

      <section style={{ padding: '1rem' }}>
        {notice && (
          <div style={{ background: '#e8f5e9', color: '#1b5e20', border: '2px solid #2e7d32', borderRadius: 12, padding: '0.8rem', fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
            ✓ {notice}
          </div>
        )}
        {error && (
          <div style={{ background: '#ffebee', color: C.red, border: `2px solid ${C.red}`, borderRadius: 12, padding: '0.8rem', fontWeight: 600, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {visibleItems.length === 0 && <p style={{ color: C.muted }}>ยังไม่มีเมนูในหมวดนี้</p>}
        {visibleItems.map((item) => {
          const qty = cart[item.id]?.quantity || 0;
          return (
            <div key={item.id} style={s.item}>
              <span style={{ fontSize: 20, fontWeight: 600 }}>{item.name}</span>
              {qty === 0 ? (
                <button style={s.round(C.red)} onClick={() => changeQty(item, 1)} aria-label={`เพิ่ม ${item.name}`}>+</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button style={s.round(C.muted)} onClick={() => changeQty(item, -1)} aria-label={`ลด ${item.name}`}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 24, fontWeight: 800 }}>{qty}</span>
                  <button
                    style={{ ...s.round(C.red), opacity: qty >= MAX_QTY ? 0.35 : 1 }}
                    onClick={() => changeQty(item, 1)}
                    disabled={qty >= MAX_QTY}
                    aria-label={`เพิ่ม ${item.name}`}
                  >+</button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* floating cart bar */}
      <div style={s.bar}>
        {showCart && cartList.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '0 0 0.7rem', padding: 0, maxHeight: '35vh', overflowY: 'auto' }}>
            {cartList.map((i) => (
              <li key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: `1px dashed ${C.line}` }}>
                <span>{i.name}</span>
                <strong>× {i.quantity}</strong>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            style={s.big('#fff', { color: C.red, border: `2px solid ${C.red}`, flex: '0 0 auto' })}
            onClick={() => setShowCart((v) => !v)}
            disabled={cartList.length === 0}
          >
            🛒 {totalQty}
          </button>
          <button
            style={s.big(totalQty === 0 || sending ? '#bdbdbd' : C.red, { flex: 1 })}
            onClick={sendOrder}
            disabled={totalQty === 0 || sending}
          >
            {sending ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
          </button>
          <button style={s.big(C.gold, { color: C.text, flex: '0 0 auto' })} onClick={() => setShowBill(true)}>
            เรียกเก็บเงิน
          </button>
        </div>
      </div>

      {/* bill confirm dialog */}
      {showBill && (
        <div style={s.overlay} role="dialog" aria-modal="true">
          <div style={s.dialog}>
            <h2 style={{ marginTop: 0, color: C.red }}>ยืนยันเรียกเก็บเงิน?</h2>
            <p style={{ margin: '0.3rem 0' }}>
              ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE} = {session.adult_count * ADULT_PRICE} บาท
            </p>
            <p style={{ margin: '0.3rem 0' }}>
              เด็ก {session.child_count} × {CHILD_PRICE} = {session.child_count * CHILD_PRICE} บาท
            </p>
            <p style={{ fontSize: 30, fontWeight: 800, margin: '0.8rem 0', color: C.redDark }}>
              ยอดที่ต้องจ่าย {total.toLocaleString('th-TH')} บาท
            </p>
            {totalQty > 0 && (
              <p style={{ color: C.red, fontWeight: 600 }}>
                ⚠️ ยังมี {totalQty} รายการในตะกร้าที่ยังไม่ได้ส่ง
              </p>
            )}
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <button style={s.big(C.red)} onClick={confirmBill} disabled={billing}>
                {billing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </button>
              <button style={s.big(C.muted)} onClick={() => setShowBill(false)} disabled={billing}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
