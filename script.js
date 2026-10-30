"use strict";

/*
 * MYBIZ
 * Local product and sales storage.
 * Public reviews will be connected to Supabase in the next step.
 */

const DATA_KEY = "myBizData";
const OLD_DATA_KEY = "myBizReviews";

let products = [];
let transactions = [];
let reviews = [];

const $ = (id) => document.getElementById(id);

function today() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function money(value) {
    return "KSh " + (Number(value) || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");

        products = Array.isArray(saved.products) ? saved.products : [];
        transactions = Array.isArray(saved.transactions) ? saved.transactions : [];

        /*
         * Migrate the older MyBiz format when it is present.
         * Old sales become transactions so their history remains available.
         */
        if (transactions.length === 0 && Array.isArray(saved.sales)) {
            transactions = saved.sales.map((sale, index) => ({
                id: sale.id || `legacy-${index}-${Date.now()}`,
                type: "sale",
                productId: sale.productId ?? sale.productID ?? null,
                productName: sale.productName || sale.name || "Previous product",
                quantity: Number(sale.quantity) || 0,
                price: Number(sale.price ?? sale.sellingPrice) || 0,
                cost: Number(sale.cost) || 0,
                amount: Number(sale.amount ?? sale.total) ||
                    (Number(sale.quantity) || 0) * (Number(sale.price) || 0),
                profit: Number(sale.profit) ||
                    ((Number(sale.price) || 0) - (Number(sale.cost) || 0)) *
                    (Number(sale.quantity) || 0),
                date: sale.date || sale.day || today(),
                dateTime: sale.dateTime || "",
                returned: Boolean(sale.returned)
            }));
        }

        reviews = [];
    } catch (error) {
        console.error("Unable to load MyBiz data:", error);
        products = [];
        transactions = [];
        reviews = [];
    }
}

function saveData() {
    try {
        localStorage.setItem(DATA_KEY, JSON.stringify({
            products,
            transactions
        }));
        return true;
    } catch (error) {
        alert(
            "MyBiz could not save your changes. Your browser storage may be full. " +
            "Try using smaller product pictures or removing unused pictures."
        );
        console.error("Unable to save MyBiz data:", error);
        return false;
    }
}

