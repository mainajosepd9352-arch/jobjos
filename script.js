
const STORAGE_KEY = "myBizData";

let products = [];
let sales = [];

// Load previously saved data.
try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (savedData) {
        const data = JSON.parse(savedData);

        products = Array.isArray(data.products)
            ? data.products
            : [];

        sales = Array.isArray(data.sales)
            ? data.sales
            : [];
    }
} catch (error) {
    alert("Saved data could not be loaded.");
}

// Save products and sales in this browser.
function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                products: products,
                sales: sales
            })
        );

        return true;
    } catch (error) {
        alert(
            "Could not save data. Your browser may be out of storage space. " +
            "Use a smaller image and try again."
        );

        return false;
    }
}

// Calculate and display dashboard figures.
function updateDashboard() {
    const totalSales = sales.reduce(function(sum, sale) {
        return sum + sale.total;
    }, 0);

    const totalProfit = sales.reduce(function(sum, sale) {
        return sum + sale.profit;
    }, 0);

    document.getElementById("totalSales").textContent =
        "KSh " + totalSales.toFixed(2);

    document.getElementById("totalProfit").textContent =
        "KSh " + totalProfit.toFixed(2);

    document.getElementById("productCount").textContent =
        products.length;

    document.getElementById("transactionCount").textContent =
        sales.length;

    document.getElementById("reportSummary").textContent =
        "You have " + products.length +
        " products, completed " + sales.length +
        " transactions, earned KSh " +
        totalSales.toFixed(2) +
        " in sales, and made KSh " +
        totalProfit.toFixed(2) + " in profit.";
}

// Show all products and their stock.
function displayProducts() {
    const table = document.getElementById("productTable");
    table.replaceChildren();

    products.forEach(function(product) {
        const row = document.createElement("tr");

        const imageCell = document.createElement("td");
        const image = document.createElement("img");

        image.src = product.image;
        image.alt = product.name;
        imageCell.appendChild(image);

        const nameCell = document.createElement("td");
        nameCell.textContent = product.name;

        const costCell = document.createElement("td");
        costCell.textContent =
            "KSh " + product.cost.toFixed(2);

        const priceCell = document.createElement("td");
        priceCell.textContent =
            "KSh " + product.price.toFixed(2);

        const quantityCell = document.createElement("td");
        quantityCell.textContent = product.quantity;

        row.append(
            imageCell,
            nameCell,
            costCell,
            priceCell,
            quantityCell
        );

        table.appendChild(row);
    });

    updateProductOptions();
    updateDashboard();
}

// Fill the sales dropdown with available products.
function updateProductOptions() {
    const select = document.getElementById("saleProduct");
    const previousValue = select.value;

    select.replaceChildren();

    const firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = "Select a product";
    select.appendChild(firstOption);

    products.forEach(function(product, index) {
        const option = document.createElement("option");
        option.value = index;
        option.textContent =
            product.name +
            " - KSh " + product.price.toFixed(2) +
            " (Stock: " + product.quantity + ")";

        option.disabled = product.quantity < 1;
        select.appendChild(option);
    });

    if (
        previousValue !== "" &&
        products[Number(previousValue)] &&
        products[Number(previousValue)].quantity > 0
    ) {
        select.value = previousValue;
    }
}

// Show the history of completed sales.
function displaySales() {
    const table = document.getElementById("salesTable");
    table.replaceChildren();

    sales.forEach(function(sale) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = sale.name;

        const quantityCell = document.createElement("td");
        quantityCell.textContent = sale.quantity;

        const totalCell = document.createElement("td");
        totalCell.textContent =
            "KSh " + sale.total.toFixed(2);

        const profitCell = document.createElement("td");
        profitCell.textContent =
            "KSh " + sale.profit.toFixed(2);

        const dateCell = document.createElement("td");
        dateCell.textContent = sale.date;

        row.append(
            nameCell,
            quantityCell,
            totalCell,
            profitCell,
            dateCell
        );

        table.appendChild(row);
    });

    updateDashboard();
}

// Add a new product and its image.
document.getElementById("productForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const name = document.getElementById("productName")
            .value.trim();

        const cost = Number(
            document.getElementById("productCost").value
        );

        const price = Number(
            document.getElementById("productPrice").value
        );

        const quantity = Number(
            document.getElementById("productQuantity").value
        );

        const imageInput =
            document.getElementById("productImage");

        const file = imageInput.files[0];

        if (
            name === "" ||
            !Number.isFinite(cost) ||
            cost < 0 ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isInteger(quantity) ||
            quantity < 0
        ) {
            alert("Please enter valid product details.");
            return;
        }

        if (cost > price) {
            const confirmLoss = confirm(
                "The buying price is higher than the selling price. " +
                "This product would make a loss per sale. Continue?"
            );

            if (!confirmLoss) {
                return;
            }
        }

        if (!file || !file.type.startsWith("image/")) {
            alert("Please choose a valid product image.");
            return;
        }

        const reader = new FileReader();

        reader.onload = function() {
            const product = {
                name: name,
                cost: cost,
                price: price,
                quantity: quantity,
                image: reader.result
            };

            products.push(product);

            if (!saveData()) {
                products.pop();
                return;
            }

            displayProducts();
            document.getElementById("productForm").reset();

            alert("Product added successfully!");
        };

        reader.onerror = function() {
            alert("The image could not be read. Please try another.");
        };

        reader.readAsDataURL(file);
    }
);

// Record a sale, reduce stock, and calculate profit.
document.getElementById("salesForm").addEventListener(
    "submit",
    function(event) {
        event.preventDefault();

        const selectedIndex =
            document.getElementById("saleProduct").value;

        const quantity = Number(
            document.getElementById("saleQuantity").value
        );

        if (selectedIndex === "") {
            alert("Please select a product.");
            return;
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            alert("Enter a whole number of at least 1.");
            return;
        }

        const product = products[Number(selectedIndex)];

        if (!product) {
            alert("Please select a valid product.");
            return;
        }

        if (quantity > product.quantity) {
            alert(
                "Not enough stock! Available quantity: " +
                product.quantity
            );
            return;
        }

        const total = product.price * quantity;
        const profit = (product.price - product.cost) * quantity;

        const sale = {
            name: product.name,
            quantity: quantity,
            total: total,
            profit: profit,
            date: new Date().toLocaleString()
        };

        const oldQuantity = product.quantity;

        product.quantity -= quantity;
        sales.push(sale);

        if (!saveData()) {
            product.quantity = oldQuantity;
            sales.pop();
            return;
        }

        displayProducts();
        displaySales();
        document.getElementById("salesForm").reset();

        alert(
            "Sale recorded!\n" +
            "Revenue: KSh " + total.toFixed(2) + "\n" +
            "Profit: KSh " + profit.toFixed(2)
        );
    }
);

// Display today's date.
document.getElementById("today").textContent =
    "Today: " + new Date().toLocaleDateString();

// Display saved data when the page opens.
displayProducts();
displaySales();
