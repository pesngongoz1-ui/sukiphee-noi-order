import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 16px", textAlign: "center" }}>
      <h1>สุกี้ผีน้อย</h1>
      <p>ระบบสั่งอาหารร้านบุฟเฟต์</p>
      <nav style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <Link href="/generate-qr">สร้าง QR Code ประจำโต๊ะ</Link>
        <Link href="/kitchen">หน้าครัว</Link>
      </nav>
    </main>
  );
}
