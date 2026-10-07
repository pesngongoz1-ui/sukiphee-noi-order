'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const styles = {
  page: { maxWidth: 520, margin: '0 auto', padding: '1.5rem', fontSize: '1.25rem' },
  title: { fontSize: '2rem', marginBottom: '1rem' },
  label: { display: 'block', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.4rem' },
  input: {
    width: '100%', boxSizing: 'border-box', fontSize: '1.75rem', padding: '0.6rem 0.8rem',
    border: '2px solid #bbb', borderRadius: 10, marginBottom: '1rem',
  },
  btn: {
    width: '100%', fontSize: '1.4rem', fontWeight: 700, padding: '0.9rem', border: 'none',
    borderRadius: 10, cursor: 'pointer', color: '#fff', background: '#2e7d32',
  },
  btnGray: { background: '#757575' },
  btnRed: { background: '#c62828' },
  btnOrange: { background: '#e65100' },
  warn: {
    border: '3px solid #e65100', background: '#fff3e0', borderRadius: 12,
    padding: '1rem', marginTop: '1rem',
  },
  error: { color: '#c62828', fontWeight: 600, marginTop: '1rem' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50,
  },
  dialog: {
    background: '#fff', border: '4px solid #c62828', borderRadius: 14, padding: '1.5rem',
    width: '100%', maxWidth: 440,
  },
};

