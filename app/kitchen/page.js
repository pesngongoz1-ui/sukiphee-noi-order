'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ACTIVE = ['received', 'cooking'];

const sortByCreated = (list) =>
  [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

const upsert = (list, row) => sortByCreated([...list.filter((o) => o.id !== row.id), row]);

function parseItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const s = {
  page: { background: '#161616', color: '#fff', minHeight: '100vh', padding: '1rem 1.5rem' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' },
  card: (cooking) => ({
    background: cooking ? '#ffb300' : '#fff',
    color: '#1b1b1b',
    border: `6px solid ${cooking ? '#e65100' : '#b71c1c'}`,
    borderRadius: 16,
    padding: '1rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
  }),
  btn: (bg, color = '#fff') => ({
    flex: 1, minHeight: 64, fontSize: 24, fontWeight: 800, border: 'none',
    borderRadius: 12, cursor: 'pointer', background: bg, color,
  }),
};

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const loadOrders = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('orders')
      .select('*')
      .in('status', ACTIVE)
      .order('created_at', { ascending: true });
    if (err) {
      setError(`โหลดออเดอร์ไม่สำเร็จ: ${err.message}`);
      return;
    }
    setError('');
    setOrders(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const handleChange = (row) => {
      setOrders((prev) =>
        ACTIVE.includes(row.status) ? upsert(prev, row) : prev.filter((o) => o.id !== row.id)
      );
    };

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => handleChange(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (p) => handleChange(p.new))
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        // (re)load after every successful (re)connect so nothing is missed
        if (status === 'SUBSCRIBED') loadOrders();
      });

    loadOrders();
    const poll = setInterval(loadOrders, 60000); // safety net for a screen left on all day
    const tick = setInterval(() => setNow(Date.now()), 30000);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function changeStatus(order, status) {
    // optimistic UI
    setOrders((prev) =>
      status === 'served'
        ? prev.filter((o) => o.id !== order.id)
        : prev.map((o) => (o.id === order.id ? { ...o, status } : o))
    );
    const { error: err } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (err) {
      setError(`อัปเดตสถานะไม่สำเร็จ: ${err.message}`);
      loadOrders(); // roll back to the real state
    }
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        <h1 style={{ margin: 0, fontSize: 40 }}>ครัว · สุกี้ผีน้อย</h1>
        <div style={{ fontSize: 22, fontWeight: 700, color: live ? '#66bb6a' : '#ef5350' }}>
          {live ? '● เชื่อมต่อแล้ว' : '● ขาดการเชื่อมต่อ'} · {orders.length} ออเดอร์
        </div>
      </header>

      {error && (
        <div style={{ background: '#b71c1c', padding: '0.8rem 1rem', borderRadius: 10, fontSize: 22, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loaded && orders.length === 0 && (
        <p style={{ fontSize: 36, color: '#888', textAlign: 'center', marginTop: '20vh' }}>
          ไม่มีออเดอร์ค้าง
        </p>
      )}

      <section style={s.grid}>
        {orders.map((order) => {
          const cooking = order.status === 'cooking';
          const created = new Date(order.created_at);
          const minutes = Math.max(0, Math.floor((now - created.getTime()) / 60000));
          const list = parseItems(order.items);

          return (
            <article key={order.id} style={s.card(cooking)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 64, fontWeight: 900, lineHeight: 1 }}>โต๊ะ {order.table_number}</span>
                <span style={{ fontSize: 22, fontWeight: 700, textAlign: 'right' }}>
                  {created.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  <br />
                  <span style={{ fontWeight: 500 }}>({minutes} นาทีที่แล้ว)</span>
                </span>
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, margin: '0.4rem 0', color: cooking ? '#bf360c' : '#b71c1c' }}>
                {cooking ? 'กำลังทำ' : 'ออเดอร์ใหม่'}
              </div>

              <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, flex: 1 }}>
                {list.map((it, idx) => (
                  <li
                    key={idx}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 30, fontWeight: 700, padding: '0.3rem 0', borderBottom: '2px dashed rgba(0,0,0,0.2)' }}
                  >
                    <span>{it.name}</span>
                    <span>× {it.quantity}</span>
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', gap: 10 }}>
                {!cooking && (
                  <button style={s.btn('#e65100')} onClick={() => changeStatus(order, 'cooking')}>
                    เริ่มทำ
                  </button>
                )}
                <button style={s.btn('#2e7d32')} onClick={() => changeStatus(order, 'served')}>
                  จัดเสิร์ฟแล้ว
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
