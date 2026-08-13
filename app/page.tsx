"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Product = { sku: string; name: string; category: string; pack: string; price: number; stock: number; published: boolean };
type CustomerRecord = { id: string; business: string; contact: string; email: string; phone: string; address: string; accessCode?: string; codeExpiresAt?: string; shareToken?: string };
type CustomerProduct = Omit<Product, "price">;
type Cart = Record<string, number>;
type QuoteLine = { sku: string; quantity: number; unitPrice: number };
type SalesUser = { sub: string; email: string; name: string; picture?: string };
type SavedOrder = { id: string; customerId: string; customer: CustomerRecord; items: Array<{ sku: string; quantity: number }>; status: "request" | "proforma" | "approved"; quoteLines?: QuoteLine[]; discountPercent?: number; shippingAmount?: number; taxPercent?: number; quoteNotes?: string; createdAt: string; updatedAt: string };
type Stage = "request" | "proforma" | "approved" | "dispatched" | "invoiced";
type View = "landing" | "privacy" | "support" | "fast-quote" | "home" | "products" | "create-list" | "orders" | "documents" | "customers" | "settings" | "catalog";

const seedProducts: Product[] = [];
const seedCustomers: CustomerRecord[] = [];

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
async function persistCustomer(customer: CustomerRecord) {
  let response = customer.shareToken
    ? await fetch("/api/catalog-shares", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customer.shareToken, customer }) })
    : customer.accessCode
    ? await fetch("/api/customer-access", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: customer.accessCode, customer }) })
    : await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: [customer] }) });
  if (!response.ok && customer.accessCode) response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: [customer] }) });
  if (!response.ok) throw new Error("Customer details could not be saved");
  return customer;
}
const parseCsvRow = (row: string) => { const values: string[] = []; let value = ""; let quoted = false; for (let index = 0; index < row.length; index++) { const character = row[index]; if (character === '"' && quoted && row[index + 1] === '"') { value += '"'; index++; } else if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { values.push(value.trim()); value = ""; } else value += character; } values.push(value.trim()); return values; };
const compareSkuAscending = (first: Product, second: Product) => {
  const firstSku = first.sku.trim();
  const secondSku = second.sku.trim();
  const firstNumber = /^\d+$/.test(firstSku) ? Number(firstSku) : Number.POSITIVE_INFINITY;
  const secondNumber = /^\d+$/.test(secondSku) ? Number(secondSku) : Number.POSITIVE_INFINITY;
  return firstNumber - secondNumber || firstSku.localeCompare(secondSku);
};

function invoiceLines(products: Product[], cart: Cart) {
  return products.filter((product) => (cart[product.sku] || 0) > 0).map((product) => ({ ...product, quantity: cart[product.sku] }));
}

function pricedQuoteLines(products: Product[], cart: Cart, quoteLines: QuoteLine[]) {
  if (!quoteLines.length) return invoiceLines(products, cart).map((line) => ({ ...line, unitPrice: line.price }));
  return quoteLines.map((line) => ({ ...products.find((product) => product.sku === line.sku)!, ...line })).filter((line) => line.sku);
}

function quoteAmounts(products: Product[], cart: Cart, quoteLines: QuoteLine[], discountPercent: number, shippingAmount = 0, taxPercent = 0) {
  const lines = pricedQuoteLines(products, cart, quoteLines);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = subtotal * Math.min(100, Math.max(0, discountPercent)) / 100;
  const discountedSubtotal = subtotal - discount;
  const shipping = Math.max(0, shippingAmount);
  const tax = discountedSubtotal * Math.min(100, Math.max(0, taxPercent)) / 100;
  return { lines, subtotal, discount, shipping, tax, total: discountedSubtotal + shipping + tax };
}