export default function GenerateQrPage() {
  const [tableNumber, setTableNumber] = useState('');
  const [adultCount, setAdultCount] = useState('');
  const [childCount, setChildCount] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [existing, setExisting] = useState(null); // open session found for this table
  const [showConfirm, setShowConfirm] = useState(false);
  const [openedMinutes, setOpenedMinutes] = useState(0);

  const [result, setResult] = useState(null); // newly created session
  const [orderUrl, setOrderUrl] = useState('');
  const [copied, setCopied] = useState(false);

  function handleTableChange(value) {
    setTableNumber(value);
    setExisting(null); // warning is for the old table number
    setShowConfirm(false);
    setError('');
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setError('');

    const table = parseInt(tableNumber, 10);
    const adults = parseInt(adultCount, 10);
    const children = parseInt(childCount || '0', 10);

    if (!Number.isInteger(table) || table < 1) return setError('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
    if (!Number.isInteger(adults) || adults < 0) return setError('จำนวนผู้ใหญ่ไม่ถูกต้อง');
    if (!Number.isInteger(children) || children < 0) return setError('จำนวนเด็กไม่ถูกต้อง');
    if (adults + children < 1) return setError('ต้องมีลูกค้าอย่างน้อย 1 คน');

    setLoading(true);
    try {
      // 1) check for an already-open session on this table
      const { data: found, error: findErr } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, created_at')
        .eq('table_number', table)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);
      if (findErr) throw findErr;

      if (found && found.length > 0) {
        setExisting(found[0]);
        return;
      }

      // 2) none open -> create new session
      const { data: created, error: insertErr } = await supabase
        .from('sessions')
        .insert({
          table_number: table,
          adult_count: adults,
          child_count: children,
          status: 'open',
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      setOrderUrl(`${window.location.origin}/order/${table}`);
      setResult(created);
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    const ms = Date.now() - new Date(existing.created_at).getTime();
    setOpenedMinutes(Math.max(0, Math.floor(ms / 60000)));
    setShowConfirm(true);
  }

  async function handleConfirmClose() {
    setError('');
    setLoading(true);
    try {
      // only close if still 'open' (guards against double-press / another device)
      const { error: updateErr } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .eq('status', 'open')
        .select('id');
      if (updateErr) throw updateErr;

      // zero rows updated = someone already closed it; either way it is closed now
      setShowConfirm(false);
      setExisting(null);
    } catch (err) {
      setShowConfirm(false);
      setError(`ปิดโต๊ะเดิมไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('คัดลอกลิงก์นี้', orderUrl);
    }
  }

  function handleReset() {
    setResult(null);
    setOrderUrl('');
    setTableNumber('');
    setAdultCount('');
    setChildCount('0');
    setExisting(null);
    setError('');
  }

  // ---------- QR result view ----------
  if (result) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderUrl)}`;
    return (
      <main style={{ ...styles.page, textAlign: 'center' }}>
        <h1 style={styles.title}>เปิดโต๊ะสำเร็จ</h1>
        <img src={qrSrc} alt={`QR Code โต๊ะ ${result.table_number}`} width={300} height={300} />
        <p style={{ fontSize: '1.6rem', fontWeight: 700 }}>
          โต๊ะ {result.table_number} · ผู้ใหญ่ {result.adult_count} · เด็ก {result.child_count}
        </p>
        <p style={{ fontSize: '0.95rem', color: '#555', wordBreak: 'break-all' }}>{orderUrl}</p>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          <button style={styles.btn} onClick={handleCopy}>
            {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
          </button>
          <button style={{ ...styles.btn, ...styles.btnGray }} onClick={handleReset}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- form view ----------
  return (
    <main style={styles.page}>
      <h1 style={styles.title}>เปิดโต๊ะ</h1>

      <form onSubmit={handleOpenTable}>
        <label style={styles.label} htmlFor="table">เลขโต๊ะ</label>
        <input
          id="table" style={styles.input} type="number" inputMode="numeric" min="1"
          value={tableNumber} onChange={(e) => handleTableChange(e.target.value)}
        />

        <label style={styles.label} htmlFor="adult">จำนวนผู้ใหญ่</label>
        <input
          id="adult" style={styles.input} type="number" inputMode="numeric" min="0"
          value={adultCount} onChange={(e) => setAdultCount(e.target.value)}
        />

        <label style={styles.label} htmlFor="child">จำนวนเด็ก</label>
        <input
          id="child" style={styles.input} type="number" inputMode="numeric" min="0"
          value={childCount} onChange={(e) => setChildCount(e.target.value)}
        />

        <button type="submit" style={styles.btn} disabled={loading}>
          {loading && !showConfirm ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
        </button>
      </form>

      {existing && (
        <div style={styles.warn} role="alert">
          <p style={{ margin: '0 0 0.8rem', fontWeight: 700, color: '#bf360c' }}>
            ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button style={{ ...styles.btn, ...styles.btnOrange }} onClick={openConfirm}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <p style={{ marginTop: '2rem' }}>
        <Link href="/">← กลับหน้าแรก</Link>
      </p>

      {showConfirm && existing && (
        <div style={styles.overlay} role="dialog" aria-modal="true">
          <div style={styles.dialog}>
            <h2 style={{ marginTop: 0, color: '#c62828' }}>ยืนยันปิดโต๊ะเดิม?</h2>
            <p style={{ margin: '0.3rem 0' }}>
              <strong>โต๊ะ {existing.table_number}</strong>
            </p>
            <p style={{ margin: '0.3rem 0' }}>
              ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
            </p>
            <p style={{ margin: '0.3rem 0 1.2rem' }}>เปิดมาแล้ว {openedMinutes} นาที</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <button
                style={{ ...styles.btn, ...styles.btnRed }}
                onClick={handleConfirmClose} disabled={loading}
              >
                {loading ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnGray }}
                onClick={() => setShowConfirm(false)} disabled={loading}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const styles = {
  page: { maxWidth: 520, margin: '0 auto', padding: '1.5rem', fontSize: '1.25rem' },
  title: { fontSize: '2rem', marginBottom: '1rem' },
  label: { display: 'block', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.4rem' },
  input: {
    width: '100%', boxSizing: 'border-box', fontSize: '1.75rem', padding: '0.6rem 0.8rem',
    border: '2px solid #bbb', borderRadius: 10, marginBottom: '1rem',
  },
  btn: {
    width: '100%', fontSize: '1.4rem', fontWeight: 700, padding: '0.9rem', border: 'none',
    borderRadius: 10, cursor: 'pointer', color: '#fff', background: '#2e7d32',
  },
  btnGray: { background: '#757575' },
  btnRed: { background: '#c62828' },
  btnOrange: { background: '#e65100' },
  warn: {
    border: '3px solid #e65100', background: '#fff3e0', borderRadius: 12,
    padding: '1rem', marginTop: '1rem',
  },
  error: { color: '#c62828', fontWeight: 600, marginTop: '1rem' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50,
  },
  dialog: {
    background: '#fff', border: '4px solid #c62828', borderRadius: 14, padding: '1.5rem',
    width: '100%', maxWidth: 440,
  },
};

export default function GenerateQrPage() {
  const [tableNumber, setTableNumber] = useState('');
  const [adultCount, setAdultCount] = useState('');
  const [childCount, setChildCount] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [existing, setExisting] = useState(null); // open session found for this table
  const [showConfirm, setShowConfirm] = useState(false);
  const [openedMinutes, setOpenedMinutes] = useState(0);

  const [result, setResult] = useState(null); // newly created session
  const [orderUrl, setOrderUrl] = useState('');
  const [copied, setCopied] = useState(false);

  function handleTableChange(value) {
    setTableNumber(value);
    setExisting(null); // warning is for the old table number
    setShowConfirm(false);
    setError('');
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setError('');

    const table = parseInt(tableNumber, 10);
    const adults = parseInt(adultCount, 10);
    const children = parseInt(childCount || '0', 10);

    if (!Number.isInteger(table) || table < 1) return setError('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
    if (!Number.isInteger(adults) || adults < 0) return setError('จำนวนผู้ใหญ่ไม่ถูกต้อง');
    if (!Number.isInteger(children) || children < 0) return setError('จำนวนเด็กไม่ถูกต้อง');
    if (adults + children < 1) return setError('ต้องมีลูกค้าอย่างน้อย 1 คน');

    setLoading(true);
    try {
      // 1) check for an already-open session on this table
      const { data: found, error: findErr } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, created_at')
        .eq('table_number', table)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);
      if (findErr) throw findErr;

      if (found && found.length > 0) {
        setExisting(found[0]);
        return;
      }

      // 2) none open -> create new session
      const { data: created, error: insertErr } = await supabase
        .from('sessions')
        .insert({
          table_number: table,
          adult_count: adults,
          child_count: children,
          status: 'open',
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      setOrderUrl(`${window.location.origin}/order/${table}`);
      setResult(created);
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    const ms = Date.now() - new Date(existing.created_at).getTime();
    setOpenedMinutes(Math.max(0, Math.floor(ms / 60000)));
    setShowConfirm(true);
  }

  async function handleConfirmClose() {
    setError('');
    setLoading(true);
    try {
      // only close if still 'open' (guards against double-press / another device)
      const { error: updateErr } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .eq('status', 'open')
        .select('id');
      if (updateErr) throw updateErr;

      // zero rows updated = someone already closed it; either way it is closed now
      setShowConfirm(false);
      setExisting(null);
    } catch (err) {
      setShowConfirm(false);
      setError(`ปิดโต๊ะเดิมไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('คัดลอกลิงก์นี้', orderUrl);
    }
  }

  function handleReset() {
    setResult(null);
    setOrderUrl('');
    setTableNumber('');
    setAdultCount('');
    setChildCount('0');
    setExisting(null);
    setError('');
  }

  // ---------- QR result view ----------
  if (result) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(orderUrl)}`;
    return (
      <main style={{ ...styles.page, textAlign: 'center' }}>
        <h1 style={styles.title}>เปิดโต๊ะสำเร็จ</h1>
        <img src={qrSrc} alt={`QR Code โต๊ะ ${result.table_number}`} width={300} height={300} />
        <p style={{ fontSize: '1.6rem', fontWeight: 700 }}>
          โต๊ะ {result.table_number} · ผู้ใหญ่ {result.adult_count} · เด็ก {result.child_count}
        </p>
        <p style={{ fontSize: '0.95rem', color: '#555', wordBreak: 'break-all' }}>{orderUrl}</p>
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
          <button style={styles.btn} onClick={handleCopy}>
            {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
          </button>
          <button style={{ ...styles.btn, ...styles.btnGray }} onClick={handleReset}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- form view ----------
  return (
    <main style={styles.page}>
      <h1 style={styles.title}>เปิดโต๊ะ</h1>

      <form onSubmit={handleOpenTable}>
        <label style={styles.label} htmlFor="table">เลขโต๊ะ</label>
        <input
          id="table" style={styles.input} type="number" inputMode="numeric" min="1"
          value={tableNumber} onChange={(e) => handleTableChange(e.target.value)}
        />

        <label style={styles.label} htmlFor="adult">จำนวนผู้ใหญ่</label>
        <input
          id="adult" style={styles.input} type="number" inputMode="numeric" min="0"
          value={adultCount} onChange={(e) => setAdultCount(e.target.value)}
        />

        <label style={styles.label} htmlFor="child">จำนวนเด็ก</label>
        <input
          id="child" style={styles.input} type="number" inputMode="numeric" min="0"
          value={childCount} onChange={(e) => setChildCount(e.target.value)}
        />

        <button type="submit" style={styles.btn} disabled={loading}>
          {loading && !showConfirm ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
        </button>
      </form>

      {existing && (
        <div style={styles.warn} role="alert">
          <p style={{ margin: '0 0 0.8rem', fontWeight: 700, color: '#bf360c' }}>
            ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button style={{ ...styles.btn, ...styles.btnOrange }} onClick={openConfirm}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <p style={{ marginTop: '2rem' }}>
        <Link href="/">← กลับหน้าแรก</Link>
      </p>

      {showConfirm && existing && (
        <div style={styles.overlay} role="dialog" aria-modal="true">
          <div style={styles.dialog}>
            <h2 style={{ marginTop: 0, color: '#c62828' }}>ยืนยันปิดโต๊ะเดิม?</h2>
            <p style={{ margin: '0.3rem 0' }}>
              <strong>โต๊ะ {existing.table_number}</strong>
            </p>
            <p style={{ margin: '0.3rem 0' }}>
              ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
            </p>
            <p style={{ margin: '0.3rem 0 1.2rem' }}>เปิดมาแล้ว {openedMinutes} นาที</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <button
                style={{ ...styles.btn, ...styles.btnRed }}
                onClick={handleConfirmClose} disabled={loading}
              >
                {loading ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnGray }}
                onClick={() => setShowConfirm(false)} disabled={loading}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