function setMessage(elementId, message, isError = false) {
    const element = $(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = "message " + (isError ? "message-error" : "message-success");
}

function formatDate(date) {
    if (!date) return "Unknown date";

    const parts = String(date).slice(0, 10).split("-");
    if (parts.length !== 3) return escapeHTML(date);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/* =========================
   PRODUCTS
   ========================= */

function renderProducts() {
    const table = $("productTable");
    const select = $("saleProduct");

    table.innerHTML = "";

    if (products.length === 0) {
        table.innerHTML = '<tr><td colspan="5">No active products. Add a product above.</td></tr>';
    } else {
        products.forEach((product) => {
            const stock = Number(product.quantity ?? product.stock) || 0;
            const image = product.image || product.imageData || "";

            const imageHTML = image
                ? `<img class="product-image" src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}">`
                : '<span class="product-placeholder" aria-hidden="true">📦</span>';

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>
                    <div class="product-cell">
                        ${imageHTML}
                        <span>${escapeHTML(product.name)}</span>
                    </div>
                </td>
                <td>${money(product.cost)}</td>
                <td>${money(product.price)}</td>
                <td class="${stock <= 5 ? "stock-low" : "stock-normal"}">${stock}</td>
                <td>
                    <div class="action-buttons">
                        <button
                            type="button"
                            class="btn btn-danger btn-small"
                            data-delete-product="${escapeHTML(product.id)}"
                        >Delete</button>
                    </div>
                </td>
            `;
            table.appendChild(row);
        });
    }

    select.innerHTML = '<option value="">Select a product</option>';

    products.forEach((product) => {
        const stock = Number(product.quantity ?? product.stock) || 0;
        if (stock <= 0) return;

        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = `${product.name} — Stock: ${stock}`;
        select.appendChild(option);
    });

    $("productCount").textContent = products.length;
}

function deleteProduct(productId) {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) return;

    const confirmed = window.confirm(
        `Stop selling "${product.name}"?\n\n` +
        "The product will be removed from your active product list. " +
        "Its previous sales and transaction history will be preserved."
    );

    if (!confirmed) return;

    products = products.filter((item) => String(item.id) !== String(productId));

    if (!saveData()) {
        loadData();
        renderAll();
        return;
    }

    renderAll();
}

async function readImage(file) {
    if (!file) return "";

    if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file.");
    }

    if (file.size > 1.5 * 1024 * 1024) {
        throw new Error("Please choose an image smaller than 1.5 MB.");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("The image could not be read."));
        reader.readAsDataURL(file);
    });
}

async function addProduct(event) {
    event.preventDefault();

    const name = $("productName").value.trim();
    const cost = Number($("productCost").value);
    const price = Number($("productPrice").value);
    const quantity = Number($("productQuantity").value);
    const file = $("productImage").files[0];

    if (!name || !Number.isFinite(cost) || !Number.isFinite(price) ||
        !Number.isInteger(quantity) || cost < 0 || price < 0 || quantity < 0) {
        alert("Please enter a product name and valid cost, price, and whole-number stock quantity.");
        return;
    }

    if (price < cost) {
        const proceed = window.confirm(
            "The selling price is lower than the cost. This may cause a loss. Add this product anyway?"
        );
        if (!proceed) return;
    }

    try {
        const image = await readImage(file);

        const product = {
            id: makeId(),
            name,
            cost,
            price,
            quantity,
            image,
            createdAt: new Date().toISOString()
        };

        products.push(product);

        if (!saveData()) {
            products.pop();
            return;
        }

        $("productForm").reset();
        renderAll();
        alert("Product added successfully.");
    } catch (error) {
        alert(error.message || "Unable to add the product.");
    }
}

/* =========================
   SALES AND RETURNS
   ========================= */

function addSale(event) {
    event.preventDefault();

    const productId = $("saleProduct").value;
    const quantity = Number($("saleQuantity").value);

    const product = products.find((item) => String(item.id) === String(productId));

    if (!product) {
        setMessage("saleMessage", "Please select an active product.", true);
        return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
        setMessage("saleMessage", "Enter a valid whole-number quantity.", true);
        return;
    }

    const stock = Number(product.quantity ?? product.stock) || 0;

    if (quantity > stock) {
        setMessage("saleMessage", `Not enough stock. Available: ${stock}.`, true);
        return;
    }

    const price = Number(product.price) || 0;
    const cost = Number(product.cost) || 0;

    const transaction = {
        id: makeId(),
        type: "sale",
        productId: product.id,
        productName: product.name,
        quantity,
        price,
        cost,
        amount: price * quantity,
        profit: (price - cost) * quantity,
        date: today(),
        dateTime: new Date().toLocaleString()
    };

    product.quantity = stock - quantity;
    transactions.push(transaction);

    if (!saveData()) {
        product.quantity = stock;
        transactions.pop();
        return;
    }

    $("salesForm").reset();
    setMessage("saleMessage", "Sale recorded successfully.");
    renderAll();
}

function recordReturn(transactionId) {
    const original = transactions.find((item) => String(item.id) === String(transactionId));

    if (!original || original.type !== "sale" || original.returned) {
        alert("This transaction cannot be returned.");
        return;
    }

    const quantity = Number(original.quantity) || 0;

    const confirmed = window.confirm(
        `Record a full return for "${original.productName}"?\n\n` +
        `Quantity to return: ${quantity}\n` +
        "The returned quantity will be restored to stock, and the return will be recorded today."
    );

    if (!confirmed) return;

    const product = products.find((item) => String(item.id) === String(original.productId));
    const oldQuantity = product ? Number(product.quantity ?? product.stock) || 0 : null;

    original.returned = true;

    if (product) {
        product.quantity = oldQuantity + quantity;
    }

    const returnTransaction = {
        id: makeId(),
        type: "return",
        productId: original.productId,
        productName: original.productName,
        quantity,
        price: Number(original.price) || 0,
        cost: Number(original.cost) || 0,
        amount: (Number(original.price) || 0) * quantity,
        profit: ((Number(original.price) || 0) - (Number(original.cost) || 0)) * quantity,
        date: today(),
        dateTime: new Date().toLocaleString(),
        originalTransactionId: original.id
    };

    transactions.push(returnTransaction);

    if (!saveData()) {
        original.returned = false;
        if (product) product.quantity = oldQuantity;
        transactions.pop();
        return;
    }

    renderAll();
    alert("Return recorded. Stock has been restored.");
}

function renderTransactions() {
    const table = $("salesTable");
    const selectedDate = $("transactionDate").value || today();

    table.innerHTML = "";

    const daily = transactions
        .filter((item) => String(item.date || "").slice(0, 10) === selectedDate)
        .slice()
        .sort((a, b) => String(b.dateTime || b.date).localeCompare(String(a.dateTime || a.date)));

    if (daily.length === 0) {
        table.innerHTML = '<tr><td colspan="6">No transactions for this date.</td></tr>';
        return;
    }

    daily.forEach((transaction) => {
        const isReturn = transaction.type === "return";
        const amount = Number(transaction.amount) || 0;

        const action = !isReturn && !transaction.returned
            ? `<button type="button" class="btn btn-secondary btn-small" data-return-transaction="${escapeHTML(transaction.id)}">Return</button>`
            : (transaction.returned ? "Returned" : "—");

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatDate(transaction.date)}</td>
            <td>${escapeHTML(transaction.productName || "Previous product")}</td>
            <td>${isReturn ? "Return" : "Sale"}</td>
            <td>${isReturn ? "−" : ""}${Number(transaction.quantity) || 0}</td>
            <td>${isReturn ? "− " : ""}${money(amount)}</td>
            <td>${action}</td>
        `;
        table.appendChild(row);
    });
}

/* =========================
   DAILY REPORTS
   ========================= */

function renderReport() {
    const selectedDate = $("reportDate").value || today();

    const daily = transactions.filter(
        (item) => String(item.date || "").slice(0, 10) === selectedDate
    );

    let sales = 0;
    let profit = 0;
    let returns = 0;
    let returnProfit = 0;
    let saleCount = 0;
    let returnCount = 0;

    daily.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        const transactionProfit = Number(transaction.profit) || 0;

        if (transaction.type === "return") {
            returns += amount;
            returnProfit += transactionProfit;
            returnCount++;
        } else {
            sales += amount;
            profit += transactionProfit;
            saleCount++;
        }
    });

    const netSales = sales - returns;
    const netProfit = profit - returnProfit;

    $("reportSummary").innerHTML = `
        <article class="report-card">
            <p>Gross sales</p>
            <h3>${money(sales)}</h3>
        </article>
        <article class="report-card">
            <p>Returns</p>
            <h3>${money(returns)}</h3>
        </article>
        <article class="report-card">
            <p>Net sales</p>
            <h3>${money(netSales)}</h3>
        </article>
        <article class="report-card">
            <p>Net profit</p>
            <h3>${money(netProfit)}</h3>
        </article>
        <article class="report-card">
            <p>Sales transactions</p>
            <h3>${saleCount}</h3>
        </article>
        <article class="report-card">
            <p>Return transactions</p>
            <h3>${returnCount}</h3>
        </article>
    `;
}

function renderDashboard() {
    const selectedDate = $("viewDate").value || today();

    const daily = transactions.filter(
        (item) => String(item.date || "").slice(0, 10) === selectedDate
    );

    let sales = 0;
    let profit = 0;

    daily.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;
        const transactionProfit = Number(transaction.profit) || 0;

        if (transaction.type === "return") {
            sales -= amount;
            profit -= transactionProfit;
        } else {
            sales += amount;
            profit += transactionProfit;
        }
    });

    $("todaySales").textContent = money(sales);
    $("todayProfit").textContent = money(profit);
    $("transactionCount").textContent = daily.length;
    $("currentYear").textContent = new Date().getFullYear();
}

