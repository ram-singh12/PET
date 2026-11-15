'use strict';

const STORAGE_KEY = 'spendwise_expenses_v1';

const $ = (id) => document.getElementById(id);

const form = $('expenseForm');

let expenses = loadExpenses();
let toastTimer;

// Get the current month in local time.
function getCurrentMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
}

// Load the budget saved for the current month.
let currentBudget = Number(
    localStorage.getItem(
        'spendwise_budget_' + getCurrentMonthKey()
    )
) || 0;


// Load saved expenses.
function loadExpenses() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || '[]'
        );

        return Array.isArray(saved) ? saved : [];

    } catch (error) {
        console.error('Could not read saved expenses:', error);
        return [];
    }
}


// Save expenses in LocalStorage.
function saveExpenses() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(expenses)
    );
}


// Save the monthly budget in LocalStorage.
function saveBudget() {
    localStorage.setItem(
        'spendwise_budget_' + getCurrentMonthKey(),
        String(currentBudget)
    );
}


// Display monthly budget usage and remaining amount.
function renderBudget(monthTotal) {
    const used = monthTotal;
    const remaining = currentBudget - used;

    $('budgetUsed').textContent = money(used);

    if (currentBudget <= 0) {
        $('budgetRemaining').textContent = 'Not set';
        $('budgetProgress').style.width = '0%';
        $('budgetProgress').classList.remove(
            'budget-warning',
            'budget-danger'
            );

        $('budgetMessage').textContent =
            'Set a budget to monitor your monthly spending.';

        return;
    }

    const percentage = (used / currentBudget) * 100;

    $('budgetRemaining').textContent = money(remaining);

    $('budgetProgress').style.width =
        Math.min(percentage, 100) + '%';
    // Change progress bar colour according to budget usage.
    const progressBar = $('budgetProgress');

    progressBar.classList.remove(
    'budget-warning',
    'budget-danger'
    );

    if (percentage >= 100) {
    progressBar.classList.add('budget-danger');
    } else if (percentage >= 80) {
    progressBar.classList.add('budget-warning');
    }

    if (percentage >= 100) {
        $('budgetMessage').textContent =
            'Warning! You have exceeded your monthly budget.';

    } else if (percentage >= 80) {
        $('budgetMessage').textContent =
            'Warning! You have used ' +
            percentage.toFixed(1) +
            '% of your monthly budget.';

    } else {
        $('budgetMessage').textContent =
            percentage.toFixed(1) +
            '% of your monthly budget has been used.';
    }
}


// Format currency.
function money(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(value || 0);
}


// Prevent HTML injection.
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}


// Display notification.
function showToast(message) {
    const toast = $('toast');

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}


// Reset expense form.
function resetForm() {
    form.reset();

    $('expenseId').value = '';
    $('date').value = new Date().toISOString().slice(0, 10);

    $('formTitle').textContent = 'Add an expense';
    $('saveButton').textContent = 'Save expense';

    $('cancelEditButton').classList.add('hidden');
    $('formMessage').textContent = '';
}


// Calculate dashboard summary.
function renderSummary() {
    const total = expenses.reduce(
        (sum, item) => sum + Number(item.amount), 0
    );

    const now = new Date();

    const monthTotal = expenses.filter(item => {
        const date = new Date(`${item.date}T00:00:00`);

        return date.getMonth() === now.getMonth()
            && date.getFullYear() === now.getFullYear();

    }).reduce((sum, item) => sum + Number(item.amount), 0);

    $('totalExpenses').textContent = money(total);
    $('monthExpenses').textContent = money(monthTotal);
    $('transactionCount').textContent = expenses.length;

    $('averageExpense').textContent = money(
        expenses.length ? total / expenses.length : 0
    );

    $('monthLabel').textContent = now.toLocaleDateString(
        'en-IN',
        { month: 'long', year: 'numeric' }
    );

    // Update monthly budget information.
    renderBudget(monthTotal);

    $('budgetInput').value = currentBudget || '';
}


