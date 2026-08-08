"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Product = { sku: string; name: string; category: string; pack: string; price: number; stock: number; published: boolean };
type CustomerProduct = Omit<Product, "price">;
type Cart = Record<string, number>;
type Stage = "request" | "proforma" | "approved" | "dispatched" | "invoiced";
type View = "landing" | "home" | "products" | "create-list" | "orders" | "documents" | "customers" | "settings" | "catalog";

const seedProducts: Product[] = [
  { sku: "10100", name: "Amchur Ground 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.99, stock: 0, published: false },
  { sku: "10101", name: "Anise Seed 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 3.19, stock: 42, published: true },
  { sku: "10102", name: "All Spice Ground 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.99, stock: 18, published: true },
  { sku: "10103", name: "All Spice Whole 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.79, stock: 96, published: true },
  { sku: "10107", name: "Ajwain Seeds 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.49, stock: 245, published: true },
  { sku: "10111", name: "Black Pepper Whole 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 4.29, stock: 64, published: true },
  { sku: "10123", name: "Cumin Seeds 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.69, stock: 112, published: true },
  { sku: "10128", name: "Cinnamon Ground 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.89, stock: 28, published: true },
  { sku: "10143", name: "Cardamom Green 2oz (56g)", category: "3 Oz", pack: "12 × 2oz", price: 7.99, stock: 9, published: true },
  { sku: "10155", name: "Fennel Seeds 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.59, stock: 74, published: true },
  { sku: "10162", name: "Garam Masala 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 3.49, stock: 55, published: true },
  { sku: "10191", name: "Turmeric Ground 3oz (85g)", category: "3 Oz", pack: "12 × 3oz", price: 2.49, stock: 37, published: true },
  { sku: "10200", name: "Amchur Ground 7oz (200g)", category: "7 Oz", pack: "8 × 7oz", price: 5.49, stock: 23, published: true },
  { sku: "10223", name: "Cumin Seeds 8oz (227g)", category: "7 Oz", pack: "8 × 8oz", price: 5.79, stock: 81, published: true },
  { sku: "10232", name: "Curry Powder 8oz (227g)", category: "7 Oz", pack: "8 × 8oz", price: 5.29, stock: 16, published: true },
  { sku: "10324", name: "Cumin Ground 16oz (454g)", category: "16 Oz", pack: "6 × 16oz", price: 8.99, stock: 33, published: true },
  { sku: "10810", name: "Patak's Mango Pickle Mild", category: "Patak's", pack: "6 × 10oz", price: 6.49, stock: 27, published: true },
  { sku: "10904", name: "Taj Mahal Tea 450g", category: "Tea & Coffee", pack: "12 × 450g", price: 9.99, stock: 46, published: true },
];

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const demoQuantities: Cart = { "10102": 24, "10103": 18, "10107": 30 };

function invoiceLines(products: Product[], cart: Cart) {
  const selected = products.filter((product) => (cart[product.sku] || 0) > 0);
  const source = selected.length ? selected : seedProducts.slice(2, 5);
  return source.map((product) => ({ ...product, quantity: cart[product.sku] || demoQuantities[product.sku] || 4 }));
}

function downloadApprovedProformaPdf(products: Product[], cart: Cart) {
  const lines = invoiceLines(products, cart);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const shipping = 24;
  const tax = subtotal * 0.0825;
  const total = subtotal + shipping + tax;
  const escapePdf = (value: string) => value.replace(/[^\x20-\x7E]/g, (character) => character === "×" ? "x" : "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const text = (value: string, x: number, y: number, size = 10, bold = false, color = "0.05 0.09 0.08") => `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;
  const rule = (x1: number, y1: number, x2: number, y2: number, width = .7, color = ".82 .83 .80") => `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
  const fill = (x: number, y: number, width: number, height: number, color: string) => `${color} rg ${x} ${y} ${width} ${height} re f`;
  const commands = [
    fill(36, 706, 44, 44, "0 .31 .26"), text("OD", 47, 722, 16, true, "1 1 1"),
    text("Order Desk Wholesale", 94, 731, 15, true), text("San Francisco, California", 94, 713, 9, false, ".35 .40 .38"),
    fill(504, 735, 72, 20, ".90 .96 .93"), text("APPROVED", 515, 742, 8, true, "0 .31 .26"),
    text("PRO-FORMA", 414, 704, 24, false), text("PF-2026-0042", 498, 684, 10, true, ".35 .40 .38"),
    rule(36, 665, 576, 665, 1.2, ".05 .09 .08"),
    text("BILL TO", 36, 632, 9, true, ".35 .40 .38"), text("Valley Market", 36, 608, 13, true),
    text("Maya Patel", 36, 588, 11), text("428 Mission Street", 36, 572, 11), text("San Francisco, CA 94105", 36, 556, 11),
    text("DOCUMENT DETAILS", 315, 632, 9, true, ".35 .40 .38"), text("Issued: Aug 7, 2026", 315, 600, 11),
    text("Valid through: Aug 21, 2026", 315, 582, 11), text("Terms: Net 15", 315, 564, 11),
    text("ITEM", 48, 505, 8, true, ".35 .40 .38"), text("QTY", 294, 505, 8, true, ".35 .40 .38"),
    text("UNIT PRICE", 435, 505, 8, true, ".35 .40 .38"), text("TOTAL", 530, 505, 8, true, ".35 .40 .38"), rule(36, 491, 576, 491),
  ];
  let rowY = 466;
  lines.slice(0, 7).forEach((line) => {
    commands.push(text(line.name, 48, rowY, 9, true), text(`${line.sku} - ${line.pack}`, 48, rowY - 14, 8, false, ".35 .40 .38"));
    commands.push(text(String(line.quantity), 294, rowY - 2, 10), text(money(line.price), 435, rowY - 2, 10), text(money(line.price * line.quantity), 530, rowY - 2, 10));
    commands.push(rule(36, rowY - 27, 576, rowY - 27));
    rowY -= 48;
  });
  const totalsY = Math.max(126, rowY - 8);
  commands.push(
    text("Subtotal", 390, totalsY, 10), text(money(subtotal), 530, totalsY, 10, true),
    text("Shipping", 390, totalsY - 22, 10), text(money(shipping), 530, totalsY - 22, 10, true),
    text("Tax (8.25%)", 390, totalsY - 44, 10), text(money(tax), 530, totalsY - 44, 10, true),
    rule(390, totalsY - 57, 576, totalsY - 57, 1.1, ".05 .09 .08"),
    text("Total", 390, totalsY - 82, 15, true), text(money(total), 520, totalsY - 82, 15, true),
    rule(36, 55, 576, 55), text("Approved pro-forma. Pricing and quantities accepted by Valley Market.", 36, 36, 8, false, ".35 .40 .38"),
    text("Source order OR-2026-0137 | Sales rep: Dipendra Subedi | (415) 555-0124", 36, 22, 8, false, ".35 .40 .38"),
  );
  const content = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "PF-2026-0042-approved-pro-forma.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [products, setProducts] = useState(seedProducts);
  const [cart, setCart] = useState<Cart>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All products");
  const [stage, setStage] = useState<Stage>("request");
  const [orderCreated, setOrderCreated] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const [customerSignInOpen, setCustomerSignInOpen] = useState(false);
  const [targetedList, setTargetedList] = useState(false);
  const [targetSkus, setTargetSkus] = useState<string[]>(["10102", "10103", "10107", "10123", "10143", "10191"]);
  const [changeRequest, setChangeRequest] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) { setTargetedList(true); setView("catalog"); }
  }, []);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const cartItems = products.filter((p) => (cart[p.sku] || 0) > 0);
  const categories = ["All products", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) => {
    const matchQuery = `${p.sku} ${p.name}`.toLowerCase().includes(query.toLowerCase());
    return matchQuery && (category === "All products" || p.category === category);
  });
  const subtotal = cartItems.reduce((sum, p) => sum + p.price * cart[p.sku], 0);
  const shipping = subtotal ? 24 : 0;
  const tax = subtotal * 0.0825;
  const total = subtotal + shipping + tax;
  const customerProducts: CustomerProduct[] = filtered.filter((p) => p.published && (!targetedList || targetSkus.includes(p.sku))).map(({ price: _privatePrice, ...product }) => product);
  const customerCartItems: CustomerProduct[] = cartItems.map(({ price: _privatePrice, ...product }) => product);

  const setQty = (sku: string, qty: number) => setCart((current) => ({ ...current, [sku]: Math.max(0, qty) }));
  const go = (next: View) => { setView(next); setReviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const importCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = String(reader.result).split(/\r?\n/).slice(1).filter(Boolean);
      const parsed = rows.map((row) => {
        const [sku, name, categoryName, pack, stock, price] = row.split(",").map((v) => v.trim());
        return { sku, name, category: categoryName || "Imported", pack: pack || "Each", stock: Number(stock) || 0, price: Number(price) || 0, published: true };
      }).filter((p) => p.sku && p.name);
      if (parsed.length) { setProducts((current) => [...parsed, ...current.filter((p) => !parsed.some((n) => n.sku === p.sku))]); notify(`${parsed.length} products imported and published`); }
      else notify("No valid rows found. Use: sku,name,category,pack,stock,price");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  if (view === "landing") return <Landing onSales={() => setSignInOpen(true)} onCustomer={() => setCustomerSignInOpen(true)} signInOpen={signInOpen} customerSignInOpen={customerSignInOpen} onClose={() => { setSignInOpen(false); setCustomerSignInOpen(false); }} onSignedIn={() => { setSignInOpen(false); go("home"); }} onCustomerSignedIn={() => { setCustomerSignInOpen(false); go("catalog"); }} />;
  if (view === "catalog") return <CustomerCatalog {...{ products: customerProducts, pdfProducts: products, query, setQuery, categories, category, setCategory, cart, setQty, cartItems: customerCartItems, reviewOpen, setReviewOpen, orderCreated, setOrderCreated, stage, setStage, go, notify, targetedList, changeRequest, setChangeRequest, proformaTotal: stage === "proforma" ? total || 486.38 : undefined }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-sidebar" onClick={() => go("landing")}><span className="brand-mark">OD</span><span>Order Desk</span></button>
        <p className="nav-label">Sales workspace</p>
        <nav>
          <Nav label="Overview" icon="⌂" active={view === "home"} onClick={() => go("home")} />
          <Nav label="Products" icon="◇" active={view === "products"} onClick={() => go("products")} />
          <Nav label="Orders" icon="▤" badge={orderCreated ? "1" : "12"} active={view === "orders"} onClick={() => go("orders")} />
          <Nav label="Pro-formas" icon="▧" active={view === "documents"} onClick={() => go("documents")} />
          <Nav label="Customers" icon="♧" active={view === "customers"} onClick={() => go("customers")} />
        </nav>
        <div className="sidebar-bottom">
          <Nav label="Settings" icon="⚙" active={view === "settings"} onClick={() => go("settings")} />
          <div className="profile"><span className="avatar">DS</span><span><strong>Dipendra</strong><small>Sales representative</small></span></div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="mobile-header"><button className="brand" onClick={() => go("home")}><span className="brand-mark">OD</span><span>Order Desk</span></button><button className="icon-button" onClick={() => go("catalog")}>Catalog</button></header>
        {view === "home" && <Dashboard orderCreated={orderCreated} stage={stage} go={go} notify={notify} />}
        {view === "products" && <Products products={products} setProducts={setProducts} filtered={filtered} query={query} setQuery={setQuery} categories={categories} category={category} setCategory={setCategory} setEditing={setEditing} importCsv={importCsv} notify={notify} go={go} />}
        {view === "create-list" && <SalesOrderListBuilder products={products.filter((p) => p.published)} selected={targetSkus} setSelected={setTargetSkus} onSend={() => { setTargetedList(true); const link = `${location.origin}/?token=odt_OL20260048_VM_7f3a9c&customer=valley-market`; navigator.clipboard?.writeText(link); history.replaceState({}, "", link); notify("Single-use secure order-list link copied for Valley Market"); go("catalog"); }} notify={notify} />}
        {view === "orders" && <Orders orderCreated={orderCreated} stage={stage} setStage={setStage} cartItems={cartItems} cart={cart} subtotal={subtotal} total={total} changeRequest={changeRequest} setChangeRequest={setChangeRequest} go={go} notify={notify} />}
        {view === "documents" && <Documents stage={stage} setStage={setStage} products={products} cart={cart} go={go} notify={notify} />}
        {view === "customers" && <Placeholder title="Customers" description="Manage customer contacts, catalogs, and order history." />}
        {view === "settings" && <Settings notify={notify} />}
      </main>
      {editing && <EditProduct product={editing} onClose={() => setEditing(null)} onSave={(updated) => { setProducts((all) => all.map((p) => p.sku === updated.sku ? updated : p)); setEditing(null); notify("Product updated"); }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Landing({ onSales, onCustomer, signInOpen, customerSignInOpen, onClose, onSignedIn, onCustomerSignedIn }: { onSales: () => void; onCustomer: () => void; signInOpen: boolean; customerSignInOpen: boolean; onClose: () => void; onSignedIn: () => void; onCustomerSignedIn: () => void }) {
  const [customerCode, setCustomerCode] = useState("");
  const [customerProfile, setCustomerProfile] = useState("Valley Market - Maya Patel");
  return <div className="landing">
    <header className="landing-header"><Brand /><div><button className="text-button">? Help</button><button className="text-button" onClick={onSales}>♙ Sign in</button></div></header>
    <main className="landing-main">
      <p className="eyebrow">Warehouse ordering, simplified</p><h1>Orders, quotes, and invoices—<br/>all in one place.</h1>
      <p className="landing-lead">A faster way for sales teams and customers to manage warehouse orders from any device.</p>
      <div className="entry-grid">
        <section className="entry-card"><span className="entry-icon">▤</span><p className="eyebrow">For your team</p><h2>Sales Rep</h2><p>Manage inventory, review orders, create quotes, and send invoices.</p><button className="button primary wide" onClick={onSales}>Open sales workspace →</button></section>
        <section className="entry-card customer-entry"><span className="entry-icon">⌑</span><p className="eyebrow">For customers</p><h2>Place an Order</h2><p>Use the secure access shared by your sales rep. No account or password needed.</p><button className="button customer-cta wide" onClick={onCustomer}>Customer access →</button></section>
      </div>
      <div className="landing-benefits"><span>▣ <b>Works on any device</b></span><span>♙ <b>Prices stay private</b></span><span>ϟ <b>Fast quote requests</b></span></div>
    </main>
    <footer className="landing-footer">© 2026 Order Desk <span>Privacy</span><span>Support</span></footer>
    {signInOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card"><button className="close" onClick={onClose}>×</button><span className="brand-mark">OD</span><p className="eyebrow">Sales workspace</p><h2>Welcome back</h2><p>Sign in to manage products, orders, pro-formas, and invoices.</p><label>Email address<input type="email" defaultValue="sales@orderdesk.example" /></label><label>Password<input type="password" defaultValue="orderdesk" /></label><button className="button primary wide" onClick={onSignedIn}>Sign in to workspace →</button><button className="text-button signin-link" onClick={onSignedIn}>Email me a secure sign-in link</button><small>Demo access is enabled for this MVP.</small></section></div>}
    {customerSignInOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card customer-signin"><button className="close" onClick={onClose}>×</button><span className="brand-mark customer-mark">C</span><p className="eyebrow">Customer access</p><h2>Open your shared catalog</h2><p>Every new order requires either a secure link from your sales rep or a new shared access code.</p><div className="rep-card"><span className="avatar pale">DS</span><span><small>Call your sales representative for a new code</small><b>Dipendra Subedi</b><a href="tel:+14155550124">(415) 555-0124</a></span></div><label>Returning customer profile<select value={customerProfile} onChange={(event) => setCustomerProfile(event.target.value)}><option>Valley Market - Maya Patel</option><option>Choose another saved profile</option></select></label><label>New shared access code<input value={customerCode} onChange={(event) => setCustomerCode(event.target.value.toUpperCase())} placeholder="Enter the code provided for this order" autoCapitalize="characters" /></label><button className="button customer-cta wide" disabled={!customerCode.trim() || customerProfile.startsWith("Choose")} onClick={onCustomerSignedIn}>Verify code & open catalog →</button><div className="access-note"><b>Have a secure order link?</b><br/>Open the link from your sales representative and you’ll skip this screen. Secure links and access codes are single-order credentials.</div><small>Local test code: ORD-VM-2026. In production, codes expire after use.</small></section></div>}
  </div>;
}

function Nav({ label, icon, active, badge, onClick }: { label: string; icon: string; active: boolean; badge?: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}</button>;
}

function Dashboard({ orderCreated, stage, go, notify }: { orderCreated: boolean; stage: Stage; go: (v: View) => void; notify: (s: string) => void }) {
  return <div className="page dashboard-page">
    <div className="page-head"><div><p className="eyebrow">Friday, August 7</p><h1>Good afternoon, Dipendra</h1><p>Here’s what needs your attention today.</p></div><div className="actions"><button className="button secondary" onClick={() => go("create-list")}>＋ Create order list</button><button className="button secondary" onClick={() => { navigator.clipboard?.writeText(location.href); notify("General catalog link copied"); }}>↗ Share catalog</button><button className="button primary" onClick={() => go("products")}>＋ Upload inventory</button></div></div>
    <div className="metric-grid">
      <Metric tone="green" value={orderCreated ? "13" : "12"} label="New requests" meta="3 since yesterday" />
      <Metric tone="amber" value={stage === "proforma" ? "5" : "4"} label="Awaiting approval" meta="2 due today" />
      <Metric tone="blue" value={stage === "approved" ? "9" : "8"} label="Approved this week" meta="↑ 14% from last week" />
      <Metric tone="red" value="27" label="Low-stock products" meta="5 out of stock" />
    </div>
    <div className="dashboard-grid">
      <section className="panel recent"><div className="panel-head"><div><h2>Recent order requests</h2><p>Latest activity from your customers</p></div><button className="text-button" onClick={() => go("orders")}>View all →</button></div>
        {orderCreated && <OrderRow initials="VM" customer="Valley Market" number="OR-2026-0137" details="3 lines · Today, 2:18 PM" status={stage === "request" ? "New" : stage === "proforma" ? "Quoted" : stage === "approved" ? "Approved" : "Processing"} fresh onClick={() => go("orders")} />}
        <OrderRow initials="SS" customer="Sunrise Supermarket" number="OR-2026-0136" details="8 lines · Today, 10:42 AM" status="New" onClick={() => go("orders")} />
        <OrderRow initials="BM" customer="Bharat Mini Mart" number="OR-2026-0135" details="12 lines · Yesterday" status="Reviewing" onClick={() => go("orders")} />
        <OrderRow initials="FC" customer="Fresh Cart Grocery" number="OR-2026-0134" details="6 lines · Aug 5" status="Quoted" onClick={() => go("orders")} />
      </section>
      <section className="panel workflow-card"><div className="panel-head"><div><h2>Current MVP workflow</h2><p>From request to approved PDF</p></div></div>
        {["Customer request", "Sales review", "Approved pro-forma PDF"].map((label, i) => <div className="workflow-step" key={label}><span>{i + 1}</span><div><strong>{label}</strong><small>{["Quantities, no pricing", "Confirm stock and price", "Customer accepts and downloads"][i]}</small></div></div>)}
      </section>
    </div>
  </div>;
}

function Metric({ tone, value, label, meta }: { tone: string; value: string; label: string; meta: string }) { return <div className="metric"><span className={`metric-icon ${tone}`}>●</span><div><strong>{value}</strong><p>{label}</p><small>{meta}</small></div></div>; }
function OrderRow({ initials, customer, number, details, status, fresh, onClick }: { initials: string; customer: string; number: string; details: string; status: string; fresh?: boolean; onClick: () => void }) { return <button className={`order-row ${fresh ? "fresh" : ""}`} onClick={onClick}><span className="avatar pale">{initials}</span><span className="order-info"><strong>{customer}</strong><small>{number} · {details}</small></span><span className={`badge ${status.toLowerCase()}`}>{status}</span><span>›</span></button>; }

function SalesOrderListBuilder({ products, selected, setSelected, onSend, notify }: { products: Product[]; selected: string[]; setSelected: (s: string[]) => void; onSend: () => void; notify: (s: string) => void }) {
  const [search, setSearch] = useState("");
  const visible = products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (sku: string) => setSelected(selected.includes(sku) ? selected.filter((s) => s !== sku) : [...selected, sku]);
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">Sales initiated order</p><h1>Create a customer order list</h1><p>Choose the customer and products, then send a secure quantity-request link.</p></div><span className="badge approved">Draft OL-2026-0048</span></div>
    <div className="builder-grid"><section className="panel builder-main"><div className="builder-section"><span className="builder-number">1</span><div><h2>Choose customer</h2><p>The link will be restricted to this customer and assigned sales rep.</p></div></div><div className="customer-choice"><span className="avatar pale">VM</span><span><b>Valley Market</b><small>Maya Patel · orders@valleymarket.com</small></span><span className="badge approved">Selected</span></div>
      <div className="builder-section"><span className="builder-number">2</span><div><h2>Select products</h2><p>Customers will see only these published products, without prices.</p></div></div><div className="search builder-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or SKU" /></div><div className="builder-products">{visible.map((p) => <label className="builder-product" key={p.sku}><input type="checkbox" checked={selected.includes(p.sku)} onChange={() => toggle(p.sku)} /><span><b>{p.name}</b><small>{p.sku} · {p.pack} · {p.stock < 20 ? "Low stock" : "In stock"}</small></span></label>)}</div>
    </section><aside className="panel builder-summary"><p className="eyebrow">Link summary</p><h2>Valley Market</h2><dl><dt>Products included</dt><dd>{selected.length}</dd><dt>Prices visible</dt><dd>No</dd><dt>Assigned rep</dt><dd>Dipendra Subedi</dd><dt>Expires</dt><dd>Aug 21, 2026</dd></dl><div className="notice"><b>Customer action</b><br/>Enter quantities and send the completed request back to sales.</div><button className="button primary wide" disabled={!selected.length} onClick={onSend}>Generate & copy secure link →</button><button className="button secondary wide" onClick={() => notify("Preview uses the same price-private customer view")}>Preview customer view</button></aside></div>
  </div>;
}

function Products({ products, setProducts, filtered, query, setQuery, categories, category, setCategory, setEditing, importCsv, notify, go }: { products: Product[]; setProducts: (p: Product[]) => void; filtered: Product[]; query: string; setQuery: (s: string) => void; categories: string[]; category: string; setCategory: (s: string) => void; setEditing: (p: Product | null) => void; importCsv: (e: ChangeEvent<HTMLInputElement>) => void; notify: (s: string) => void; go: (v: View) => void }) {
  const addProduct = () => { const p = { sku: `NEW-${products.length + 1}`, name: "New product", category: "Imported", pack: "Each", price: 0, stock: 0, published: false }; setProducts([p, ...products]); setEditing(p); };
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">Catalog</p><h1>Products & inventory</h1><p>Manage availability, pricing, stock, and customer visibility.</p></div><div className="actions"><label className="button secondary file-button">⇧ Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button className="button secondary" onClick={() => notify("Current catalog export prepared")}>⇩ Export</button><button className="button primary" onClick={addProduct}>＋ Add product</button></div></div>
    <div className="metric-grid compact"><Metric tone="green" value={String(products.length)} label="Sample products" meta="848 source SKUs mapped" /><Metric tone="blue" value={String(products.filter(p => p.published).length)} label="Published" meta="Customer-visible" /><Metric tone="amber" value={String(products.filter(p => !p.published).length)} label="Hidden" meta="Draft or unavailable" /><Metric tone="red" value={String(products.filter(p => p.stock < 20).length)} label="Low stock" meta="Needs attention" /></div>
    <section className="panel product-panel">
      <div className="toolbar"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product name or SKU" /></div><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select><button className="button secondary" onClick={() => go("catalog")}>View customer catalog ↗</button><span className="result-count">{filtered.length} results</span></div>
      <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Pack</th><th>Price</th><th>Stock</th><th>Customer visibility</th><th></th></tr></thead><tbody>{filtered.map((p) => <tr key={p.sku}><td className="mono">{p.sku}</td><td><strong>{p.name}</strong></td><td>{p.category}</td><td>{p.pack}</td><td>{money(p.price)}</td><td><span className={`stock ${p.stock === 0 ? "out" : p.stock < 20 ? "low" : ""}`}>{p.stock === 0 ? "Out of stock" : p.stock < 20 ? `${p.stock} · Low` : p.stock}</span></td><td><button aria-label={`Toggle ${p.name} visibility`} className={`toggle ${p.published ? "on" : ""}`} onClick={() => setProducts(products.map((x) => x.sku === p.sku ? { ...x, published: !x.published } : x))}><span /></button></td><td><button className="row-action" onClick={() => setEditing(p)}>•••</button></td></tr>)}</tbody></table></div>
      <div className="pagination"><span>1–{filtered.length} of 848 source products</span><span>25 per page　 ‹　 <b>1</b>　 ›</span></div>
    </section>
  </div>;
}

function Orders({ orderCreated, stage, setStage, cartItems, cart, subtotal, total, changeRequest, setChangeRequest, go, notify }: { orderCreated: boolean; stage: Stage; setStage: (s: Stage) => void; cartItems: Product[]; cart: Cart; subtotal: number; total: number; changeRequest: string; setChangeRequest: (s: string) => void; go: (v: View) => void; notify: (s: string) => void }) {
  const items = cartItems.length ? cartItems : seedProducts.slice(2, 5);
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Orders / OR-2026-0137</p><h1>{orderCreated ? "Valley Market" : "Sunrise Supermarket"}</h1><p>Customer request · received today at 2:18 PM</p></div><div className="actions"><span className={`badge ${stage}`}>{stage === "request" ? "New request" : stage}</span></div></div>
    {changeRequest && <div className="change-request-banner"><div><span>↺</span><div><b>Customer requested changes</b><p>{changeRequest}</p></div></div><button className="button secondary" onClick={() => notify("Revision note marked as reviewed")}>Mark reviewed</button></div>}
    <div className="detail-grid"><section className="panel"><div className="panel-head"><div><h2>{changeRequest ? "Revise requested items" : "Requested items"}</h2><p>{changeRequest ? "Apply the customer note before sending a revised pro-forma." : "Confirm stock and pricing before creating a pro-forma."}</p></div></div><div className="line-items">{items.map((p) => <div className="line-item" key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.pack}</small></span><span className="requested">Requested<br/><b>{cart[p.sku] || 4}</b></span><span className={p.stock < 20 ? "warning-text" : "success-text"}>{p.stock} in stock</span><span>{money(p.price)} / unit</span></div>)}</div></section>
      <aside className="panel customer-card"><div className="panel-head"><div><h2>Customer & delivery</h2></div></div><dl><dt>Contact</dt><dd>Maya Patel</dd><dt>Email</dt><dd>orders@valleymarket.com</dd><dt>Phone</dt><dd>(415) 555-0187</dd><dt>Fulfillment</dt><dd>Delivery · Aug 12</dd><dt>Address</dt><dd>428 Mission Street<br/>San Francisco, CA 94105</dd></dl></aside>
    </div>
    <div className="order-footer"><div><small>Estimated pro-forma total</small><strong>{money(total || subtotal + 24 + subtotal * .0825 || 486.38)}</strong></div><button className="button secondary" onClick={() => notify("Order changes saved")}>Save review</button><button className="button primary" onClick={() => { setChangeRequest(""); setStage("proforma"); go("documents"); notify(changeRequest ? "Revised pro-forma PF-2026-0042 sent" : "Pro-forma PF-2026-0042 created"); }}>{changeRequest ? "Send revised pro-forma →" : "Create pro-forma →"}</button></div>
  </div>;
}

function Documents({ stage, setStage, products, cart, go, notify }: { stage: Stage; setStage: (s: Stage) => void; products: Product[]; cart: Cart; go: (v: View) => void; notify: (s: string) => void }) {
  const lines = invoiceLines(products, cart);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const tax = subtotal * .0825;
  const total = subtotal + 24 + tax;
  const approved = stage === "approved";
  const download = () => { downloadApprovedProformaPdf(products, cart); notify("Approved pro-forma PDF downloaded"); };
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Pro-formas</p><h1>{approved ? "Approved pro-forma PF-2026-0042" : "Pro-forma PF-2026-0042"}</h1><p>Valley Market · Source order OR-2026-0137</p></div><div className="actions">{approved && <button className="button primary" onClick={download}>⇩ Download approved pro-forma PDF</button>}<button className="button secondary" onClick={() => { navigator.clipboard?.writeText(location.href); notify("Secure document link copied"); }}>↗ Copy secure link</button></div></div>
    <div className="document-grid"><section className="invoice-sheet"><div className="invoice-top"><div><span className="brand-mark">OD</span><h2>Order Desk Wholesale</h2><p>San Francisco, California</p></div><div className="invoice-title"><span className={`badge ${approved ? "approved" : "proforma"}`}>{approved ? "approved" : "awaiting approval"}</span><h2>PRO-FORMA</h2><p>PF-2026-0042</p></div></div><div className="invoice-parties"><div><small>BILL TO</small><strong>Valley Market</strong><p>Maya Patel<br/>428 Mission Street<br/>San Francisco, CA 94105</p></div><div><small>DOCUMENT DETAILS</small><p>Issued: Aug 7, 2026<br/>Valid through: Aug 21, 2026<br/>Terms: Net 15</p></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.sku}><td><b>{line.name}</b><small>{line.sku} · {line.pack}</small></td><td>{line.quantity}</td><td>{money(line.price)}</td><td>{money(line.price * line.quantity)}</td></tr>)}</tbody></table><div className="invoice-total"><span>Subtotal <b>{money(subtotal)}</b></span><span>Shipping <b>$24.00</b></span><span>Tax (8.25%) <b>{money(tax)}</b></span><strong>Total <b>{money(total)}</b></strong></div><p className="invoice-note">{approved ? "Approved by Valley Market. Pricing, quantities, and terms are accepted." : "Thank you for your business. Customer approval is required."}</p></section>
      <aside className="panel timeline"><div className="panel-head"><div><h2>Approval status</h2><p>This MVP ends with an approved PDF</p></div></div><div className="timeline-step done"><span>✓</span><div><b>Pro-forma created</b><small>Pricing and stock confirmed</small></div></div><div className={`timeline-step ${approved ? "done" : ""}`}><span>{approved ? "✓" : "2"}</span><div><b>Customer approved</b><small>{approved ? "Completed" : "Pending"}</small></div></div>
        {stage === "proforma" && <><button className="button primary wide" onClick={() => go("catalog")}>Open customer approval view</button><button className="button secondary wide" onClick={() => { setStage("approved"); notify("Approval recorded"); }}>Record offline approval</button></>}
        {approved && <><button className="button primary wide" onClick={download}>Download approved PDF</button><div className="notice"><b>Ready for handoff</b><br/>Dispatch and final invoicing are intentionally held for the next implementation phase.</div></>}
      </aside>
    </div>
  </div>;
}

/* FUTURE PHASE - retained from the full workflow branch for later activation.
   {stage === "approved" && <button onClick={() => setStage("dispatched")}>Mark products dispatched</button>}
   {stage === "dispatched" && <button onClick={() => setStage("invoiced")}>Issue final invoice PDF</button>}
   {stage === "invoiced" && <button>Mark invoice paid</button>}
*/

function CustomerCatalog(props: any) {
  const { products, pdfProducts, query, setQuery, categories, category, setCategory, cart, setQty, cartItems, reviewOpen, setReviewOpen, orderCreated, setOrderCreated, stage, setStage, go, notify, targetedList, changeRequest, setChangeRequest, proformaTotal } = props;
  if (stage === "proforma") return <CustomerDocument total={proformaTotal} products={pdfProducts} cart={cart} setStage={setStage} setChangeRequest={setChangeRequest} go={go} notify={notify} />;
  if (changeRequest) return <div className="customer-shell centered"><header className="customer-header"><Brand /><CustomerRep /></header><main className="confirmation"><span className="success-ring">✓</span><p className="eyebrow">Changes requested</p><h1>Your note was sent to Dipendra.</h1><p>Sales will revise <b>PF-2026-0042</b> and send you an updated pro-forma for approval.</p><div className="change-summary"><small>Your request</small><p>{changeRequest}</p></div><button className="button primary" onClick={() => go("orders")}>Open sales review →</button></main></div>;
  if (orderCreated && !reviewOpen) return <div className="customer-shell centered"><header className="customer-header"><Brand /><CustomerRep /></header><main className="confirmation"><span className="success-ring">✓</span><p className="eyebrow">Request received</p><h1>Thank you, Maya.</h1><p>Your order request <b>OR-2026-0137</b> has been sent to Dipendra. You’ll receive a priced pro-forma after stock is reviewed.</p><div className="confirmation-card"><span>{cartItems.length} product lines</span><span>Delivery requested Aug 12</span><span>No payment is due yet</span></div><p className="rep-help">Questions? Call Dipendra directly at <a href="tel:+14155550124">(415) 555-0124</a>.</p><button className="button primary" onClick={() => go("home")}>Open sales workspace →</button></main></div>;
  return <div className="customer-shell"><header className="customer-header"><Brand /><div><CustomerRep /><button className="text-button" onClick={() => go("home")}>Sales sign in</button></div></header><main className="catalog-main"><div className="catalog-intro">{targetedList && <span className="shared-list-label">Shared order list · OL-2026-0048</span>}<p className="eyebrow">{targetedList ? "Prepared for Valley Market" : "Order Desk Wholesale"}</p><h1>{targetedList ? "Dipendra selected these products for you" : "Build your order request"}</h1><p>{targetedList ? "Enter the quantities you need and send the completed list back to your sales representative. Pricing will be confirmed in the pro-forma." : "Choose quantities from today’s available catalog. Your sales rep will confirm pricing and final stock."}</p></div><div className="catalog-tools"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by item or SKU" /></div><div className="chips">{categories.map((c: string) => <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>)}</div></div><div className="catalog-list">{products.map((p: CustomerProduct) => <div className="catalog-row" key={p.sku}><span className="product-symbol">{p.name.slice(0, 1)}</span><span className="catalog-product"><small>{p.sku} · {p.category}</small><strong>{p.name}</strong><span>{p.pack} · Sold by tray</span></span><span className={`availability ${p.stock === 0 ? "out" : p.stock < 20 ? "low" : ""}`}>{p.stock === 0 ? "Out of stock" : p.stock < 20 ? "Low stock" : "In stock"}</span><div className="qty-control"><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) - 1)}>−</button><input aria-label={`Quantity for ${p.name}`} value={cart[p.sku] || 0} onChange={(e) => setQty(p.sku, Number(e.target.value))} /><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) + 1)}>＋</button></div></div>)}</div></main>{cartItems.length > 0 && <div className="cart-bar"><span><b>{cartItems.length}</b> product lines selected</span><button className="button customer-cta" onClick={() => setReviewOpen(true)}>Review order <span>→</span></button></div>}{reviewOpen && <OrderReview {...{ cartItems, cart, setQty, setReviewOpen, setOrderCreated }} />}</div>;
}

function OrderReview({ cartItems, cart, setQty, setReviewOpen, setOrderCreated }: any) { return <div className="drawer-backdrop"><section className="review-drawer"><div className="drawer-head"><div><p className="eyebrow">Step 2 of 2</p><h2>Review your request</h2></div><button className="close" onClick={() => setReviewOpen(false)}>×</button></div><div className="review-items">{cartItems.map((p: CustomerProduct) => <div className="review-item" key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.pack}</small></span><div className="qty-control"><button onClick={() => setQty(p.sku, cart[p.sku] - 1)}>−</button><input value={cart[p.sku]} onChange={(e) => setQty(p.sku, Number(e.target.value))}/><button onClick={() => setQty(p.sku, cart[p.sku] + 1)}>＋</button></div></div>)}</div><div className="form-grid"><label>Contact name<input defaultValue="Maya Patel" /></label><label>Business name<input defaultValue="Valley Market" /></label><label>Email<input defaultValue="orders@valleymarket.com" type="email" /></label><label>Phone<input defaultValue="(415) 555-0187" /></label><label>Fulfillment<select><option>Delivery</option><option>Pickup</option></select></label><label>Requested date<input type="date" defaultValue="2026-08-12" /></label><label className="full">Delivery address<input defaultValue="428 Mission Street, San Francisco, CA 94105" /></label><label className="full">Notes<textarea placeholder="Delivery instructions or special requests" /></label></div><div className="notice"><b>This is an order request.</b> Pricing and final availability will be confirmed in your pro-forma.</div><button className="button customer-cta wide" onClick={() => { setOrderCreated(true); setReviewOpen(false); }}>Submit order request →</button></section></div>; }

function CustomerDocument({ total, products, cart, setStage, setChangeRequest, go, notify }: { total: number; products: Product[]; cart: Cart; setStage: (s: Stage) => void; setChangeRequest: (s: string) => void; go: (v: View) => void; notify: (s: string) => void }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const submitRequest = () => {
    const note = requestText.trim();
    if (!note) return;
    setChangeRequest(note);
    setStage("request");
    setRequestOpen(false);
    notify("Change request sent to sales");
  };
  return <div className="customer-shell centered"><header className="customer-header"><Brand /><div><CustomerRep /><span className="secure">● Secure document</span></div></header><main className="customer-doc"><p className="eyebrow">Action requested</p><h1>Your pro-forma is ready</h1><p>Review the confirmed quantities, pricing, and terms from Order Desk Wholesale.</p><section className="approval-card"><div><span>PF</span><div><b>Pro-forma PF-2026-0042</b><small>Valley Market · Valid through Aug 21</small></div></div><strong>{money(total)}</strong></section><div className="approval-actions"><button className="button secondary" onClick={() => setRequestOpen(true)}>Request changes</button><button className="button customer-cta" onClick={() => { setStage("approved"); downloadApprovedProformaPdf(products, cart); notify("Approved pro-forma PDF downloaded"); go("documents"); }}>✓ Approve & download PDF</button></div><p className="fine-print">Approving confirms quantities, pricing, and terms shown in the pro-forma. The approved PDF is the final step in this MVP.</p></main>{requestOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card change-request-dialog" role="dialog" aria-modal="true" aria-labelledby="change-request-title"><button className="close" onClick={() => setRequestOpen(false)}>×</button><p className="eyebrow">Before approval</p><h2 id="change-request-title">What should sales change?</h2><p>Describe quantity, product, delivery, pricing, or terms that need revision. The pro-forma will remain unapproved.</p><label>Requested changes<textarea autoFocus value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="Example: Please change All Spice Ground to 18 cases and move delivery to Aug 14." /></label><div className="edit-actions"><button className="button secondary" onClick={() => setRequestOpen(false)}>Cancel</button><button className="button customer-cta" disabled={!requestText.trim()} onClick={submitRequest}>Send request to sales →</button></div></section></div>}</div>;
}

function CustomerRep() { return <span className="rep-contact"><span className="rep-dot">DS</span><span>Your rep <b>Dipendra Subedi</b></span><a href="tel:+14155550124">(415) 555-0124</a></span>; }

function EditProduct({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (p: Product) => void }) { const [draft, setDraft] = useState(product); return <div className="drawer-backdrop"><section className="edit-panel"><div className="drawer-head"><div><p className="eyebrow">Catalog item</p><h2>Edit product</h2></div><button className="close" onClick={onClose}>×</button></div><div className="form-grid single"><label>SKU<input value={draft.sku} disabled /></label><label>Product name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Category<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label><label>Pack size<input value={draft.pack} onChange={(e) => setDraft({ ...draft, pack: e.target.value })} /></label><label>Sales price<input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label><label>Available quantity<input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} /></label><label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> Published to customers</label></div><div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={() => onSave(draft)}>Save changes</button></div></section></div>; }

function Settings({ notify }: { notify: (s: string) => void }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>Business settings</h1><p>Configure document identity, terms, and notifications.</p></div></div><section className="panel settings"><div className="form-grid"><label>Legal business name<input defaultValue="Order Desk Wholesale, Inc." /></label><label>Sales email<input defaultValue="sales@orderdesk.example" /></label><label>Tax / registration number<input defaultValue="US-94-4829107" /></label><label>Currency<select><option>USD — US Dollar</option></select></label><label>Pro-forma prefix<input defaultValue="PF-2026" /></label><label>Invoice prefix<input defaultValue="INV-2026" /></label><label className="full">Default terms<textarea defaultValue="Net 15. Final availability confirmed at dispatch." /></label></div><button className="button primary" onClick={() => notify("Business settings saved")}>Save settings</button></section></div>; }
function Placeholder({ title, description }: { title: string; description: string }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Sales workspace</p><h1>{title}</h1><p>{description}</p></div></div><section className="panel empty"><span>OD</span><h2>{title} is ready for phase 2</h2><p>The MVP data model and navigation are prepared for this workspace.</p></section></div>; }
function Brand() { return <button className="brand" onClick={() => location.reload()}><span className="brand-mark">OD</span><span>Order Desk</span></button>; }