/* =========================
   REVIEWS — ONLINE SETUP PENDING
   ========================= */

/*
 * Reviews are intentionally not stored locally in this version.
 * Supabase will be configured next so reviews can be shared publicly.
 */

function renderReviewsNotConnected() {
    $("reviewList").innerHTML =
        '<p class="empty-state">Public reviews are not connected yet.</p>';
}

function handleReviewSubmit(event) {
    event.preventDefault();

    setMessage(
        "reviewMessage",
        "Public reviews are not connected yet. We will enable them after setting up the online database.",
        true
    );
}

/* =========================
   RENDER AND EVENTS
   ========================= */

function renderAll() {
    renderProducts();
    renderTransactions();
    renderReport();
    renderDashboard();
    renderReviewsNotConnected();
}

function startMyBiz() {
    loadData();

    $("viewDate").value = today();
    $("transactionDate").value = today();
    $("reportDate").value = today();
    $("currentYear").textContent = new Date().getFullYear();

    $("productForm").addEventListener("submit", addProduct);
    $("salesForm").addEventListener("submit", addSale);
    $("reviewForm").addEventListener("submit", handleReviewSubmit);

    $("newSaleBtn").addEventListener("click", () => {
        $("salesForm").reset();
        setMessage("saleMessage", "");
        $("saleProduct").focus();
    });

    $("viewDate").addEventListener("change", renderDashboard);
    $("transactionDate").addEventListener("change", renderTransactions);
    $("reportDate").addEventListener("change", renderReport);

    $("productTable").addEventListener("click", (event) => {
        const button = event.target.closest("[data-delete-product]");
        if (button) deleteProduct(button.dataset.deleteProduct);
    });

    $("salesTable").addEventListener("click", (event) => {
        const button = event.target.closest("[data-return-transaction]");
        if (button) recordReturn(button.dataset.returnTransaction);
    });

    renderAll();
}

document.addEventListener("DOMContentLoaded", startMyBiz);