// Category-wise expense summary.
function renderCategories() {
    const totals = {};

    expenses.forEach(item => {
        totals[item.category] =
            (totals[item.category] || 0) + Number(item.amount);
    });

    const sorted = Object.entries(totals)
        .sort((a, b) => b[1] - a[1]);

    const container = $('categoryBreakdown');

    if (!sorted.length) {
        container.innerHTML =
            '<p class="empty-small">Your category summary will appear here.</p>';

        return;
    }

    const max = sorted[0][1] || 1;

    container.innerHTML = sorted.map(([category, amount]) => `
        <div class="category-item">
            <div class="category-meta">
                <span class="category-name">
                    ${escapeHTML(category)}
                </span>

                <span class="category-value">
                    ${money(amount)}
                </span>
            </div>

            <div class="progress-track">
                <div class="progress-fill"
                     style="width:${Math.max(2, amount / max * 100)}%">
                </div>
            </div>
        </div>
    `).join('');
}


// Filter expenses.
function getFilteredExpenses() {
    const query = $('searchInput').value.trim().toLowerCase();
    const category = $('filterCategory').value;
    const month = $('filterDate').value;

    return expenses.filter(item => {

        const matchesQuery =
            !query ||
            `${item.title} ${item.category} ${item.notes || ''}`
                .toLowerCase().includes(query);

        const matchesCategory =
            category === 'All' || item.category === category;

        const matchesMonth =
            !month || item.date.startsWith(month);

        return matchesQuery && matchesCategory && matchesMonth;

    }).sort((a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt - a.createdAt
    );
}


// Display expense table.
function renderTable() {
    const rows = getFilteredExpenses();
    const body = $('expenseTableBody');

    if (!rows.length) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    ${expenses.length
                        ? 'No expenses match your filters.'
                        : 'No expenses yet. Add your first expense to get started.'}
                </td>
            </tr>
        `;

    } else {
        body.innerHTML = rows.map(item => `
            <tr>
                <td>
                    <div class="expense-title">
                        ${escapeHTML(item.title)}
                    </div>

                    ${item.notes
                        ? `<div class="expense-note">
                            ${escapeHTML(item.notes)}
                           </div>`
                        : ''}
                </td>

                <td>
                    <span class="category-pill">
                        ${escapeHTML(item.category)}
                    </span>
                </td>

                <td>
                    ${new Date(`${item.date}T00:00:00`)
                        .toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                        })}
                </td>

                <td class="amount-cell">
                    <span class="amount-text">
                        ${money(Number(item.amount))}
                    </span>
                </td>

                <td class="actions-cell">
                    <button class="action-button"
                        data-action="edit"
                        data-id="${item.id}">
                        Edit
                    </button>

                    <button class="action-button delete-button"
                        data-action="delete"
                        data-id="${item.id}">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    $('resultsCount').textContent =
        `Showing ${rows.length} of ${expenses.length} transactions`;
}


// Render complete application.
function renderAll() {
    renderSummary();
    renderCategories();
    renderTable();
}