async function createProformaPdf(products: Product[], cart: Cart, quoteLines: QuoteLine[], discountPercent: number, shippingAmount: number, taxPercent: number, quoteNotes: string, approved: boolean, customer?: CustomerRecord | null) {
  const { lines, subtotal, discount, shipping, tax, total } = quoteAmounts(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent);
  const escapePdf = (value: string) => value.replace(/[^\x20-\x7E]/g, (character) => character === "×" ? "x" : "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const text = (value: string, x: number, y: number, size = 10, bold = false, color = "0.05 0.09 0.08") => `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;
  const rule = (x1: number, y1: number, x2: number, y2: number, width = .7, color = ".82 .83 .80") => `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
  const fill = (x: number, y: number, width: number, height: number, color: string) => `${color} rg ${x} ${y} ${width} ${height} re f`;
  const commands = [
    "q 58 0 0 58 36 697 cm /Logo Do Q",
    `BT /F3 18 Tf 0 .25 .18 rg 1 0 0 1 108 731 Tm (${escapePdf("Desi Kitchen")}) Tj ET`,
    text("Paramount,", 36, 682, 11, false, ".32 .38 .48"), text("California", 36, 665, 11, false, ".32 .38 .48"),
    fill(approved ? 504 : 462, 735, approved ? 72 : 114, 20, approved ? ".90 .96 .93" : "1 .94 .84"),
    text(approved ? "APPROVED" : "AWAITING APPROVAL", approved ? 515 : 471, 742, 8, true, approved ? "0 .31 .26" : ".55 .28 0"),
    `BT /F3 25 Tf 0 .25 .18 rg 1 0 0 1 430 704 Tm (${escapePdf("ESTIMATE")}) Tj ET`, text("Customer estimate", 468, 684, 10, false, ".32 .38 .48"),
    rule(36, 638, 576, 638, 1.2, ".05 .09 .08"),
    text("BILL TO", 36, 605, 9, true, ".35 .40 .38"), text(customer?.business || "Customer on order request", 36, 581, 13, true),
    text(customer?.contact || "Contact supplied with secure order", 36, 561, 11), text((customer?.address || customer?.email || "Delivery details supplied with order").slice(0, 48), 36, 545, 9),
    text("DOCUMENT DETAILS", 315, 605, 9, true, ".35 .40 .38"), text("Issued when sent by sales", 315, 573, 11),
    text("Validity and terms set by sales", 315, 555, 11),
    text("ITEM", 48, 505, 8, true, ".35 .40 .38"), text("QTY", 294, 505, 8, true, ".35 .40 .38"),
    text("UNIT PRICE", 435, 505, 8, true, ".35 .40 .38"), text("TOTAL", 530, 505, 8, true, ".35 .40 .38"), rule(36, 491, 576, 491),
  ];
  let rowY = 466;
  lines.slice(0, 7).forEach((line) => {
    commands.push(text(line.name, 48, rowY, 9, true), text(`${line.sku} - ${line.pack}`, 48, rowY - 14, 8, false, ".35 .40 .38"));
    commands.push(text(String(line.quantity), 294, rowY - 2, 10), text(money(line.unitPrice), 435, rowY - 2, 10), text(money(line.unitPrice * line.quantity), 530, rowY - 2, 10));
    commands.push(rule(36, rowY - 27, 576, rowY - 27));
    rowY -= 48;
  });
  const totalsY = Math.max(126, rowY - 8);
  commands.push(
    text("Subtotal", 390, totalsY, 10), text(money(subtotal), 530, totalsY, 10, true),
    ...(discountPercent > 0 ? [text(`Discount (${discountPercent}%)`, 390, totalsY - 20, 10), text(`-${money(discount)}`, 530, totalsY - 20, 10, true)] : []),
    text("Shipping", 390, totalsY - 40, 10), text(money(shipping), 530, totalsY - 40, 10, true),
    text(`Tax (${taxPercent}%)`, 390, totalsY - 60, 10), text(money(tax), 530, totalsY - 60, 10, true),
    rule(390, totalsY - 73, 576, totalsY - 73, 1.1, ".05 .09 .08"),
    text("Total", 390, totalsY - 98, 15, true), text(money(total), 520, totalsY - 98, 15, true),
    rule(36, 55, 576, 55), text(approved ? "Approved estimate. Pricing and quantities were accepted by the customer." : "Preview only. Customer approval is required before this estimate is accepted.", 36, 36, 8, false, ".35 .40 .38"),
    text(quoteNotes ? `Sales note: ${quoteNotes.slice(0, 78)}` : "Desi Kitchen sales | sales@desikitchen.me | (562) 470-7400", 36, 22, 8, false, ".35 .40 .38"),
  );
  const content = commands.join("\n");
  const encoder = new TextEncoder();
  const logoBytes = new Uint8Array(await fetch("/desi-kitchen-logo-pdf.jpg").then((response) => {
    if (!response.ok) throw new Error("Could not load the Desi Kitchen PDF logo");
    return response.arrayBuffer();
  }));
  const objectBodies: Uint8Array[] = [
    encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    encoder.encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /Logo 8 0 R >> >> /Contents 4 0 R >>"),
    encoder.encode(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`),
    encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    encoder.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>"),
    new Uint8Array([
      ...encoder.encode(`<< /Type /XObject /Subtype /Image /Width 512 /Height 512 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`),
      ...logoBytes,
      ...encoder.encode("\nendstream"),
    ]),
  ];
  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  const offsets = [0];
  let byteLength = parts[0].length;
  objectBodies.forEach((body, index) => {
    offsets.push(byteLength);
    const object = new Uint8Array([...encoder.encode(`${index + 1} 0 obj\n`), ...body, ...encoder.encode("\nendobj\n")]);
    parts.push(object);
    byteLength += object.length;
  });
  const xref = byteLength;
  parts.push(encoder.encode(`xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return URL.createObjectURL(new Blob(parts as BlobPart[], { type: "application/pdf" }));
}

async function downloadApprovedProformaPdf(products: Product[], cart: Cart, quoteLines: QuoteLine[], discountPercent: number, shippingAmount: number, taxPercent: number, quoteNotes: string, customer?: CustomerRecord | null) {
  const url = await createProformaPdf(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, true, customer);
  const link = document.createElement("a");
  link.href = url;
  link.download = "desi-kitchen-approved-estimate.pdf";
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
  const [savedOrderCount, setSavedOrderCount] = useState(0);
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toast, setToast] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const [customerSignInOpen, setCustomerSignInOpen] = useState(false);
  const [targetedList, setTargetedList] = useState(false);
  const [targetSkus, setTargetSkus] = useState<string[]>([]);
  const [targetQuantities, setTargetQuantities] = useState<Cart>({});
  const [changeRequest, setChangeRequest] = useState("");
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [salesUser, setSalesUser] = useState<SalesUser | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>(seedCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [orderCustomer, setOrderCustomer] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    if (orderCustomer) sessionStorage.setItem("desi-kitchen-order-customer", JSON.stringify(orderCustomer));
  }, [orderCustomer]);

  useEffect(() => {
    if (!currentOrderId) return;
    const existing = savedOrders.find((order) => order.id === currentOrderId);
    if (existing?.status === stage) return;
    fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentOrderId, status: stage, token: orderCustomer?.shareToken }) }).then((response) => {
      if (!response.ok) throw new Error("Status save failed");
      setSavedOrders((orders) => orders.map((order) => order.id === currentOrderId ? { ...order, status: stage as SavedOrder["status"], updatedAt: new Date().toISOString() } : order));
      setSavedOrderCount((count) => stage === "request" ? count : Math.max(0, count - (existing?.status === "request" ? 1 : 0)));
    }).catch(() => notify("Order status could not be saved"));
  }, [stage, currentOrderId]);

  useEffect(() => {
    const updateCustomer = (event: Event) => setOrderCustomer((event as CustomEvent<CustomerRecord>).detail);
    const recordOrder = () => setSavedOrderCount((count) => count + 1);
    window.addEventListener("order-customer-updated", updateCustomer);
    window.addEventListener("order-submitted", recordOrder);
    return () => { window.removeEventListener("order-customer-updated", updateCustomer); window.removeEventListener("order-submitted", recordOrder); };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get("token");
    if (shareToken) {
      setTargetedList(true);
      setView("catalog");
      fetch(`/api/catalog-shares?token=${encodeURIComponent(shareToken)}`).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Secure catalog unavailable");
        setProducts((current) => current.length ? current : (data.products || []).map((product: CustomerProduct) => ({ ...product, price: 0 })));
        setTargetSkus((data.products || []).map((product: CustomerProduct) => product.sku));
        setCart(data.initialQuantities || {});
        if (data.customer) setOrderCustomer(data.customer);
      }).catch(() => notify("This secure catalog link is invalid or expired"));
    }
    fetch("/api/auth/google").then((response) => response.json()).then((data) => setSalesUser(data.user || null)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!salesUser) return;
    fetch("/api/products").then((response) => response.ok ? response.json() : null).then((data) => { if (Array.isArray(data?.products) && data.products.length) setProducts(data.products); }).catch(() => undefined);
    fetch("/api/customers").then((response) => response.ok ? response.json() : null).then((data) => { if (data?.customers?.length) setCustomers(data.customers); }).catch(() => undefined);
    fetch("/api/orders").then((response) => response.ok ? response.json() : null).then((data) => {
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      setSavedOrders(orders);
      setSavedOrderCount(orders.filter((order: any) => order.status === "request").length);
      const latest = orders[0];
      if (!latest) return;
      setOrderCreated(true);
      setCurrentOrderId(latest.id);
      setStage(latest.status === "approved" ? "approved" : latest.status === "proforma" ? "proforma" : "request");
      setOrderCustomer(latest.customer || null);
      setCart(Object.fromEntries((latest.items || []).map((item: { sku: string; quantity: number }) => [item.sku, item.quantity])));
      setQuoteLines(latest.quoteLines || []);
      setDiscountPercent(Number(latest.discountPercent) || 0);
      setShippingAmount(Number(latest.shippingAmount) || 0);
      setTaxPercent(Number(latest.taxPercent) || 0);
      setQuoteNotes(latest.quoteNotes || "");
    }).catch(() => undefined);
  }, [salesUser]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const cartItems = products.filter((p) => (cart[p.sku] || 0) > 0);
  const categories = ["All products", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) => {
    const matchQuery = `${p.sku} ${p.name}`.toLowerCase().includes(query.toLowerCase());
    return matchQuery && (category === "All products" || p.category === category);
  }).sort(compareSkuAscending);
  const subtotal = cartItems.reduce((sum, p) => sum + p.price * cart[p.sku], 0);
  const shipping = shippingAmount;
  const tax = subtotal * taxPercent / 100;
  const total = subtotal + shipping + tax;
  const quotedTotal = quoteAmounts(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent).total;
  const customerProducts: CustomerProduct[] = filtered.filter((p) => p.published && (!targetedList || targetSkus.includes(p.sku))).map(({ price: _privatePrice, ...product }) => product);
  const customerCartItems: CustomerProduct[] = cartItems.map(({ price: _privatePrice, ...product }) => product);

  const setQty = (sku: string, qty: number) => setCart((current) => ({ ...current, [sku]: Math.max(0, qty) }));
  const openSavedOrder = (order: SavedOrder) => { setCurrentOrderId(order.id); setOrderCreated(true); setStage(order.status); setOrderCustomer(order.customer); setCart(Object.fromEntries(order.items.map((item) => [item.sku, item.quantity]))); setQuoteLines(order.quoteLines || []); setDiscountPercent(order.discountPercent || 0); setShippingAmount(order.shippingAmount || 0); setTaxPercent(order.taxPercent || 0); setQuoteNotes(order.quoteNotes || ""); go(order.status === "approved" ? "documents" : "orders"); };
  const saveOrderStatus = async (status: SavedOrder["status"], estimate?: { quoteLines: QuoteLine[]; discountPercent: number; shippingAmount: number; taxPercent: number; quoteNotes: string }) => {
    if (!currentOrderId) return false;
    const response = await fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentOrderId, status, token: orderCustomer?.shareToken, ...estimate }) });
    if (!response.ok) { notify("Order status could not be saved"); return false; }
    setStage(status); setSavedOrders((orders) => orders.map((order) => order.id === currentOrderId ? { ...order, ...estimate, status, updatedAt: new Date().toISOString() } : order)); setSavedOrderCount((count) => status === "request" ? count : Math.max(0, count - (savedOrders.find((order) => order.id === currentOrderId)?.status === "request" ? 1 : 0))); return true;
  };
  const salesViews: View[] = ["home", "products", "create-list", "orders", "documents", "customers", "settings"];
  const go = (next: View) => {
    if (salesViews.includes(next) && !salesUser) {
      setView("landing");
      setReviewOpen(false);
      setSignInOpen(true);
      history.replaceState({}, "", location.pathname);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (salesViews.includes(next)) {
      history.replaceState({}, "", location.pathname);
      fetch("/api/products").then((response) => response.ok ? response.json() : null).then((data) => {
        if (Array.isArray(data?.products)) setProducts(data.products);
      }).catch(() => notify("The full sales catalog could not be refreshed"));
      if (next === "create-list" || next === "customers") fetch("/api/customers").then((response) => response.ok ? response.json() : null).then((data) => {
        if (Array.isArray(data?.customers)) setCustomers(data.customers);
      }).catch(() => notify("The shared customer list could not be refreshed"));
    }
    setView(next); setReviewOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const importCatalog = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
      const headers = parseCsvRow(lines.shift() || "").map((value) => value.toLowerCase());
      const rows = lines.map((row) => Object.fromEntries(parseCsvRow(row).map((value, index) => [headers[index], value])));
      const required = ["sku", "name", "category", "pack", "price", "stock", "published"];
      if (!required.every((header) => headers.includes(header))) { event.target.value = ""; return notify(`CSV needs these columns: ${required.join(", ")}`); }
      const parsed = rows.map((row) => ({ sku: row.sku, name: row.name, category: row.category || "Imported", pack: row.pack || "Each", stock: Math.max(0, Math.floor(Number(row.stock) || 0)), price: Math.max(0, Number(row.price) || 0), published: !["false", "no", "0"].includes(String(row.published).toLowerCase()) })).filter((product) => product.sku && product.name);
      if (parsed.length) { const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: parsed }) }); if (!response.ok) return notify("Upload could not be saved. Please try again."); setProducts((current) => [...parsed, ...current.filter((product) => !parsed.some((next) => next.sku === product.sku))]); notify(`${parsed.length} products saved; matching SKUs were replaced`); }
      else notify("No valid product rows found. Download and use the combined template.");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  if (view === "landing") return <Landing customers={customers} onSales={() => salesUser ? go("home") : setSignInOpen(true)} onCustomer={() => setCustomerSignInOpen(true)} onPrivacy={() => go("privacy")} onSupport={() => go("support")} onFastQuote={() => go("fast-quote")} signInOpen={signInOpen} customerSignInOpen={customerSignInOpen} onClose={() => { setSignInOpen(false); setCustomerSignInOpen(false); }} onSignedIn={(user) => { setSalesUser(user); setSignInOpen(false); go("home"); }} onCustomerSignedIn={(customer) => { setOrderCustomer(customer); setCustomerSignInOpen(false); go("catalog"); }} />;
  if (view === "privacy") return <PrivacyPage onBack={() => go("landing")} onSupport={() => go("support")} />;
  if (view === "support") return <SupportPage onBack={() => go("landing")} />;
  if (view === "fast-quote") return <FastQuotePage onBack={() => go("landing")} onStart={() => { go("landing"); setCustomerSignInOpen(true); }} />;
  if (view === "catalog") return <CustomerCatalog {...{ products: customerProducts, pdfProducts: products, query, setQuery, categories, category, setCategory, cart, setQty, cartItems: customerCartItems, reviewOpen, setReviewOpen, orderCreated, setOrderCreated, stage, setStage, go, notify, targetedList, changeRequest, setChangeRequest, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, orderCustomer, setOrderCustomer, proformaTotal: stage === "proforma" ? quotedTotal : undefined }} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-sidebar" onClick={() => go("landing")}><img className="brand-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen logo"/><span className="company-name">Desi Kitchen</span></button>
        <p className="nav-label">Sales workspace</p>
        <nav>
          <Nav label="Overview" icon="⌂" active={view === "home"} onClick={() => go("home")} />
          <Nav label="Products" icon="◇" active={view === "products"} onClick={() => go("products")} />
          <Nav label="Orders" icon="▤" badge={orderCreated ? "1" : undefined} active={view === "orders"} onClick={() => go("orders")} />
          <Nav label="Estimates" icon="▧" active={view === "documents"} onClick={() => go("documents")} />
          <Nav label="Customers" icon="♧" active={view === "customers"} onClick={() => go("customers")} />
        </nav>
        <div className="sidebar-bottom">
          <Nav label="Settings" icon="⚙" active={view === "settings"} onClick={() => go("settings")} />
          <button className="profile signed-in-profile" onClick={async () => { await fetch("/api/auth/google", { method: "DELETE" }); setSalesUser(null); go("landing"); }}><span className="avatar">{salesUser?.name?.slice(0, 2).toUpperCase() || "SR"}</span><span><strong>{salesUser?.name || "Sales user"}</strong><small>Sign out</small></span></button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="mobile-header"><button className="brand" onClick={() => go("home")}><img className="brand-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen logo"/><span className="company-name">Desi Kitchen</span></button><button className="icon-button" onClick={() => go("catalog")}>Catalog</button></header>
        {view === "home" && <Dashboard orderCreated={orderCreated} savedOrderCount={savedOrderCount} savedOrders={savedOrders} openSavedOrder={openSavedOrder} stage={stage} products={products} salesUser={salesUser} go={go} notify={notify} />}
        {view === "products" && <Products products={products} setProducts={setProducts} filtered={filtered} query={query} setQuery={setQuery} categories={categories} category={category} setCategory={setCategory} setEditing={setEditing} importCatalog={importCatalog} notify={notify} go={go} />}
        {view === "create-list" && <SalesOrderListBuilder products={products.filter((p) => p.published)} customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId} selected={targetSkus} setSelected={setTargetSkus} quantities={targetQuantities} setQuantities={setTargetQuantities} onPrerequisite={(next) => go(next)} onSend={(customer) => { setOrderCustomer(customer); setTargetedList(true); }} notify={notify} />}
        {view === "orders" && (orderCreated ? <Orders orderCreated={orderCreated} stage={stage} setStage={setStage} saveOrderStatus={saveOrderStatus} products={products} cart={cart} quoteLines={quoteLines} setQuoteLines={setQuoteLines} discountPercent={discountPercent} setDiscountPercent={setDiscountPercent} shippingAmount={shippingAmount} setShippingAmount={setShippingAmount} taxPercent={taxPercent} setTaxPercent={setTaxPercent} quoteNotes={quoteNotes} setQuoteNotes={setQuoteNotes} changeRequest={changeRequest} setChangeRequest={setChangeRequest} go={go} notify={notify} /> : <EmptyState title="No orders yet" description="Customer requests will appear here after a secure catalog link is submitted." action="Create an order list" onAction={() => go("create-list")} />)}
        {view === "documents" && (orderCreated ? <Documents stage={stage} setStage={setStage} products={products} cart={cart} quoteLines={quoteLines} discountPercent={discountPercent} shippingAmount={shippingAmount} taxPercent={taxPercent} quoteNotes={quoteNotes} customer={orderCustomer} go={go} notify={notify} /> : <EmptyState title="No estimates yet" description="Create an estimate after a customer submits an order request." action="View orders" onAction={() => go("orders")} />)}
        {view === "customers" && <Customers customers={customers} setCustomers={setCustomers} notify={notify} />}
        {view === "settings" && <Settings notify={notify} />}
      </main>
      {editing && <EditProduct product={editing} isNew={!products.some((product) => product.sku === editing.sku)} onClose={() => setEditing(null)} onDelete={async () => { const response = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: editing.sku }) }); if (!response.ok) return notify("Product could not be deleted"); setProducts((all) => all.filter((p) => p.sku !== editing.sku)); setEditing(null); notify("Product deleted from the catalog"); }} onSave={async (updated) => { const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: [updated] }) }); if (!response.ok) return notify("Product could not be saved"); setProducts((all) => all.some((p) => p.sku === updated.sku) ? all.map((p) => p.sku === updated.sku ? updated : p) : [updated, ...all]); setEditing(null); notify("Product saved to the catalog"); }} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Landing({ customers, onSales, onCustomer, onPrivacy, onSupport, onFastQuote, signInOpen, customerSignInOpen, onClose, onSignedIn, onCustomerSignedIn }: { customers: CustomerRecord[]; onSales: () => void; onCustomer: () => void; onPrivacy: () => void; onSupport: () => void; onFastQuote: () => void; signInOpen: boolean; customerSignInOpen: boolean; onClose: () => void; onSignedIn: (user: SalesUser) => void; onCustomerSignedIn: (customer: CustomerRecord) => void }) {
  const [customerCode, setCustomerCode] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [newProfile, setNewProfile] = useState({ business: "", contact: "", email: "", phone: "" });
  const [verifiedCustomer, setVerifiedCustomer] = useState<CustomerRecord | null>(null);
  const verifyCode = async () => {
    const normalized = customerCode.trim().toUpperCase();
    let match = customers.find((customer) => customer.accessCode === normalized);
    if (!match) { try { const response = await fetch("/api/customer-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalized }) }); const data = await response.json(); if (response.ok) match = data.customer; } catch {} }
    if (!match || !match.codeExpiresAt || new Date(match.codeExpiresAt).getTime() <= Date.now()) { setCodeError("This code is incorrect or has expired. Please call Sahil for a new 24-hour access code."); return; }
    setNewProfile({ business: match.business, contact: match.contact, email: match.email, phone: match.phone });
    setVerifiedCustomer(match);
    setCodeError("");
    setCodeVerified(true);
  };
  const newProfileReady = Object.values(newProfile).every((value) => value.trim());
  return <div className="landing">
    <header className="landing-header"><Brand /></header>
    <main className="landing-main">
      <p className="eyebrow">Warehouse ordering, simplified</p><h1>Orders, quotes, and invoices—<br/>all in one place.</h1>
      <p className="landing-lead">A faster way for sales teams and customers to manage warehouse orders from any device.</p>
      <div className="entry-grid">
        <section className="entry-card"><span className="entry-icon">▤</span><p className="eyebrow">For your team</p><h2>Sales Rep</h2><p>Manage inventory, review orders, create quotes, and send invoices.</p><button className="button primary wide" onClick={onSales}>Log in to sales workspace →</button></section>
        <section className="entry-card customer-entry"><span className="entry-icon">⌑</span><p className="eyebrow">For customers</p><h2>Place an Order</h2><p>Use the secure access shared by your sales rep. No account or password needed.</p><button className="button customer-cta wide" onClick={onCustomer}>Customer access →</button></section>
      </div>
      <div className="landing-benefits"><span>▣ <b>Works on any device</b></span><span>♙ <b>Single-order secure access</b></span><button onClick={onFastQuote}>ϟ <b>Fast quote requests</b><small>Learn how it works →</small></button></div>
    </main>
    <footer className="landing-footer">© 2026 Desi Kitchen <button onClick={onPrivacy}>Privacy</button><button onClick={onSupport}>Technical support</button></footer>
    {signInOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card sales-auth-card"><button className="close" onClick={onClose}>×</button><img className="brand-logo" src="/desi-kitchen-logo.png" alt=""/><p className="eyebrow">Sales workspace</p><h2>Welcome back</h2><p>Sign in with your Desi Kitchen sales credentials or Google account.</p><PasswordSalesSignIn onSignedIn={onSignedIn}/><div className="auth-divider">or use Google</div><GoogleSalesSignIn onSignedIn={onSignedIn} /></section></div>}
    {customerSignInOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card customer-signin"><button className="close" onClick={onClose}>×</button><img className="brand-logo signin-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen"/><p className="eyebrow">Customer access</p><h2>{codeVerified ? "Confirm your order profile" : "Open your shared catalog"}</h2>{!codeVerified ? <><p>Use the secure catalog link sent by your Desi Kitchen sales representative. Each link opens only the products shared for that order.</p><div className="rep-card"><img className="company-logo-badge" src="/desi-kitchen-logo.png" alt="Desi Kitchen"/><span><small>Your sales representative</small><b>Sahil Man Singh Pradhan</b><a href="tel:+15626450113">(562) 645-0113</a></span></div><label>Sales-issued access code<input value={customerCode} onChange={(event) => { setCustomerCode(event.target.value.toUpperCase()); setCodeError(""); }} placeholder="Enter the code from sales" autoCapitalize="characters" /></label>{codeError && <div className="code-error-popup" role="alert"><b>Access code unavailable</b><p>{codeError}</p><a className="button primary wide" href="tel:+15626450113">Call Sahil · (562) 645-0113</a></div>}<button className="button customer-cta wide" disabled={!customerCode.trim()} onClick={verifyCode}>Verify access code →</button><div className="access-note"><b>Have a secure order link?</b><br/>Open that link directly from the email or message sent by sales.</div></> : <><p>Your saved information is filled in below. You can edit it before ordering.</p><div className="new-profile-grid"><label>Business name<input value={newProfile.business} onChange={(event) => setNewProfile({ ...newProfile, business: event.target.value })}/></label><label>Contact name<input value={newProfile.contact} onChange={(event) => setNewProfile({ ...newProfile, contact: event.target.value })}/></label><label>Email<input type="email" value={newProfile.email} onChange={(event) => setNewProfile({ ...newProfile, email: event.target.value })}/></label><label>Phone<input type="tel" value={newProfile.phone} onChange={(event) => setNewProfile({ ...newProfile, phone: event.target.value })}/></label></div><div className="security-note"><b>Customer data is protected.</b><br/>Updates remain saved until a sales representative deletes the customer record.</div><button className="button customer-cta wide" disabled={!newProfileReady} onClick={() => onCustomerSignedIn({ ...(verifiedCustomer || { id: crypto.randomUUID(), address: "" }), ...newProfile })}>Confirm profile & open catalog →</button></>}</section></div>}
  </div>;
}

function GoogleSalesSignIn({ onSignedIn }: { onSignedIn: (user: SalesUser) => void }) {
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      const google = (window as typeof window & { google?: { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } } } }).google;
      const element = document.getElementById("google-sales-signin");
      if (!google || !element) return;
      google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
        setError("");
        const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
        const data = await response.json();
        if (!response.ok || !data.user) { setError(data.error || "Google sign-in failed."); return; }
        onSignedIn(data.user);
      } });
      element.replaceChildren();
      google.accounts.id.renderButton(element, { theme: "outline", size: "large", shape: "rectangular", text: "signin_with", width: "330" });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) { if ((window as typeof window & { google?: unknown }).google) render(); else existing.addEventListener("load", render, { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setError("Google sign-in could not be loaded. Check your connection and try again.");
    document.head.appendChild(script);
  }, [clientId, onSignedIn]);
  if (!clientId) return <div className="google-auth-area"><button className="google-button-fallback" disabled title="A Google Web Client ID must be configured first"><span className="google-g">G</span><b>Sign in with Google</b></button><div className="google-auth-setup"><b>Administrator setup required</b><span>The Google button is ready, but a Google Web Client ID must be connected before it can open authentication.</span></div></div>;
  return <><div id="google-sales-signin" className="google-signin-button" aria-label="Sign in with Google" />{error && <p className="form-error">{error}</p>}</>;
}

function PasswordSalesSignIn({ onSignedIn }: { onSignedIn: (user: SalesUser) => void }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: registering ? "register" : "login", name, email, password }) });
      const data = await response.json();
      if (!response.ok || !data.user) { setError(data.error || "Sales sign-in failed."); return; }
      onSignedIn(data.user);
    } catch { setError("Sales sign-in is temporarily unavailable."); }
    finally { setSubmitting(false); }
  };
  return <div className="password-auth"><div className="profile-mode"><button className={!registering ? "active" : ""} onClick={() => { setRegistering(false); setError(""); }}>Sign in</button><button className={registering ? "active" : ""} onClick={() => { setRegistering(true); setError(""); }}>First-time setup</button></div>{registering && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sales representative name"/></label>}<label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com"/></label><label>Password<input type="password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="Minimum 8 characters"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={submitting || !email.trim() || password.length < 8 || (registering && name.trim().length < 2)} onClick={submit}>{submitting ? "Signing in…" : registering ? "Create sales account & sign in" : "Sign in to sales workspace"}</button>{registering && <small>Use a valid business email. Your password is securely hashed and is never stored as readable text.</small>}</div>;
}

function PublicHeader({ onBack }: { onBack: () => void }) { return <header className="landing-header public-header"><Brand /><button className="text-button" onClick={onBack}>← Back to home</button></header>; }

function PrivacyPage({ onBack, onSupport }: { onBack: () => void; onSupport: () => void }) { return <div className="public-page"><PublicHeader onBack={onBack}/><main><p className="eyebrow">Privacy & security</p><h1>Your customer data is handled carefully.</h1><p className="public-lead">Desi Kitchen uses customer information only to prepare quotes, manage approvals, and support fulfillment.</p><div className="public-grid"><section><h2>What we collect</h2><p>Business and contact details, catalog access activity, order quantities, quote revisions, approvals, and delivery information.</p></section><section><h2>How access works</h2><p>Customers use a secure catalog link supplied by sales. Sales workspace access requires an authorized account.</p></section><section><h2>How data is protected</h2><p>Connections use encrypted HTTPS. Access to customer and commercial information is restricted to authorized sales users.</p></section><section><h2>Your choices</h2><p>Contact support to request access, correction, export, or deletion of customer profile data, subject to business record requirements.</p></section></div><div className="public-callout"><b>Payment security</b><p>This order desk does not collect card or bank information. Never send passwords or payment credentials through an order note.</p><button className="button primary" onClick={onSupport}>Contact technical support →</button></div></main></div>; }

function SupportPage({ onBack }: { onBack: () => void }) { return <div className="public-page"><PublicHeader onBack={onBack}/><main><p className="eyebrow">Technical support</p><h1>We’re here to help.</h1><p className="public-lead">For catalog access, quote approval, or technical problems, contact Desi Kitchen.</p><div className="support-card"><span className="support-icon">?</span><div><small>Customer and sales support</small><h2>Desi Kitchen Support</h2><a href="tel:+15624707400">(562) 470-7400</a><a href="mailto:sales@desikitchen.me">sales@desikitchen.me</a><p>6329 Alondra Blvd, Paramount, CA 90723</p></div></div><div className="public-grid"><section><h2>Catalog-access help</h2><p>Contact your sales representative or the Desi Kitchen office for a new secure order link.</p></section><section><h2>What to provide</h2><p>Your business name, browser/device, order or estimate number, and a short description. Never send passwords or payment details.</p></section></div></main></div>; }

function FastQuotePage({ onBack, onStart }: { onBack: () => void; onStart: () => void }) { return <div className="public-page"><PublicHeader onBack={onBack}/><main><p className="eyebrow">Fast quote requests</p><h1>Request warehouse pricing in minutes.</h1><p className="public-lead">Use the single-order code or secure token supplied by your sales representative, choose catalog items and quantities, then receive a priced estimate for approval.</p><div className="quote-steps"><section><span>1</span><h2>Verify access</h2><p>Enter your new code, or open the secure token link from sales.</p></section><section><span>2</span><h2>Select products</h2><p>Choose items and quantities from the product list. No payment is collected.</p></section><section><span>3</span><h2>Review the quote</h2><p>Sales confirms stock, negotiates pricing or discounts, and sends the estimate.</p></section><section><span>4</span><h2>Approve or revise</h2><p>Approve and download the PDF, or send requested changes back to sales.</p></section></div><div className="public-callout"><h2>Ready to request a quote?</h2><p>You’ll need a current access code. First-time customers create their profile only after the code is verified.</p><button className="button customer-cta" onClick={onStart}>Start a quote request →</button></div></main></div>; }

function Nav({ label, icon, active, badge, onClick }: { label: string; icon: string; active: boolean; badge?: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}</button>;
}

function Dashboard({ savedOrderCount, savedOrders, openSavedOrder, products, salesUser, go }: { orderCreated: boolean; savedOrderCount: number; savedOrders: SavedOrder[]; openSavedOrder: (order: SavedOrder) => void; stage: Stage; products: Product[]; salesUser: SalesUser | null; go: (v: View) => void; notify: (s: string) => void }) {
  const firstName = salesUser?.name?.split(" ")[0] || "Sales team";
  return <div className="page dashboard-page">
    <div className="page-head"><div><p className="eyebrow">Sales workspace</p><h1>Welcome, {firstName}</h1><p>Your workspace is ready for live catalog and customer data.</p></div><div className="actions"><button className="button secondary" onClick={() => go("create-list")}>＋ Create order list</button><button className="button primary" onClick={() => go("products")}>＋ Upload inventory</button></div></div>
    <div className="metric-grid">
      <Metric tone="green" value={String(savedOrderCount)} label="New requests" meta="Customer submissions" />
      <Metric tone="amber" value={String(savedOrders.filter((order) => order.status === "proforma").length)} label="Awaiting approval" meta="Estimates sent" />
      <Metric tone="blue" value={String(savedOrders.filter((order) => order.status === "approved").length)} label="Approved" meta="Accepted estimates" />
      <Metric tone="red" value={String(products.filter((product) => product.stock < 20).length)} label="Low-stock products" meta="Uploaded inventory" />
    </div>
    <div className="dashboard-grid">
      <section className="panel recent"><div className="panel-head"><div><h2>Recent order requests</h2><p>Latest activity from your customers</p></div><button className="text-button" onClick={() => go("orders")}>View all →</button></div>
        {savedOrders.length ? savedOrders.slice(0, 8).map((order) => <OrderRow key={order.id} initials={(order.customer?.business || "CU").slice(0,2).toUpperCase()} customer={order.customer?.business || "Customer order"} number={order.id} details={`${order.items.length} products · ${new Date(order.createdAt).toLocaleString()}`} status={order.status === "request" ? "New" : order.status === "proforma" ? "Quoted" : "Approved"} fresh={order.status === "request"} onClick={() => openSavedOrder(order)} />) : <div className="empty inline-empty"><h2>No order requests</h2><p>Send a secure catalog link after uploading customers and products.</p></div>}
      </section>
      <section className="panel workflow-card"><div className="panel-head"><div><h2>Current MVP workflow</h2><p>From request to approved PDF</p></div></div>
        {["Customer request", "Sales review", "Approved estimate PDF"].map((label, i) => <div className="workflow-step" key={label}><span>{i + 1}</span><div><strong>{label}</strong><small>{["Quantities, no pricing", "Confirm stock and price", "Customer accepts and downloads"][i]}</small></div></div>)}
      </section>
    </div>
  </div>;
}

function Metric({ tone, value, label, meta }: { tone: string; value: string; label: string; meta: string }) { return <div className="metric"><span className={`metric-icon ${tone}`}>●</span><div><strong>{value}</strong><p>{label}</p><small>{meta}</small></div></div>; }
function OrderRow({ initials, customer, number, details, status, fresh, onClick }: { initials: string; customer: string; number: string; details: string; status: string; fresh?: boolean; onClick: () => void }) { return <button className={`order-row ${fresh ? "fresh" : ""}`} onClick={onClick}><span className="avatar pale">{initials}</span><span className="order-info"><strong>{customer}</strong><small>{number} · {details}</small></span><span className={`badge ${status.toLowerCase()}`}>{status}</span><span>›</span></button>; }

function SalesOrderListBuilder({ products, customers, selectedCustomerId, setSelectedCustomerId, selected, setSelected, quantities, setQuantities, onPrerequisite, onSend, notify }: { products: Product[]; customers: CustomerRecord[]; selectedCustomerId: string; setSelectedCustomerId: (id: string) => void; selected: string[]; setSelected: (s: string[]) => void; quantities: Cart; setQuantities: (quantities: Cart) => void; onPrerequisite: (view: "customers" | "products") => void; onSend: (customer: CustomerRecord) => void; notify: (s: string) => void }) {
  const [search, setSearch] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [draftCustomerName, setDraftCustomerName] = useState("");
  const customer = customers.find((record) => record.id === selectedCustomerId) || customers[0];
  const visible = products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (sku: string) => {
    if (selected.includes(sku)) { setSelected(selected.filter((s) => s !== sku)); const next = { ...quantities }; delete next[sku]; setQuantities(next); }
    else { setSelected([...selected, sku]); setQuantities({ ...quantities, [sku]: quantities[sku] || 1 }); }
  };
  const setInitialQuantity = (sku: string, quantity: number) => setQuantities({ ...quantities, [sku]: Math.max(1, Math.floor(quantity || 1)) });
  useEffect(() => {
    fetch("/api/order-list-drafts").then(async (response) => {
      const data = await response.json();
      if (response.ok && data.draft) {
        setSelectedCustomerId(data.draft.customerId);
        setSelected(Array.isArray(data.draft.skus) ? data.draft.skus : []);
        setQuantities(data.draft.quantities || {});
        setDraftSavedAt(data.draft.updatedAt || "");
        setDraftCustomerName(data.draft.customerName || "Saved customer");
      }
    }).finally(() => setDraftReady(true));
  }, []);
  useEffect(() => {
    if (!draftReady || !customer) return;
    const timeout = window.setTimeout(async () => {
      const response = await fetch("/api/order-list-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, skus: selected, quantities }) });
      if (response.ok) {
        const data = await response.json();
        setDraftSavedAt(data.updatedAt || new Date().toISOString());
        setDraftCustomerName(customer.business);
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draftReady, customer?.id, selected.join("|"), JSON.stringify(quantities)]);
  const generateLink = async () => {
    if (!customer || !selected.length || generating) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/catalog-shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, skus: selected, quantities }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Secure link could not be created");
      const link = `${location.origin}/?token=${encodeURIComponent(data.token)}`;
      setGeneratedLink(link);
      onSend(customer);
      await navigator.clipboard?.writeText(link);
      notify(`Secure link created and copied for ${customer.business}`);
    } catch { notify("Secure link could not be created. Please try again."); }
    finally { setGenerating(false); }
  };
  const copyLink = async () => { await navigator.clipboard?.writeText(generatedLink); notify("Secure customer link copied"); };
  if (!customers.length || !products.length) return <EmptyState title="Complete setup before sharing a catalog" description={!customers.length && !products.length ? "Upload a customer list and product inventory before creating an order link." : !customers.length ? "Upload at least one customer before creating an order link." : "Publish at least one in-stock product before creating an order link."} action={!customers.length ? "Upload customers" : "Upload inventory"} onAction={() => onPrerequisite(!customers.length ? "customers" : "products")} />;
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">Sales initiated order</p><h1>Create a customer order list</h1><p>Choose the customer and products, then send a secure quantity-request link.</p>{draftSavedAt && <small className="draft-status">Draft saved for <b>{draftCustomerName}</b> · {selected.length} products · {new Date(draftSavedAt).toLocaleString()}</small>}</div><span className="badge approved">{draftSavedAt ? "Draft saved" : "New draft"}</span></div>
    <div className="builder-grid"><section className="panel builder-main"><div className="builder-section"><span className="builder-number">1</span><div><h2>Choose customer</h2><p>Search uploaded customers by business, contact, or email.</p></div></div><div className="customer-choice"><span className="avatar pale">{customer?.business.slice(0,2).toUpperCase()}</span><span><b>{customer?.business}</b><small>{customer?.contact} · {customer?.email}</small></span><select aria-label="Select customer" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>{customers.map((record) => <option key={record.id} value={record.id}>{record.business} — {record.contact}</option>)}</select></div>
      <div className="builder-section"><span className="builder-number">2</span><div><h2>Select products and starting quantities</h2><p>Customers will see these products without prices and may edit every quantity before submitting.</p></div></div><div className="search builder-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or SKU" /></div><div className="builder-products">{visible.map((p) => <div className="builder-product" key={p.sku}><input aria-label={`Select ${p.name}`} type="checkbox" checked={selected.includes(p.sku)} onChange={() => toggle(p.sku)} /><span><b>{p.name}</b><small>{p.sku} · {p.pack} · {p.stock < 20 ? "Low stock" : "In stock"}</small></span>{selected.includes(p.sku) && <label className="builder-quantity">Starting qty<input aria-label={`Starting quantity for ${p.name}`} type="number" min="1" max={Math.max(1, p.stock)} value={quantities[p.sku] || 1} onChange={(event) => setInitialQuantity(p.sku, Number(event.target.value))} /></label>}</div>)}</div>
    </section><aside className="panel builder-summary"><p className="eyebrow">Link summary</p><h2>{customer?.business}</h2><dl><dt>Products included</dt><dd>{selected.length}</dd><dt>Prices visible</dt><dd>No</dd><dt>Assigned rep</dt><dd>Signed-in sales representative</dd><dt>Expires</dt><dd>24 hours</dd></dl><div className="notice"><b>Customer action</b><br/>Enter quantities and send the completed request back to sales.</div><button className="button primary wide" disabled={!selected.length || generating} onClick={generateLink}>{generating ? "Generating secure site…" : "Generate secure customer site →"}</button>{generatedLink && <div className="generated-link"><label>Customer site<input readOnly value={generatedLink} onFocus={(event) => event.currentTarget.select()} /></label><button className="button primary wide" onClick={copyLink}>Copy link</button><button className="button secondary wide" onClick={() => window.open(generatedLink, "_blank", "noopener,noreferrer")}>Open customer site ↗</button><small>This private link expires after 24 hours.</small></div>}</aside></div>
  </div>;
}

function Products({ products, setProducts, filtered, query, setQuery, categories, category, setCategory, setEditing, importCatalog, notify, go }: { products: Product[]; setProducts: (p: Product[]) => void; filtered: Product[]; query: string; setQuery: (s: string) => void; categories: string[]; category: string; setCategory: (s: string) => void; setEditing: (p: Product | null) => void; importCatalog: (e: ChangeEvent<HTMLInputElement>) => void; notify: (s: string) => void; go: (v: View) => void }) {
  const addProduct = () => setEditing({ sku: "", name: "", category: "Imported", pack: "Each", price: 0, stock: 0, published: false });
  const deleteProduct = async (product: Product) => { if (!window.confirm(`Delete ${product.name} (${product.sku})? This cannot be undone.`)) return; const response = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: product.sku }) }); if (!response.ok) return notify("Product could not be deleted"); setProducts(products.filter((item) => item.sku !== product.sku)); notify("Product deleted from the catalog"); };
  const clearProducts = async () => { if (!products.length || !window.confirm(`Clear all ${products.length} product and inventory records? This cannot be undone.`)) return; const response = await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); if (!response.ok) return notify("Catalog could not be cleared"); setProducts([]); notify("Catalog cleared from the backend"); };
  const togglePublished = async (product: Product) => { const updated = { ...product, published: !product.published }; const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ products: [updated] }) }); if (!response.ok) return notify("Visibility change could not be saved"); setProducts(products.map((item) => item.sku === updated.sku ? updated : item)); notify(updated.published ? "Product published" : "Product hidden"); };
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">Catalog</p><h1>Products & inventory</h1><p>Upload and maintain products, pricing, inventory, and customer visibility in one catalog.</p><div className="template-links"><span>Download template:</span><a href="/templates/desi-kitchen-product-list.csv" download>Products with inventory CSV</a></div></div><div className="actions"><label className="button secondary file-button">⇧ Upload catalog CSV<input type="file" accept=".csv,text/csv" onChange={importCatalog} /></label><button className="button danger-outline" disabled={!products.length} onClick={clearProducts}>Clear catalog</button><button className="button primary" onClick={addProduct}>＋ Add product</button></div></div>
    <div className="metric-grid compact"><Metric tone="green" value={String(products.length)} label="Total products" meta="Uploaded catalog" /><Metric tone="blue" value={String(products.filter(p => p.published).length)} label="Published" meta="Customer-visible" /><Metric tone="amber" value={String(products.filter(p => !p.published).length)} label="Hidden" meta="Draft or unavailable" /><Metric tone="red" value={String(products.filter(p => p.stock < 20).length)} label="Low stock" meta="Needs attention" /></div>
    <section className="panel product-panel">
      <div className="toolbar"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product name or SKU" /></div><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select><button className="button secondary" onClick={() => go("catalog")}>View customer catalog ↗</button><span className="result-count">{filtered.length} results</span></div>
      {filtered.length ? <><div className="table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Pack</th><th>Price</th><th>Stock</th><th>Customer visibility</th><th>Actions</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.sku}><td className="mono">{p.sku}</td><td><strong>{p.name}</strong></td><td>{p.category}</td><td>{p.pack}</td><td>{money(p.price)}</td><td><span className={`stock ${p.stock === 0 ? "out" : p.stock < 20 ? "low" : ""}`}>{p.stock === 0 ? "Out of stock" : p.stock < 20 ? `${p.stock} · Low` : p.stock}</span></td><td><button aria-label={`Toggle ${p.name} visibility`} className={`toggle ${p.published ? "on" : ""}`} onClick={() => togglePublished(p)}><span /></button></td><td><div className="row-actions"><button className="row-action" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>Edit</button><button className="row-delete" aria-label={`Delete ${p.name}`} onClick={() => deleteProduct(p)}>Delete</button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>{filtered.length} products</span><span>25 per page</span></div></> : <div className="empty inline-empty"><h2>No products or inventory</h2><p>Upload the combined product and inventory CSV, or add the first product manually.</p></div>}
    </section>
  </div>;
}

function Orders({ orderCreated, stage, setStage, saveOrderStatus, products, cart, quoteLines, setQuoteLines, discountPercent, setDiscountPercent, shippingAmount, setShippingAmount, taxPercent, setTaxPercent, quoteNotes, setQuoteNotes, changeRequest, setChangeRequest, go, notify }: { orderCreated: boolean; stage: Stage; setStage: (s: Stage) => void; saveOrderStatus?: (status: SavedOrder["status"], estimate?: { quoteLines: QuoteLine[]; discountPercent: number; shippingAmount: number; taxPercent: number; quoteNotes: string }) => Promise<boolean>; products: Product[]; cart: Cart; quoteLines: QuoteLine[]; setQuoteLines: (lines: QuoteLine[]) => void; discountPercent: number; setDiscountPercent: (n: number) => void; shippingAmount: number; setShippingAmount: (n: number) => void; taxPercent: number; setTaxPercent: (n: number) => void; quoteNotes: string; setQuoteNotes: (s: string) => void; changeRequest: string; setChangeRequest: (s: string) => void; go: (v: View) => void; notify: (s: string) => void }) {
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const draftLines = quoteLines.length ? quoteLines : invoiceLines(products, cart).map((line) => ({ sku: line.sku, quantity: line.quantity, unitPrice: line.price }));
  const amounts = quoteAmounts(products, cart, draftLines, discountPercent, shippingAmount, taxPercent);
  const updateLine = (index: number, patch: Partial<QuoteLine>) => setQuoteLines(draftLines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const availableProducts = products.filter((product) => product.published && !draftLines.some((line) => line.sku === product.sku) && `${product.sku} ${product.name}`.toLowerCase().includes(itemSearch.toLowerCase())).sort(compareSkuAscending);
  const openItemPicker = () => { const first = products.filter((product) => product.published && !draftLines.some((line) => line.sku === product.sku)).sort(compareSkuAscending)[0]; if (!first) return notify("Every published catalog item is already included in this Estimate"); setItemSku(first.sku); setItemQuantity(1); setItemSearch(""); setItemPickerOpen(true); };
  const addSelectedLine = () => { const product = products.find((entry) => entry.sku === itemSku); if (!product) return; setQuoteLines([...draftLines, { sku: product.sku, quantity: Math.max(1, itemQuantity), unitPrice: product.price }]); setItemPickerOpen(false); notify(`${product.name} added to the Estimate`); };
  const addLine = openItemPicker;
  if (itemPickerOpen) return <div className="page"><div className="drawer-backdrop signin-backdrop"><section className="signin-card item-picker" role="dialog" aria-modal="true" aria-labelledby="add-estimate-item"><button className="close" onClick={() => setItemPickerOpen(false)}>×</button><p className="eyebrow">Estimate item</p><h2 id="add-estimate-item">Select product and quantity</h2><p>Search the published catalog, choose the exact product, and enter its starting quantity.</p><label>Search products<input autoFocus value={itemSearch} onChange={(event) => { setItemSearch(event.target.value); const first = products.filter((product) => product.published && !draftLines.some((line) => line.sku === product.sku) && `${product.sku} ${product.name}`.toLowerCase().includes(event.target.value.toLowerCase())).sort(compareSkuAscending)[0]; setItemSku(first?.sku || ""); }} placeholder="Search by product name or SKU" /></label><label>Product<select value={itemSku} onChange={(event) => setItemSku(event.target.value)}>{availableProducts.map((product) => <option key={product.sku} value={product.sku}>{product.sku} — {product.name} · {money(product.price)}</option>)}</select></label><label>Quantity<input type="number" min="1" value={itemQuantity} onChange={(event) => setItemQuantity(Math.max(1, Number(event.target.value)))} /></label>{itemSku && <div className="notice"><b>{products.find((product) => product.sku === itemSku)?.name}</b><br/>Catalog unit price: {money(products.find((product) => product.sku === itemSku)?.price || 0)}</div>}<div className="edit-actions"><button className="button secondary" onClick={() => setItemPickerOpen(false)}>Cancel</button><button className="button primary" disabled={!itemSku} onClick={addSelectedLine}>Add selected item →</button></div></section></div></div>;
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Orders / Current request</p><h1>Customer order request</h1><p>Submitted through a secure customer catalog</p></div><div className="actions"><span className={`badge ${stage}`}>{stage === "request" ? "New request" : stage === "proforma" ? "Estimate" : stage}</span></div></div>
    {changeRequest && <div className="change-request-banner"><div><span>↺</span><div><b>Customer requested changes</b><p>{changeRequest}</p></div></div><button className="button secondary" onClick={() => notify("Revision note marked as reviewed")}>Mark reviewed</button></div>}
    <div className="detail-grid"><section className="panel quote-editor"><div className="panel-head"><div><h2>{changeRequest ? "Revise estimate" : "Build estimate"}</h2><p>Catalog pricing is the default. Sales may adjust items, quantities, unit prices, discount, shipping, tax, and notes before sending.</p></div><button className="button secondary" onClick={addLine}>＋ Add item</button></div><div className="quote-editor-head"><span>Item</span><span>Qty</span><span>Unit price</span><span>Line total</span><span></span></div><div>{amounts.lines.map((line, index) => <div className="quote-edit-line" key={`${line.sku}-${index}`}><select aria-label={`Item ${index + 1}`} value={line.sku} onChange={(event) => { const product = products.find((item) => item.sku === event.target.value)!; updateLine(index, { sku: product.sku, unitPrice: product.price }); }}>{products.filter((product) => product.published).map((product) => <option key={product.sku} value={product.sku}>{product.sku} - {product.name}</option>)}</select><input aria-label={`Quantity for quote line ${index + 1}`} type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })}/><div className="money-input"><span>$</span><input aria-label={`Unit price for quote line ${index + 1}`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: Math.max(0, Number(event.target.value)) })}/></div><b>{money(line.quantity * line.unitPrice)}</b><button aria-label={`Remove quote line ${index + 1}`} className="remove-line" onClick={() => setQuoteLines(draftLines.filter((_, lineIndex) => lineIndex !== index))}>×</button><small>{line.pack} · {line.stock} in stock · List {money(line.price)}</small></div>)}</div><div className="quote-terms"><div className="estimate-adjustments"><label>Discount percentage<input aria-label="Discount percentage" type="number" min="0" max="100" step="0.5" value={discountPercent} onChange={(event) => setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value))))}/></label><label>Shipping amount ($)<input aria-label="Shipping amount" type="number" min="0" step="0.01" value={shippingAmount} onChange={(event) => setShippingAmount(Math.max(0, Number(event.target.value)))}/></label><label>Tax percentage<input aria-label="Tax percentage" type="number" min="0" max="100" step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(Math.min(100, Math.max(0, Number(event.target.value))))}/></label></div><label>Notes shown on estimate<textarea aria-label="Estimate notes" value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} placeholder="Delivery timing, promotional terms, substitutions, or other customer-facing notes"/></label><div className="quote-summary"><span>Subtotal <b>{money(amounts.subtotal)}</b></span>{discountPercent > 0 && <span>Discount ({discountPercent}%) <b>-{money(amounts.discount)}</b></span>}<span>Shipping <b>{money(amounts.shipping)}</b></span><span>Tax ({taxPercent}%) <b>{money(amounts.tax)}</b></span><strong>Total <b>{money(amounts.total)}</b></strong></div></div></section>
      <aside className="panel customer-card"><div className="panel-head"><div><h2>Customer & delivery</h2></div></div><p>Customer contact, fulfillment, and delivery details are supplied with the submitted secure order request.</p></aside>
    </div>
    <div className="order-footer"><div><small>Final estimate total</small><strong>{money(amounts.total)}</strong></div><button className="button secondary" onClick={() => notify("Estimate draft saved")}>Save draft</button><button className="button primary" disabled={!draftLines.length} onClick={async () => { setQuoteLines(draftLines); const saved = await saveOrderStatus?.("proforma", { quoteLines: draftLines, discountPercent, shippingAmount, taxPercent, quoteNotes }); if (saved === false) return; setChangeRequest(""); setStage("proforma"); go("documents"); notify(changeRequest ? "Revised estimate sent" : "Estimate created and sent"); }}>{changeRequest ? "Send revised estimate →" : "Send for approval →"}</button></div>
  </div>;
}

function Documents({ stage, setStage, products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, customer, go, notify }: { stage: Stage; setStage: (s: Stage) => void; products: Product[]; cart: Cart; quoteLines: QuoteLine[]; discountPercent: number; shippingAmount: number; taxPercent: number; quoteNotes: string; customer: CustomerRecord | null; go: (v: View) => void; notify: (s: string) => void }) {
  const { lines, subtotal, discount, shipping, tax, total } = quoteAmounts(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent);
  const approved = stage === "approved";
  const download = () => { downloadApprovedProformaPdf(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, customer); notify("Approved estimate PDF downloaded"); };
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Estimates</p><h1>{approved ? "Approved estimate" : "Customer estimate"}</h1><p>Prepared from the current customer order request</p></div><div className="actions">{approved && <button className="button primary" onClick={download}>⇩ Download approved estimate PDF</button>}<button className="button secondary" onClick={() => { navigator.clipboard?.writeText(location.href); notify("Secure document link copied"); }}>↗ Copy secure link</button></div></div>
    <div className="document-grid"><section className="invoice-sheet"><div className="invoice-top"><div><img className="brand-logo" src="/desi-kitchen-logo.png" alt=""/><h2>Desi Kitchen</h2><p>Paramount, California</p></div><div className="invoice-title"><span className={`badge ${approved ? "approved" : "proforma"}`}>{approved ? "approved" : "awaiting approval"}</span><h2>ESTIMATE</h2><p>Customer estimate</p></div></div><div className="invoice-parties"><div><small>BILL TO</small><strong>Customer on order request</strong><p>Contact and delivery details<br/>are supplied with the secure order.</p></div><div><small>DOCUMENT DETAILS</small><p>Issued when sent by sales<br/>Validity and terms set by sales</p></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.sku}><td><b>{line.name}</b><small>{line.sku} · {line.pack}</small></td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{money(line.unitPrice * line.quantity)}</td></tr>)}</tbody></table><div className="invoice-total"><span>Subtotal <b>{money(subtotal)}</b></span>{discountPercent > 0 && <span>Discount ({discountPercent}%) <b>-{money(discount)}</b></span>}<span>Shipping <b>{money(shipping)}</b></span><span>Tax ({taxPercent}%) <b>{money(tax)}</b></span><strong>Total <b>{money(total)}</b></strong></div>{quoteNotes && <p className="invoice-note"><b>Sales note:</b> {quoteNotes}</p>}<p className="invoice-note">{approved ? "Approved by the customer. Pricing, quantities, and terms are accepted." : "Thank you for your business. Customer approval is required."}</p></section>
      <aside className="panel timeline"><div className="panel-head"><div><h2>Approval status</h2><p>This MVP ends with an approved PDF</p></div></div><div className="timeline-step done"><span>✓</span><div><b>Estimate created</b><small>Pricing and stock confirmed</small></div></div><div className={`timeline-step ${approved ? "done" : ""}`}><span>{approved ? "✓" : "2"}</span><div><b>Customer approved</b><small>{approved ? "Completed" : "Pending"}</small></div></div>
        {stage === "proforma" && <><button className="button primary wide" onClick={() => go("catalog")}>Open customer approval view</button><button className="button secondary wide" onClick={() => { setStage("approved"); notify("Approval recorded"); }}>Record offline approval</button></>}
        {approved && <><button className="button primary wide" onClick={download}>Open or download approved PDF</button><div className="notice"><b>Approved and sent to dispatch</b><br/>This accepted estimate is the dispatch team’s approved document. Final invoicing remains in the next implementation phase.</div></>}
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
  const { products, pdfProducts, query, setQuery, categories, category, setCategory, cart, setQty, cartItems, reviewOpen, setReviewOpen, orderCreated, setOrderCreated, stage, setStage, go, notify, targetedList, changeRequest, setChangeRequest, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, orderCustomer, setOrderCustomer, proformaTotal } = props;
  if (stage === "proforma") return <CustomerDocument total={proformaTotal} products={pdfProducts} cart={cart} quoteLines={quoteLines} discountPercent={discountPercent} shippingAmount={shippingAmount} taxPercent={taxPercent} quoteNotes={quoteNotes} customer={orderCustomer} setCustomer={setOrderCustomer} setStage={setStage} setChangeRequest={setChangeRequest} go={go} notify={notify} />;
  if (changeRequest) return <div className="customer-shell centered"><header className="customer-header"><Brand /><CustomerRep /></header><main className="confirmation"><span className="success-ring">✓</span><p className="eyebrow">Changes requested</p><h1>Your note was sent to sales.</h1><p>Your sales representative will revise the estimate and send an updated version for approval.</p><div className="change-summary"><small>Your request</small><p>{changeRequest}</p></div><button className="button primary" onClick={() => go("orders")}>Open sales review →</button></main></div>;
  if (orderCreated && !reviewOpen) return <div className="customer-shell centered"><header className="customer-header"><Brand /><CustomerRep /></header><main className="confirmation"><span className="success-ring">✓</span><p className="eyebrow">Request received</p><h1>Thank you.</h1><p>Your order request has been sent to Desi Kitchen sales. You’ll receive a priced estimate after stock is reviewed.</p><div className="confirmation-card"><span>{cartItems.length} product lines</span><span>Delivery date requested</span><span>No payment is due yet</span></div><p className="rep-help">Questions? Call <a href="tel:+15624707400">(562) 470-7400</a>.</p><button className="button primary" onClick={() => go("home")}>Return to home →</button></main></div>;
  return <div className="customer-shell"><header className="customer-header"><Brand /><div><CustomerRep /><button className="text-button" onClick={() => go("home")}>Sales sign in</button></div></header><main className="catalog-main"><div className="catalog-intro">{targetedList && <span className="shared-list-label">Shared order list</span>}<p className="eyebrow">Desi Kitchen</p><h1>{targetedList ? "Products selected for your order" : "Build your order request"}</h1><p>{targetedList ? "Enter the quantities you need and send the completed list back to your sales representative. Pricing will be confirmed in the estimate." : "Choose quantities from today’s available catalog. Your sales rep will confirm pricing and final stock."}</p></div>{products.length ? <><div className="catalog-tools"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by item or SKU" /></div><div className="chips">{categories.map((c: string) => <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>)}</div></div><div className="catalog-list">{products.map((p: CustomerProduct) => <div className="catalog-row" key={p.sku}><span className="product-symbol">{p.name.slice(0, 1)}</span><span className="catalog-product"><small>{p.sku} · {p.category}</small><strong>{p.name}</strong><span>{p.pack}</span></span><span className={`availability ${p.stock === 0 ? "out" : p.stock < 20 ? "low" : ""}`}>{p.stock === 0 ? "Out of stock" : p.stock < 20 ? "Low stock" : "In stock"}</span><div className="qty-control"><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) - 1)}>−</button><input aria-label={`Quantity for ${p.name}`} value={cart[p.sku] || 0} onChange={(e) => setQty(p.sku, Number(e.target.value))} /><button disabled={p.stock === 0} onClick={() => setQty(p.sku, (cart[p.sku] || 0) + 1)}>＋</button></div></div>)}</div></> : <div className="panel empty inline-empty"><img className="empty-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen"/><h2>No catalog has been published</h2><p>Please contact Desi Kitchen sales for an active catalog link.</p></div>}</main>{cartItems.length > 0 && <div className="cart-bar"><span><b>{cartItems.length}</b> product lines selected</span><button className="button customer-cta" onClick={() => setReviewOpen(true)}>Review order <span>→</span></button></div>}{reviewOpen && <OrderReview {...{ cartItems, cart, setQty, setReviewOpen, setOrderCreated }} />}</div>;
}

function OrderReview({ cartItems, cart, setQty, setReviewOpen, setOrderCreated }: any) {
  const saved = typeof window === "undefined" ? null : sessionStorage.getItem("desi-kitchen-order-customer");
  const [customer, setCustomer] = useState<CustomerRecord>(() => saved ? JSON.parse(saved) : { id: crypto.randomUUID(), business: "", contact: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const update = (field: keyof CustomerRecord, value: string) => setCustomer((current) => ({ ...current, [field]: value }));
  const valid = customer.business.trim() && customer.contact.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) && customer.phone.trim() && customer.address.trim();
  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await persistCustomer(customer);
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customer.shareToken, accessCode: customer.accessCode, customer, items: cartItems.map((item: CustomerProduct) => ({ sku: item.sku, quantity: cart[item.sku] })) }) });
      if (!response.ok) throw new Error("Order could not be saved");
      sessionStorage.setItem("desi-kitchen-order-customer", JSON.stringify(customer));
      window.dispatchEvent(new CustomEvent("order-customer-updated", { detail: customer }));
      window.dispatchEvent(new Event("order-submitted"));
      setOrderCreated(true);
      setReviewOpen(false);
    } catch { window.alert("The order request could not be saved. Please verify the secure link or access code is still valid, or call sales."); }
    finally { setSaving(false); }
  };
  return <div className="drawer-backdrop"><section className="review-drawer"><div className="drawer-head"><div><p className="eyebrow">Step 2 of 2</p><h2>Review your request</h2><p>Confirm or edit the saved customer information.</p></div><button className="close" onClick={() => setReviewOpen(false)}>×</button></div><div className="review-items">{cartItems.map((p: CustomerProduct) => <div className="review-item" key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.pack}</small></span><div className="qty-control"><button onClick={() => setQty(p.sku, cart[p.sku] - 1)}>−</button><input value={cart[p.sku]} onChange={(e) => setQty(p.sku, Number(e.target.value))}/><button onClick={() => setQty(p.sku, cart[p.sku] + 1)}>＋</button></div></div>)}</div><div className="form-grid"><label>Contact name<input value={customer.contact} onChange={(e) => update("contact", e.target.value)} /></label><label>Business name<input value={customer.business} onChange={(e) => update("business", e.target.value)} /></label><label>Email<input type="email" value={customer.email} onChange={(e) => update("email", e.target.value)} /></label><label>Phone<input type="tel" value={customer.phone} onChange={(e) => update("phone", e.target.value)} /></label><label>Fulfillment<select><option>Delivery</option><option>Pickup</option></select></label><label>Requested date<input type="date" /></label><label className="full">Delivery address<input value={customer.address} onChange={(e) => update("address", e.target.value)} /></label><label className="full">Notes<textarea placeholder="Delivery instructions or special requests" /></label></div><div className="notice"><b>Saved customer profile.</b> Any edits above will update this customer record and remain saved until a sales representative deletes it.</div><button className="button customer-cta wide" disabled={!valid || saving} onClick={submit}>{saving ? "Saving…" : "Submit order request →"}</button></section></div>;
}

function CustomerDocument({ total, products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, customer, setCustomer, setStage, setChangeRequest, go, notify }: { total: number; products: Product[]; cart: Cart; quoteLines: QuoteLine[]; discountPercent: number; shippingAmount: number; taxPercent: number; quoteNotes: string; customer: CustomerRecord | null; setCustomer: (customer: CustomerRecord) => void; setStage: (s: Stage) => void; setChangeRequest: (s: string) => void; go: (v: View) => void; notify: (s: string) => void }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  };
  const openPreview = async () => {
    closePreview();
    setPreviewUrl(await createProformaPdf(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes, false, customer));
  };
  const submitRequest = () => {
    const note = requestText.trim();
    if (!note) return;
    setChangeRequest(note);
    setStage("request");
    setRequestOpen(false);
    notify("Change request sent to sales");
  };
  return <div className="customer-shell centered"><header className="customer-header"><Brand /><div><CustomerRep /><span className="secure">● Secure document</span></div></header><main className="customer-doc"><p className="eyebrow">Action requested</p><h1>Your estimate is ready</h1><p>Review the confirmed quantities, negotiated pricing, discount, shipping, tax, and terms from Desi Kitchen.</p><section className="approval-card"><div><span>EST</span><div><b><button className="proforma-number-link" onClick={openPreview}>Open estimate PDF ↗</button></b><small>Preview the complete estimate before approving</small><small>Prepared for this secure order{discountPercent > 0 ? ` · ${discountPercent}% discount` : ""}</small></div></div><strong>{money(total)}</strong></section>{quoteNotes && <div className="change-summary"><small>Sales note</small><p>{quoteNotes}</p></div>}<div className="approval-actions"><button className="button secondary" onClick={() => setRequestOpen(true)}>Request changes</button><button className="button customer-cta" onClick={() => { closePreview(); setStage("approved"); downloadApprovedProformaPdf(products, cart, quoteLines, discountPercent, shippingAmount, taxPercent, quoteNotes); notify("Approved estimate PDF downloaded"); go("documents"); }}>✓ Approve & download PDF</button></div><p className="fine-print">Approving confirms quantities, pricing, discount, shipping, tax, notes, and terms shown in the estimate. The approved PDF is the final step in this release.</p></main>{previewUrl && <div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title"><section className="pdf-preview-modal"><header><div><p className="eyebrow">Awaiting approval</p><h2 id="pdf-preview-title">Estimate preview</h2></div><button className="close" onClick={closePreview} aria-label="Close PDF preview">×</button></header><iframe title="Customer estimate PDF preview" src={previewUrl} /></section></div>}{requestOpen && <div className="drawer-backdrop signin-backdrop"><section className="signin-card change-request-dialog" role="dialog" aria-modal="true" aria-labelledby="change-request-title"><button className="close" onClick={() => setRequestOpen(false)}>×</button><p className="eyebrow">Before approval</p><h2 id="change-request-title">What should sales change?</h2><p>Describe quantity, product, delivery, pricing, discount, shipping, tax, or terms that need revision. The estimate will remain unapproved.</p><label>Requested changes<textarea autoFocus value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="Describe the product, quantity, delivery, or pricing change you need." /></label><div className="edit-actions"><button className="button secondary" onClick={() => setRequestOpen(false)}>Cancel</button><button className="button customer-cta" disabled={!requestText.trim()} onClick={submitRequest}>Send request to sales →</button></div></section></div>}</div>;
}

function CustomerRep() { return <span className="rep-contact"><img className="company-logo-badge" src="/desi-kitchen-logo.png" alt="Desi Kitchen"/><span><span className="company-name">Desi Kitchen</span> <b>Sales</b></span><a href="tel:+15624707400">(562) 470-7400</a></span>; }

function EditProduct({ product, isNew, onClose, onSave, onDelete }: { product: Product; isNew: boolean; onClose: () => void; onSave: (p: Product) => void | Promise<void>; onDelete: () => void | Promise<void> }) { const [draft, setDraft] = useState(product); const valid = Boolean(draft.sku.trim() && draft.name.trim() && draft.category.trim() && draft.pack.trim() && draft.price >= 0 && draft.stock >= 0); const confirmDelete = () => { if (window.confirm(`Delete ${product.name} (${product.sku})? This cannot be undone.`)) onDelete(); }; return <div className="drawer-backdrop"><section className="edit-panel"><div className="drawer-head"><div><p className="eyebrow">Catalog item</p><h2>{isNew ? "Add product" : "Edit product"}</h2></div><button className="close" onClick={onClose}>×</button></div><div className="form-grid single"><label>SKU<input value={draft.sku} disabled={!isNew} onChange={(e) => setDraft({ ...draft, sku: e.target.value.trim() })} /></label><label>Product name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Category<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label><label>Pack size<input value={draft.pack} onChange={(e) => setDraft({ ...draft, pack: e.target.value })} /></label><label>Sales price<input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value)) })} /></label><label>Available quantity<input type="number" min="0" step="1" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Math.max(0, Math.floor(Number(e.target.value))) })} /></label><label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> Published to customers</label></div><div className="edit-actions">{!isNew && <button className="button danger-outline delete-left" onClick={confirmDelete}>Delete product</button>}<button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid} onClick={() => onSave(draft)}>{isNew ? "Add product" : "Save changes"}</button></div></section></div>; }

function Settings({ notify }: { notify: (s: string) => void }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>Business settings</h1><p>Configure document identity, terms, and notifications.</p></div></div><section className="panel settings"><div className="form-grid"><label>Legal business name<input defaultValue="Desi Kitchen" /></label><label>Sales email<input defaultValue="sales@desikitchen.me" /></label><label>Tax / registration number<input placeholder="Enter registration number" /></label><label>Currency<select><option>USD — US Dollar</option></select></label><label>Estimate prefix<input defaultValue="EST" /></label><label>Invoice prefix<input defaultValue="INV" /></label><label className="full">Default terms<textarea placeholder="Enter payment and fulfillment terms" /></label></div><button className="button primary" onClick={() => notify("Business settings saved")}>Save settings</button></section></div>; }
function Customers({ customers, setCustomers, notify }: { customers: CustomerRecord[]; setCustomers: (records: CustomerRecord[]) => void; notify: (message: string) => void }) {
  const [search, setSearch] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const visible = customers.filter((customer) => `${customer.business} ${customer.contact} ${customer.email}`.toLowerCase().includes(search.toLowerCase()));
  const upload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const rows = String(reader.result).split(/\r?\n/).slice(1).filter(Boolean); const parsed = rows.map((row) => { const [business, contact, email, phone, address] = parseCsvRow(row); return { id: business.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), business, contact, email, phone, address }; }).filter((customer) => customer.business && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)); if (!parsed.length) { notify("No valid customers found. Use: business,contact,email,phone,address"); return; } fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: parsed }) }); setCustomers([...parsed, ...customers.filter((customer) => !parsed.some((next) => next.id === customer.id))]); notify(`${parsed.length} customers imported`); }; reader.readAsText(file); event.target.value = ""; };
  const generateCode = (customer: CustomerRecord) => { const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[value % 32]).join(""); const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); const updated = customers.map((record) => record.id === customer.id ? { ...record, accessCode: code, codeExpiresAt } : record); setCustomers(updated); fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: [updated.find((record) => record.id === customer.id)] }) }); navigator.clipboard?.writeText(code); notify(`24-hour code ${code} generated and copied`); };
  const codeStatus = (customer: CustomerRecord) => customer.codeExpiresAt && new Date(customer.codeExpiresAt).getTime() > Date.now();
  const saveCustomer = (customer: CustomerRecord) => { const exists = customers.some((record) => record.id === customer.id); const updated = exists ? customers.map((record) => record.id === customer.id ? customer : record) : [customer, ...customers]; setCustomers(updated); fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customers: [customer] }) }); setEditingCustomer(null); notify(exists ? "Customer updated" : "Customer added"); };
  const deleteCustomer = (customer: CustomerRecord) => { if (!window.confirm(`Delete ${customer.business}? This also invalidates its access code.`)) return; setCustomers(customers.filter((record) => record.id !== customer.id)); fetch("/api/customers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: customer.id }) }); setEditingCustomer(null); notify("Customer deleted"); };
  const addCustomer = () => setEditingCustomer({ id: crypto.randomUUID(), business: "", contact: "", email: "", phone: "", address: "" });
  return <div className="page"><div className="page-head"><div><p className="eyebrow">Customer directory</p><h1>Customers</h1><p>Add customers individually or upload a list, then issue 24-hour access codes.</p><div className="template-links"><span>Download template:</span><a href="/templates/desi-kitchen-customers.csv" download>Customer data CSV</a></div></div><div className="actions"><label className="button secondary file-button">⇧ Upload customer CSV<input type="file" accept=".csv,text/csv" onChange={upload}/></label><button className="button primary" onClick={addCustomer}>＋ Add customer</button></div></div><section className="panel"><div className="toolbar"><div className="search"><span>⌕</span><input aria-label="Search customers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, contact, or email"/></div><span className="result-count">{visible.length} customers</span></div><div className="table-wrap"><table><thead><tr><th>Business</th><th>Contact</th><th>Email</th><th>Phone</th><th>Access code</th><th>Valid until</th><th>Actions</th></tr></thead><tbody>{visible.map((customer) => <tr key={customer.id}><td><strong>{customer.business}</strong></td><td>{customer.contact}</td><td>{customer.email}</td><td>{customer.phone}</td><td><strong className="access-code">{codeStatus(customer) ? customer.accessCode : "—"}</strong></td><td>{codeStatus(customer) ? new Date(customer.codeExpiresAt!).toLocaleString() : customer.accessCode ? <span className="expired-code">Expired</span> : "Not generated"}</td><td><div className="row-actions"><button className="button secondary code-button" onClick={() => generateCode(customer)}>{codeStatus(customer) ? "Regenerate code" : "Generate code"}</button><button className="row-action" onClick={() => setEditingCustomer(customer)}>Edit</button><button className="row-delete" onClick={() => deleteCustomer(customer)}>Delete</button></div></td></tr>)}</tbody></table></div></section>{editingCustomer && <EditCustomer customer={editingCustomer} isNew={!customers.some((record) => record.id === editingCustomer.id)} onClose={() => setEditingCustomer(null)} onSave={saveCustomer} onDelete={() => deleteCustomer(editingCustomer)} />}</div>;
}
function EditCustomer({ customer, isNew, onClose, onSave, onDelete }: { customer: CustomerRecord; isNew: boolean; onClose: () => void; onSave: (customer: CustomerRecord) => void; onDelete: () => void }) { const [draft, setDraft] = useState(customer); const valid = Boolean(draft.business.trim() && draft.contact.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) && draft.phone.trim() && draft.address.trim()); return <div className="drawer-backdrop"><section className="edit-panel"><div className="drawer-head"><div><p className="eyebrow">Customer record</p><h2>{isNew ? "Add customer" : "Edit customer"}</h2></div><button className="close" onClick={onClose}>×</button></div><div className="form-grid single"><label>Business name<input value={draft.business} onChange={(event) => setDraft({ ...draft, business: event.target.value })}/></label><label>Contact name<input value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })}/></label><label>Email<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></label><label>Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></label><label>Address<textarea value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })}/></label></div><div className="edit-actions">{!isNew && <button className="button danger-outline delete-left" onClick={onDelete}>Delete customer</button>}<button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid} onClick={() => onSave(draft)}>{isNew ? "Add customer" : "Save changes"}</button></div></section></div>; }
function EmptyState({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) { return <div className="page"><div className="page-head"><div><p className="eyebrow">Sales workspace</p><h1>{title}</h1><p>{description}</p></div></div><section className="panel empty"><img className="empty-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen"/><h2>{title}</h2><p>{description}</p><button className="button primary" onClick={onAction}>{action} →</button></section></div>; }
function Brand() { return <button className="brand" onClick={() => location.reload()}><img className="brand-logo" src="/desi-kitchen-logo.png" alt="Desi Kitchen logo"/><span className="company-name">Desi Kitchen</span></button>; }
