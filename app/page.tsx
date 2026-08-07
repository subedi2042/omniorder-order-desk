"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Product = { sku: string; name: string; category: string; pack: string; price: number; stock: number; published: boolean };
type Cart = Record<string, number>;
type Stage = "request" | "proforma" | "approved" | "dispatched" | "invoiced";
type View = "landing" | "home" | "products" | "orders" | "documents" | "customers" | "settings" | "catalog";

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
  if (view === "catalog") return <CustomerCatalog {...{ products: filtered.filter((p) => p.published), query, setQuery, categories, category, setCategory, cart, setQty, cartItems, reviewOpen, setReviewOpen, subtotal, tax, shipping, total, orderCreated, setOrderCreated, stage, setStage, go, notify }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-sidebar" onClick={() => go("landing")}><span className="brand-mark">OD</span><span>Order Desk</span></button>
        <p className="nav-label">Sales workspace</p>
        <nav>
          <Nav label="Overview" icon="⌂" active={view === "home"} onClick={() => go("home")} />
          <Nav label="Products" icon="◇" active={view === "products"} onClick={() => go("products")} />
          <Nav label="Orders" icon="▤" badge={orderCreated ? "1" : "12"} active={view === "orders"} onClick={() => go("orders")} />
          <Nav label="Quotes & invoices" icon="▧" active={view === "documents"} onClick={() => go("documents")} />
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
        {view === "orders" && <Orders orderCreated={orderCreated} stage={stage} setStage={setStage} cartItems={cartItems} cart={cart} subtotal={subtotal} total={total} go={go} notify={notify} />}
        {view === "documents" && <Documents stage={stage} setStage={setStage} total={total || 486.38} go={go} notify={notify} />}
        {view === "customers" && <Placeholder title="Customers" description="Manage customer contacts, catalogs, and order history." />}
        {view === "settings" && <Settings notify={notify} />}
      </main>
      {editing && <EditProduct product={editing} onClose={() => setEditing(null)} onSave={(updated) => { setProducts((all) => all.map((p) => p.sku === updated.sku ? updated : p)); setEditing(null); notify("Product updated"); }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Landing({ onSales, onCustomer, signInOpen, customerSignInOpen, onClose, onSignedIn, onCustomerSignedIn }: { onSales: () => void; onCustomer: () => void; signInOpen: boolean; customerSignInOpen: boolean; onClose: () => void; onSignedIn: () => void; onCustomerSignedIn: () => void }) {
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
    {customerSignInOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card customer-signin"><button className="close" onClick={onClose}>×</button><span className="brand-mark customer-mark">C</span><p className="eyebrow">Customer access</p><h2>Open your catalog</h2><p>Enter the access details shared by your sales representative. You do not need to create an account.</p><label>Shared access code<input defaultValue="ORD-VM-2026" autoCapitalize="characters" /></label><label>Your email<input type="email" defaultValue="orders@valleymarket.com" /></label><button className="button customer-cta wide" onClick={onCustomerSignedIn}>Open shared catalog →</button><div className="access-note"><b>Have a direct catalog link?</b><br/>Open it and you’ll skip this step automatically.</div><small>Access is limited to the catalog selected for your business.</small></section></div>}
  </div>;
}

function Nav({ label, icon, active, badge, onClick }: { label: string; icon: string; active: boolean; badge?: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}</button>;
}

function Dashboard({ orderCreated, stage, go, notify }: { orderCreated: boolean; stage: Stage; go: (v: View) => void; notify: (s: string) => void }) {
  return <div className="page dashboard-page">
    <div className="page-head"><div><p className="eyebrow">Friday, August 7</p><h1>Good afternoon, Dipendra</h1><p>Here’s what needs your attention today.</p></div><div className="actions"><button className="button secondary" onClick={() => { navigator.clipboard?.writeText(location.href); notify("Customer catalog link copied"); }}>↗ Share catalog</button><button className="button primary" onClick={() => go("products")}>＋ Upload inventory</button></div></div>
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
      <section className="panel workflow-card"><div className="panel-head"><div><h2>Order workflow</h2><p>From request to paid invoice</p></div></div>
        {["Customer request", "Sales review", "Pro-forma approval", "Distribution", "Final invoice"].map((label, i) => <div className="workflow-step" key={label}><span>{i + 1}</span><div><strong>{label}</strong><small>{["Quantities, no pricing", "Confirm stock and price", "Customer accepts terms", "Pick, pack and dispatch", "Issued automatically"][i]}</small></div></div>)}
      </section>
    </div>
  </div>;
}

function Metric({ tone, value, label, meta }: { tone: string; value: string; label: string; meta: string }) { return <div className="metric"><span className={`metric-icon ${tone}`}>●</span><div><strong>{value}</strong><p>{label}</p><small>{meta}</small></div></div>; }
function OrderRow({ initials, customer, number, details, status, fresh, onClick }: { initials: string; customer: string; number: string; details: string; status: string; fresh?: boolean; onClick: () => void }) { return <button className={`order-row ${fresh ? "fresh" : ""}`} onClick={onClick}><span className="avatar pale">{initials}</span><span className="order-info"><strong>{customer}</strong><small>{number} · {details}</small></span><span className={`badge ${status.toLowerCase()}`}>{status}</span><span>›</span></button>; }

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

function Orders({ orderCreated, stage, setStage, cartItems, cart, subtotal, total, go, notify }: { orderCreated: boolean; stage: Stage; setStage: (s: Stage) => void; cartItems: Product[]; cart: Cart; subtotal: number; total: number; go: (v: View) => void; notify: (s: string) => void }) {
  const items = cartItems.length ? cartItems : seedProducts.slice(2, 5);
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Orders / OR-2026-0137</p><h1>{orderCreated ? "Valley Market" : "Sunrise Supermarket"}</h1><p>Customer request · received today at 2:18 PM</p></div><div className="actions"><span className={`badge ${stage}`}>{stage === "request" ? "New request" : stage}</span></div></div>
    <div className="detail-grid"><section className="panel"><div className="panel-head"><div><h2>Requested items</h2><p>Confirm stock and pricing before creating a pro-forma.</p></div></div><div className="line-items">{items.map((p) => <div className="line-item" key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.pack}</small></span><span className="requested">Requested<br/><b>{cart[p.sku] || 4}</b></span><span className={p.stock < 20 ? "warning-text" : "success-text"}>{p.stock} in stock</span><span>{money(p.price)} / unit</span></div>)}</div></section>
      <aside className="panel customer-card"><div className="panel-head"><div><h2>Customer & delivery</h2></div></div><dl><dt>Contact</dt><dd>Maya Patel</dd><dt>Email</dt><dd>orders@valleymarket.com</dd><dt>Phone</dt><dd>(415) 555-0187</dd><dt>Fulfillment</dt><dd>Delivery · Aug 12</dd><dt>Address</dt><dd>428 Mission Street<br/>San Francisco, CA 94105</dd></dl></aside>
    </div>
    <div className="order-footer"><div><small>Estimated pro-forma total</small><strong>{money(total || subtotal + 24 + subtotal * .0825 || 486.38)}</strong></div><button className="button secondary" onClick={() => notify("Order changes saved")}>Save review</button><button className="button primary" onClick={() => { setStage("proforma"); go("documents"); notify("Pro-forma PF-2026-0042 created"); }}>Create pro-forma →</button></div>
  </div>;
}

function Documents({ stage, setStage, total, go, notify }: { stage: Stage; setStage: (s: Stage) => void; total: number; go: (v: View) => void; notify: (s: string) => void }) {
  const steps: Stage[] = ["proforma", "approved", "dispatched", "invoiced"];
  const current = Math.max(0, steps.indexOf(stage));
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Quotes & invoices</p><h1>{stage === "invoiced" ? "Invoice INV-2026-0028" : "Pro-forma PF-2026-0042"}</h1><p>Valley Market · Source order OR-2026-0137</p></div><div className="actions"><button className="button secondary" onClick={() => notify("PDF download prepared")}>⇩ Download PDF</button><button className="button secondary" onClick={() => { navigator.clipboard?.writeText(location.href); notify("Secure document link copied"); }}>↗ Copy secure link</button></div></div>
    <div className="document-grid"><section className="invoice-sheet"><div className="invoice-top"><div><span className="brand-mark">OD</span><h2>Order Desk Wholesale</h2><p>San Francisco, California</p></div><div className="invoice-title"><span className={`badge ${stage}`}>{stage}</span><h2>{stage === "invoiced" ? "INVOICE" : "PRO-FORMA"}</h2><p>{stage === "invoiced" ? "INV-2026-0028" : "PF-2026-0042"}</p></div></div><div className="invoice-parties"><div><small>BILL TO</small><strong>Valley Market</strong><p>Maya Patel<br/>428 Mission Street<br/>San Francisco, CA 94105</p></div><div><small>DOCUMENT DETAILS</small><p>Issued: Aug 7, 2026<br/>Valid through: Aug 21, 2026<br/>Terms: Net 15</p></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{seedProducts.slice(2, 5).map((p, i) => <tr key={p.sku}><td><b>{p.name}</b><small>{p.sku} · {p.pack}</small></td><td>{[6, 8, 4][i]}</td><td>{money(p.price)}</td><td>{money(p.price * [6, 8, 4][i])}</td></tr>)}</tbody></table><div className="invoice-total"><span>Subtotal <b>{money(Math.max(427.14, total / 1.0825 - 24))}</b></span><span>Shipping <b>$24.00</b></span><span>Tax (8.25%) <b>$35.24</b></span><strong>Total <b>{money(total || 486.38)}</b></strong></div><p className="invoice-note">Thank you for your business. Final availability is confirmed at dispatch.</p></section>
      <aside className="panel timeline"><div className="panel-head"><div><h2>Fulfillment status</h2><p>Shared with sales and distribution</p></div></div>{["Pro-forma sent", "Customer approved", "Products dispatched", "Final invoice issued"].map((label, i) => <div className={`timeline-step ${i <= current ? "done" : ""}`} key={label}><span>{i < current ? "✓" : i + 1}</span><div><b>{label}</b><small>{i < current ? "Completed" : i === current ? "Current step" : "Pending"}</small></div></div>)}
        {stage === "proforma" && <><button className="button primary wide" onClick={() => go("catalog")}>Open customer approval view</button><button className="button secondary wide" onClick={() => { setStage("approved"); notify("Approval recorded"); }}>Record offline approval</button></>}
        {stage === "approved" && <button className="button primary wide" onClick={() => { setStage("dispatched"); notify("Distribution notified · dispatch recorded"); }}>Mark products dispatched</button>}
        {stage === "dispatched" && <button className="button primary wide" onClick={() => { setStage("invoiced"); notify("Invoice issued and emailed to customer · sales rep CC’d"); }}>Issue final invoice</button>}
        {stage === "invoiced" && <button className="button primary wide" onClick={() => notify("Invoice marked paid")}>Mark invoice paid</button>}
      </aside>
    </div>
  </div>;
}

function CustomerCatalog(props: any) {
  const { products, query, setQuery, categories, category, setCategory, cart, setQty, cartItems, reviewOpen, setReviewOpen, subtotal, tax, shipping, total, orderCreated, setOrderCreated, stage, setStage, go, notify } = props;
  if (stage === "proforma") return <CustomerDocument total={total || 486.38} setStage={setStage} go={go} notify={notify} />;
  if (orderCreated && !reviewOpen) return <div className="customer-shell centered"><header className="customer-header"><Brand /><button className="text-button" onClick={() => go("home")}>Sales workspace</button></header><main className="confirmation"><span className="success-ring">✓</span><p className="eyebrow">Request received</p><h1>Thank you, Maya.</h1><p>Your order request <b>OR-2026-0137</b> has been sent to Dipendra. You’ll receive a priced pro-forma after stock is reviewed.</p><div className="confirmation-card"><span>{cartItems.length} product lines</span><span>Delivery requested Aug 12</span><span>No payment is due yet</span></div><button className="button primary" onClick={() => go("home")}>Open sales workspace →</button></main></div>;
  return <div className="customer-shell"><header className="customer-header"><Brand /><div><span className="rep-contact">Your rep: Dipendra · (415) 555-0124</span><button className="text-button" onClick={() => go("home")}>Sales sign in</button></div></header><main className="catalog-main"><div className="catalog-intro"><p className="eyebrow">Order Desk Wholesale</p><h1>Build your order request</h1><p>Choose quantities from today’s available catalog. Your sales rep will confirm pricing and final stock.</p></div><div className="catalog-tools"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by item or SKU" /></div><div className="chips">{categories.map((c: string) => <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>)}</div></div><div className="catalog-list">{products.map((p: Product) => <div className="catalog-row" key={p.sku}><span className="product-symbol">{p.name.slice(0, 1)}</span><span className="catalog-product"><small>{p.sku} · {p.category}</small><strong>{p.name}</strong><span>{p.pack} · Sold by tray</span></span><span className={`availability ${p.stock === 0 ? "out" : p.stock < 20 ? "low" : ""}`}>{p.stock === 0 ? "Out of stock" : p.stock < 20 ? "Low stock" : "In stock"}</span><div className="qty-control"><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) - 1)}>−</button><input aria-label={`Quantity for ${p.name}`} value={cart[p.sku] || 0} onChange={(e) => setQty(p.sku, Number(e.target.value))} /><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) + 1)}>＋</button></div></div>)}</div></main>{cartItems.length > 0 && <div className="cart-bar"><span><b>{cartItems.length}</b> product lines selected</span><button className="button customer-cta" onClick={() => setReviewOpen(true)}>Review order <span>→</span></button></div>}{reviewOpen && <OrderReview {...{ cartItems, cart, setQty, setReviewOpen, setOrderCreated, subtotal, tax, shipping, total }} />}</div>;
}

function OrderReview({ cartItems, cart, setQty, setReviewOpen, setOrderCreated }: any) { return <div className="drawer-backdrop"><section className="review-drawer"><div className="drawer-head"><div><p className="eyebrow">Step 2 of 2</p><h2>Review your request</h2></div><button className="close" onClick={() => setReviewOpen(false)}>×</button></div><div className="review-items">{cartItems.map((p: Product) => <div className="review-item" key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.pack}</small></span><div className="qty-control"><button onClick={() => setQty(p.sku, cart[p.sku] - 1)}>−</button><input value={cart[p.sku]} onChange={(e) => setQty(p.sku, Number(e.target.value))}/><button onClick={() => setQty(p.sku, cart[p.sku] + 1)}>＋</button></div></div>)}</div><div className="form-grid"><label>Contact name<input defaultValue="Maya Patel" /></label><label>Business name<input defaultValue="Valley Market" /></label><label>Email<input defaultValue="orders@valleymarket.com" type="email" /></label><label>Phone<input defaultValue="(415) 555-0187" /></label><label>Fulfillment<select><option>Delivery</option><option>Pickup</option></select></label><label>Requested date<input type="date" defaultValue="2026-08-12" /></label><label className="full">Delivery address<input defaultValue="428 Mission Street, San Francisco, CA 94105" /></label><label className="full">Notes<textarea placeholder="Delivery instructions or special requests" /></label></div><div className="notice"><b>This is an order request.</b> Pricing and final availability will be confirmed in your pro-forma.</div><button className="button customer-cta wide" onClick={() => { setOrderCreated(true); setReviewOpen(false); }}>Submit order request →</button></section></div>; }

function CustomerDocument({ total, setStage, go, notify }: { total: number; setStage: (s: Stage) => void; go: (v: View) => void; notify: (s: string) => void }) { return <div className="customer-shell centered"><header className="customer-header"><Brand /><span className="secure">● Secure document</span></header><main className="customer-doc"><p className="eyebrow">Action requested</p><h1>Your pro-forma is ready</h1><p>Review the confirmed quantities, pricing, and terms from Order Desk Wholesale.</p><section className="approval-card"><div><span>PF</span><div><b>Pro-forma PF-2026-0042</b><small>Valley Market · Valid through Aug 21</small></div></div><strong>{money(total)}</strong></section><div className="approval-actions"><button className="button secondary" onClick={() => notify("PDF download prepared")}>⇩ Download PDF</button><button className="button secondary" onClick={() => notify("Change request sent to sales")}>Request changes</button><button className="button customer-cta" onClick={() => { setStage("approved"); notify("Pro-forma approved"); go("documents"); }}>✓ Approve pro-forma</button></div><p className="fine-print">Approving confirms quantities, pricing, and terms shown in the pro-forma. The final invoice will be issued after dispatch.</p></main></div>; }

function EditProduct({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (p: Product) => void }) { const [draft, setDraft] = useState(product); return <div className="drawer-backdrop"><section className="edit-panel"><div className="drawer-head"><div><p className="eyebrow">Catalog item</p><h2>Edit product</h2></div><button className="close" onClick={onClose}>×</button></div><div className="form-grid single"><label>SKU<input value={draft.sku} disabled /></label><label>Product name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Category<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label><label>Pack size<input value={draft.pack} onChange={(e) => setDraft({ ...draft, pack: e.target.value })} /></label><label>Sales price<input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label><label>Available quantity<input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} /></label><label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> Published to customers</label></div><div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={() => onSave(draft)}>Save changes</button></div></section></div>; }

function Settings({ notify }: { notify: (s: string) => void }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>Business settings</h1><p>Configure document identity, terms, and notifications.</p></div></div><section className="panel settings"><div className="form-grid"><label>Legal business name<input defaultValue="Order Desk Wholesale, Inc." /></label><label>Sales email<input defaultValue="sales@orderdesk.example" /></label><label>Tax / registration number<input defaultValue="US-94-4829107" /></label><label>Currency<select><option>USD — US Dollar</option></select></label><label>Pro-forma prefix<input defaultValue="PF-2026" /></label><label>Invoice prefix<input defaultValue="INV-2026" /></label><label className="full">Default terms<textarea defaultValue="Net 15. Final availability confirmed at dispatch." /></label></div><button className="button primary" onClick={() => notify("Business settings saved")}>Save settings</button></section></div>; }
function Placeholder({ title, description }: { title: string; description: string }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Sales workspace</p><h1>{title}</h1><p>{description}</p></div></div><section className="panel empty"><span>OD</span><h2>{title} is ready for phase 2</h2><p>The MVP data model and navigation are prepared for this workspace.</p></section></div>; }
function Brand() { return <button className="brand" onClick={() => location.reload()}><span className="brand-mark">OD</span><span>Order Desk</span></button>; }