// Add or update expense.
form.addEventListener('submit', function(event) {
    event.preventDefault();

    const id = $('expenseId').value;
    const title = $('title').value.trim();
    const amount = Number($('amount').value);
    const category = $('category').value;
    const date = $('date').value;
    const notes = $('notes').value.trim();

    if (!title || !Number.isFinite(amount) ||
        amount <= 0 || !date) {

        $('formMessage').textContent =
            'Please enter a valid name, amount and date.';

        return;
    }

    if (date > new Date().toISOString().slice(0, 10)) {
        $('formMessage').textContent =
            'Please choose today or an earlier date.';

        return;
    }

    if (id) {
        const index = expenses.findIndex(
            item => item.id === id
        );

        if (index !== -1) {
            expenses[index] = {
                ...expenses[index],
                title,
                amount,
                category,
                date,
                notes
            };
        }

        showToast('Expense updated successfully.');

    } else {
        expenses.push({
            id: (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : String(Date.now()),

            title,
            amount,
            category,
            date,
            notes,
            createdAt: Date.now()
        });

        showToast('Expense added successfully.');
    }

    saveExpenses();
    resetForm();
    renderAll();
});


// Edit and delete expense.
$('expenseTableBody').addEventListener('click', function(event) {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    const item = expenses.find(
        expense => expense.id === button.dataset.id
    );

    if (!item) return;

    if (button.dataset.action === 'edit') {

        $('expenseId').value = item.id;
        $('title').value = item.title;
        $('amount').value = item.amount;
        $('category').value = item.category;
        $('date').value = item.date;
        $('notes').value = item.notes || '';

        $('formTitle').textContent = 'Edit expense';
        $('saveButton').textContent = 'Update expense';

        $('cancelEditButton').classList.remove('hidden');

        $('add-expense').scrollIntoView({
            behavior: 'smooth'
        });

        $('title').focus();

    } else if (button.dataset.action === 'delete') {

        if (!confirm(`Delete the expense "${item.title}"?`)) {
            return;
        }

        expenses = expenses.filter(
            expense => expense.id !== item.id
        );

        saveExpenses();

        if ($('expenseId').value === item.id) {
            resetForm();
        }

        renderAll();
        showToast('Expense deleted.');
    }
});


// Cancel editing.
$('cancelEditButton').addEventListener('click', resetForm);


// Scroll to add expense section.
$('topAddButton').addEventListener('click', () => {
    $('add-expense').scrollIntoView({
        behavior: 'smooth'
    });

    $('title').focus({
        preventScroll: true
    });
});


// Search and filters.
['searchInput', 'filterCategory', 'filterDate'].forEach(id => {
    $(id).addEventListener(
        id === 'searchInput' ? 'input' : 'change',
        renderTable
    );
});


// Clear filters.
$('clearFilters').addEventListener('click', () => {
    $('searchInput').value = '';
    $('filterCategory').value = 'All';
    $('filterDate').value = '';

    renderTable();
});


// Export expenses to CSV.
$('exportButton').addEventListener('click', () => {
    const rows = getFilteredExpenses();

    if (!rows.length) {
        showToast('There are no expenses to export.');
        return;
    }

    const quote = value =>
        `"${String(value ?? '').replace(/"/g, '""')}"`;

    const csv = [
        ['Expense', 'Amount (INR)', 'Category', 'Date', 'Notes'],

        ...rows.map(item => [
            item.title,
            item.amount,
            item.category,
            item.date,
            item.notes || ''
        ])

    ].map(row => row.map(quote).join(',')).join('\r\n');

    const blob = new Blob(
        ['\uFEFF' + csv],
        { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = 'spendwise-expenses.csv';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast('CSV file exported.');
});


// Save the monthly budget.
$('saveBudgetButton').addEventListener('click', () => {
    const amount = Number($('budgetInput').value);

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Please enter a valid budget.');
        return;
    }

    currentBudget = amount;

    saveBudget();
    renderAll();

    showToast('Monthly budget saved successfully.');
});


// Initialize application.
$('date').value = new Date().toISOString().slice(0, 10);

renderAll();
// Dark Mode Feature

const themeToggle = document.getElementById('themeToggle');

// Load saved theme preference.
const savedTheme = localStorage.getItem('spendwise_theme');

if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️ Light Mode';
}

// Toggle between light and dark mode.
themeToggle.addEventListener('click', function () {

    document.body.classList.toggle('dark-mode');

    const isDark = document.body.classList.contains('dark-mode');

    if (isDark) {
        localStorage.setItem('spendwise_theme', 'dark');
        themeToggle.textContent = '☀️ Light Mode';
    } else {
        localStorage.setItem('spendwise_theme', 'light');
        themeToggle.textContent = '🌙 Dark Mode';
    }

});
// Clear All Expenses Feature

const clearAllButton = document.getElementById('clearAllButton');

clearAllButton.addEventListener('click', function () {

    if (expenses.length === 0) {
        showToast('There are no expenses to clear.');
        return;
    }

    const confirmed = confirm(
        'Are you sure you want to delete ALL expenses? This action cannot be undone.'
    );

    if (confirmed) {

        expenses = [];

        saveExpenses();

        resetForm();

        renderAll();

        showToast('All expenses have been deleted.');
    }

});