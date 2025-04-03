class DebtCalculator {
    constructor() {
        this.debts = this.loadDebts();
        this.results = this.loadResults();
        this.extraPayment = this.loadExtraPayment();
    }

    // Data management
    loadDebts() {
        const saved = localStorage.getItem('debtCalculator_debts');
        return saved ? JSON.parse(saved) : [];
    }

    loadResults() {
        const saved = localStorage.getItem('debtCalculator_results');
        return saved ? JSON.parse(saved) : null;
    }

    loadExtraPayment() {
        const saved = localStorage.getItem('debtCalculator_extraPayment');
        return saved ? parseFloat(saved) : 0;
    }

    saveData() {
        localStorage.setItem('debtCalculator_debts', JSON.stringify(this.debts));
        localStorage.setItem('debtCalculator_extraPayment', this.extraPayment.toString());
        if (this.results) {
            localStorage.setItem('debtCalculator_results', JSON.stringify(this.results));
        }
    }

    // Debt operations
    addDebt(name, balance, interestRate, minPayment) {
        this.debts.push({
            name,
            balance: parseFloat(balance),
            interestRate: parseFloat(interestRate),
            minPayment: parseFloat(minPayment)
        });
        this.saveData();
    }

    removeDebt(index) {
        if (index >= 0 && index < this.debts.length) {
            this.debts.splice(index, 1);
            this.saveData();
        }
    }

    clearAllDebts() {
        this.debts = [];
        this.results = null;
        this.saveData();
    }

    // Calculations
    calculatePayoff(strategy, startDate, currentMonthlyPayment, extraSnowball = 0) {
        const debts = JSON.parse(JSON.stringify(this.debts));
        this.extraPayment = parseFloat(extraSnowball); // Store the extra payment
        
        // Sort based on strategy
        strategy === 'snowball' 
            ? debts.sort((a, b) => a.balance - b.balance)
            : debts.sort((a, b) => b.interestRate - a.interestRate);

        let totalMonths = 0;
        let totalInterest = 0;
        const paymentPlan = [];
        const currentDate = new Date(startDate);
        const totalMinPayment = debts.reduce((sum, debt) => sum + debt.minPayment, 0);
        const paymentRatio = totalMinPayment > 0 ? currentMonthlyPayment / totalMinPayment : 1;

        while (debts.some(debt => debt.balance > 0)) {
            totalMonths++;
            let remainingExtra = parseFloat(extraSnowball) || 0;
            const monthResult = { 
                month: totalMonths,
                date: new Date(currentDate),
                totalPayment: 0,
                totalInterest: 0,
                debts: [],
                currentMonthlyPayment: parseFloat(currentMonthlyPayment),
                extraSnowball: parseFloat(extraSnowball)
            };

            for (let debt of debts) {
                if (debt.balance <= 0) continue;

                const monthlyRate = debt.interestRate / 100 / 12;
                const interest = debt.balance * monthlyRate;
                totalInterest += interest;
                monthResult.totalInterest += interest;

                const adjustedMinPayment = debt.minPayment * paymentRatio;
                let payment = adjustedMinPayment;
                
                if (remainingExtra > 0) {
                    payment += remainingExtra;
                    remainingExtra = 0;
                }

                payment = Math.min(payment, debt.balance + interest);
                monthResult.totalPayment += payment;
                debt.balance = debt.balance + interest - payment;

                monthResult.debts.push({
                    name: debt.name,
                    payment,
                    adjustedMinPayment,
                    extraPayment: payment - adjustedMinPayment,
                    interest,
                    newBalance: Math.max(0, debt.balance),
                    originalMinPayment: debt.minPayment
                });

                if (debt.balance <= 0) {
                    remainingExtra += adjustedMinPayment;
                }
            }

            paymentPlan.push(monthResult);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        this.results = {
            months: totalMonths,
            totalInterest,
            currentMonthlyPayment: parseFloat(currentMonthlyPayment),
            extraSnowball: parseFloat(extraSnowball),
            totalMonthlyPayment: parseFloat(currentMonthlyPayment) + parseFloat(extraSnowball),
            paymentPlan,
            calculationDate: new Date().toISOString(),
            strategy,
            startDate,
            extraPayment: this.extraPayment,
        };

        this.saveData();
        return this.results;
    }

    // Data export/import
    exportToJSON() {
        return JSON.stringify({
            debts: this.debts,
            results: this.results,
            extraPayment: this.extraPayment,
            version: '1.1',
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    importFromJSON(json) {
        try {
            const data = JSON.parse(json);
            if (data.debts) {
                this.debts = data.debts;
                this.results = data.results || null;
                this.extraPayment = data.extraPayment || 0;
                this.saveData();
                return true;
            }
            return false;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', function() {
    const calculator = new DebtCalculator();
    const dom = {
        debtForm: document.getElementById('debt-form'),
        debtsList: document.getElementById('debts-list'),
        resultsDiv: document.getElementById('results'),
        planResult: document.getElementById('plan-result'),
        calculateBtn: document.getElementById('calculate'),
        strategySelect: document.getElementById('strategy'),
        startDate: document.getElementById('start-date'),
        currentMonthly: document.getElementById('current-monthly'),
        extraSnowball: document.getElementById('extra-snowball'),
        clearAllBtn: document.getElementById('clear-all'),
        exportBtn: document.getElementById('export-data'),
        importInput: document.getElementById('import-data'),
        fullScheduleBtn: document.getElementById('show-full-schedule')
    };

    // Initialize
    dom.startDate.valueAsDate = new Date();
    dom.extraSnowball.value = calculator.extraPayment;
    updateUI();

    // Event listeners
    dom.debtForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addDebt();
    });

    dom.calculateBtn.addEventListener('click', calculatePayoff);
    dom.clearAllBtn.addEventListener('click', clearAllDebts);
    dom.exportBtn.addEventListener('click', exportData);
    dom.importInput.addEventListener('change', importData);
    dom.debtsList.addEventListener('click', handleDebtListClick);

    // Functions
    function addDebt() {
        const name = document.getElementById('debt-name').value.trim();
        const balance = parseFloat(document.getElementById('debt-balance').value);
        const rate = parseFloat(document.getElementById('debt-rate').value);
        const payment = parseFloat(document.getElementById('debt-payment').value);
    
        // Validate all fields
        if (!name || isNaN(balance) || isNaN(rate) || isNaN(payment) || 
            balance <= 0 || rate < 0 || payment <= 0) {
            alert('Please fill all fields with valid values:\n\n' +
                  '- Debt name cannot be empty\n' +
                  '- Balance must be greater than 0\n' +
                  '- Interest rate cannot be negative\n' +
                  '- Minimum payment must be greater than 0');
            return;
        }
    
        calculator.addDebt(name, balance, rate, payment);
        updateUI();
        
        // Clear and reset form
        document.getElementById('debt-form').reset();
        document.getElementById('debt-name').focus();
    }

    function calculatePayoff() {
        if (calculator.debts.length === 0) {
            alert('Please add at least one debt');
            return;
        }

        const currentMonthly = calculator.debts.reduce((sum, debt) => sum + debt.minPayment, 0);
        dom.currentMonthly.value = currentMonthly.toFixed(2);

        const results = calculator.calculatePayoff(
            dom.strategySelect.value,
            dom.startDate.value,
            dom.currentMonthly.value || currentMonthly,
            dom.extraSnowball.value || 0
        );

        showResults(results);
    }

    function clearAllDebts() {
        if (confirm('Are you sure you want to clear all debts?')) {
            calculator.clearAllDebts();
            updateUI();
            dom.resultsDiv.classList.add('d-none');
        }
    }

    function exportData() {
        const data = calculator.exportToJSON();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debt-plan-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            if (calculator.importFromJSON(event.target.result)) {
                updateUI();
                if (calculator.results) {
                    showResults(calculator.results);
                }
                alert('Data imported successfully!');
            } else {
                alert('Invalid file format');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function handleDebtListClick(e) {
        if (e.target.classList.contains('delete-debt')) {
            const index = parseInt(e.target.dataset.index);
            calculator.removeDebt(index);
            updateUI();
        }
    }

    function updateUI() {
        updateDebtsList();
        updateCurrentMonthly();
    }

    function updateDebtsList() {
        dom.debtsList.innerHTML = '';
        
        if (calculator.debts.length === 0) {
            dom.debtsList.innerHTML = `
                <li class="list-group-item text-muted">
                    No debts added yet
                </li>`;
            return;
        }

        calculator.debts.forEach((debt, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item debt-card';
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${debt.name}</strong>
                        <div class="text-muted small">${debt.interestRate}% APR</div>
                    </div>
                    <div class="text-end">
                        <div>$${debt.balance.toFixed(2)}</div>
                        <div class="text-muted small">Min: $${debt.minPayment.toFixed(2)}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger ms-3 delete-debt" 
                            data-index="${index}" title="Remove debt">
                        &times;
                    </button>
                </div>`;
            dom.debtsList.appendChild(li);
        });
    }

    function updateCurrentMonthly() {
        const total = calculator.debts.reduce((sum, debt) => sum + debt.minPayment, 0);
        dom.currentMonthly.value = total.toFixed(2);
    }

    function showResults(results) {
        dom.resultsDiv.classList.remove('d-none');
        
        const formatMoney = amount => {
            return new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'USD' 
            }).format(amount);
        };
    
        const formatDate = date => {
            return new Date(date).toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric' 
            });
        };
    
        // Store original results for resetting
        const originalResults = JSON.parse(JSON.stringify(results));
    
        // Generate payment rows with editable extra payments
        const generatePaymentRows = (paymentPlan) => {
            return paymentPlan.map((month, monthIndex) => {
                const debtCells = calculator.debts.map(debt => {
                    const debtData = month.debts.find(d => d.name === debt.name);
                    if (!debtData) return '<td class="text-end">-</td>';
                    
                    return `
                        <td class="text-end">
                            ${debtData.newBalance > 0 ? 
                                formatMoney(debtData.newBalance) : 
                                '<span class="badge bg-success">Paid</span>'}
                            <div class="text-muted small">
                                ${formatMoney(debtData.payment)} paid
                            </div>
                        </td>`;
                }).join('');
    
                return `
                    <tr data-month="${monthIndex}">
                        <td>${formatDate(month.date)}</td>
                        <td class="text-end">
                            ${formatMoney(month.totalPayment)}
                            <div class="input-group input-group-sm mt-1">
                                <span class="input-group-text">+$</span>
                                <input type="number" 
                                       class="form-control extra-payment-input" 
                                       data-month="${monthIndex}"
                                       min="0" 
                                       step="1"
                                       value="${month.extraPaymentAdded || 0}"
                                       style="width: 80px;">
                            </div>
                        </td>
                        <td class="text-end">${formatMoney(month.totalPayment - month.totalInterest)}</td>
                        <td class="text-end">${formatMoney(month.totalInterest)}</td>
                        ${debtCells}
                    </tr>`;
            }).join('');
        };
    
        // Update summary cards
        const updateSummary = (paymentPlan) => {
            const totalMonths = paymentPlan.length;
            const totalInterest = paymentPlan.reduce((sum, month) => sum + month.totalInterest, 0);
            const totalPaid = paymentPlan.reduce((sum, month) => sum + month.totalPayment, 0);
            const extraPaid = paymentPlan.reduce((sum, month) => sum + (month.extraPaymentAdded || 0), 0);
    
            document.getElementById('summary-months').textContent = totalMonths;
            document.getElementById('summary-interest').textContent = formatMoney(totalInterest);
            document.getElementById('summary-total').textContent = formatMoney(totalPaid);
            document.getElementById('summary-extra').textContent = formatMoney(extraPaid);
        };
    
        // Initial render
        dom.planResult.innerHTML = `
            <div class="row g-3 mb-4" id="summary-cards">
                <div class="col-md-4">
                    <div class="card h-100 border-primary">
                        <div class="card-body text-center">
                            <h3 class="h6 text-muted">Months to Payoff</h3>
                            <div class="display-6 text-primary" id="summary-months">
                                ${results.months}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-danger">
                        <div class="card-body text-center">
                            <h3 class="h6 text-muted">Total Interest</h3>
                            <div class="display-6 text-danger" id="summary-interest">
                                ${formatMoney(results.totalInterest)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-success">
                        <div class="card-body text-center">
                            <h3 class="h6 text-muted">Total Paid</h3>
                            <div class="display-6 text-success" id="summary-total">
                                ${formatMoney(results.totalMonthlyPayment * results.months)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-warning">
                        <div class="card-body text-center">
                            <h3 class="h6 text-muted">Extra Payments</h3>
                            <div class="display-6 text-warning" id="summary-extra">
                                ${formatMoney(0)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-info">
                        <div class="card-body text-center">
                            <h3 class="h6 text-muted">Savings</h3>
                            <div class="display-6 text-info" id="summary-savings">
                                0 mo, $0
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    
            <h4 class="h5 mb-3">Detailed Payment Schedule</h4>
            <div class="table-responsive mb-4" style="max-height: 500px; overflow-y: auto;">
                <table class="table table-sm table-striped">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th>Month</th>
                            <th class="text-end">Total Paid</th>
                            <th class="text-end">Principal</th>
                            <th class="text-end">Interest</th>
                            ${calculator.debts.map(debt => 
                                `<th class="text-end">${debt.name}</th>`
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody id="payment-schedule-body">
                        ${generatePaymentRows(results.paymentPlan)}
                    </tbody>
                </table>
            </div>
    
            <div class="d-grid gap-2 mb-4">
                <button id="apply-extra-payments" class="btn btn-warning">
                    Apply Extra Payments
                </button>
                <button id="reset-payments" class="btn btn-outline-secondary">
                    Reset to Original Plan
                </button>
            </div>
        `;
    
        // Apply extra payments logic
        document.getElementById('apply-extra-payments').addEventListener('click', function() {
            const inputs = document.querySelectorAll('.extra-payment-input');
            const updatedPlan = JSON.parse(JSON.stringify(originalResults.paymentPlan));
            let totalExtra = 0;
            
            inputs.forEach(input => {
                const extra = parseFloat(input.value) || 0;
                const monthIndex = parseInt(input.dataset.month);
                
                if (extra > 0) {
                    updatedPlan[monthIndex].totalPayment += extra;
                    updatedPlan[monthIndex].extraPaymentAdded = extra;
                    totalExtra += extra;
                    
                    // Apply to debts according to strategy
                    const strategy = originalResults.strategy;
                    let remainingExtra = extra;
                    
                    // Sort debts based on strategy
                    const debts = [...calculator.debts];
                    strategy === 'snowball' 
                        ? debts.sort((a, b) => a.balance - b.balance)
                        : debts.sort((a, b) => b.interestRate - a.interestRate);
                    
                    // Apply extra to debts
                    for (const debt of debts) {
                        if (remainingExtra <= 0) break;
                        
                        const debtInMonth = updatedPlan[monthIndex].debts.find(d => d.name === debt.name);
                        if (debtInMonth && debtInMonth.newBalance > 0) {
                            const appliedExtra = Math.min(remainingExtra, debtInMonth.newBalance);
                            debtInMonth.payment += appliedExtra;
                            debtInMonth.newBalance -= appliedExtra;
                            remainingExtra -= appliedExtra;
                        }
                    }
                }
            });

            // Function to re-render the payment schedule table
            function renderPaymentSchedule(paymentPlan, debts, strategy) {
                const tableBody = document.getElementById('payment-schedule-body');
                if (!tableBody) {
                    console.error('Payment schedule table body not found!');
                    return;
                }
                
                tableBody.innerHTML = ''; // Clear existing rows
            
                paymentPlan.forEach((month, monthIndex) => {
                    const row = document.createElement('tr');
                    
                    // Highlight months with extra payments
                    if (month.extraPaymentAdded) {
                        row.classList.add('table-warning');
                    }
            
                    // Generate cells for each debt
                    const debtCells = debts.map(debt => {
                        const debtData = month.debts.find(d => d.name === debt.name);
                        if (!debtData) return '<td class="text-end">-</td>';
                        
                        return `
                            <td class="text-end">
                                ${debtData.newBalance > 0 ? 
                                    formatMoney(debtData.newBalance) : 
                                    '<span class="badge bg-success">Paid</span>'}
                                <div class="text-muted small">
                                    ${formatMoney(debtData.payment)}
                                    ${debtData.extraPaymentApplied ? 
                                        `<span class="text-success">(+${formatMoney(debtData.extraPaymentApplied)})</span>` : ''}
                                </div>
                            </td>`;
                    }).join('');
            
                    // Add the row to the table
                    row.innerHTML = `
                        <td>${formatDate(month.date)}</td>
                        <td class="text-end">
                            ${formatMoney(month.totalPayment)}
                            ${month.extraPaymentAdded ? 
                                `<div class="text-success small">+${formatMoney(month.extraPaymentAdded)}</div>` : ''}
                        </td>
                        <td class="text-end">${formatMoney(month.totalPayment - month.totalInterest)}</td>
                        <td class="text-end">${formatMoney(month.totalInterest)}</td>
                        ${debtCells}
                    `;
            
                    tableBody.appendChild(row);
                });
            }

            // Updated apply extra payments logic
            if (totalExtra > 0) {
                const updatedPlan = JSON.parse(JSON.stringify(results.paymentPlan));
                let totalInterestSaved = 0;
                let totalPrincipalAdded = 0;
                let newPayoffMonth = updatedPlan.length;

                // 1. Apply extra payments to each month
                inputs.forEach(input => {
                    const extraAmount = parseFloat(input.value) || 0;
                    const monthIndex = parseInt(input.dataset.month);
                    
                    if (extraAmount > 0 && monthIndex < updatedPlan.length) {
                        const month = updatedPlan[monthIndex];
                        month.extraPaymentAdded = extraAmount;
                        month.totalPayment += extraAmount;
                        totalPrincipalAdded += extraAmount;

                        // Apply to debts according to strategy
                        let remainingExtra = extraAmount;
                        const debts = [...calculator.debts];
                        
                        if (results.strategy === 'snowball') {
                            debts.sort((a, b) => a.balance - b.balance);
                        } else {
                            debts.sort((a, b) => b.interestRate - a.interestRate);
                        }

                        for (const debt of debts) {
                            if (remainingExtra <= 0) break;
                            
                            const debtInMonth = month.debts.find(d => d.name === debt.name);
                            if (debtInMonth && debtInMonth.newBalance > 0) {
                                const appliedExtra = Math.min(remainingExtra, debtInMonth.newBalance);
                                debtInMonth.payment += appliedExtra;
                                debtInMonth.newBalance -= appliedExtra;
                                debtInMonth.extraPaymentApplied = appliedExtra;
                                remainingExtra -= appliedExtra;
                            }
                        }
                    }
                });

                // 2. Recalculate the entire plan
                let runningBalances = calculator.debts.map(d => ({...d}));
                let allPaidOff = false;

                for (let i = 0; i < updatedPlan.length; i++) {
                    if (allPaidOff) break;
                    
                    const month = updatedPlan[i];
                    allPaidOff = true; // Assume paid off until proven otherwise

                    // Calculate payments and new balances
                    month.debts.forEach(debtPayment => {
                        const debt = runningBalances.find(d => d.name === debtPayment.name);
                        if (debt && debt.balance > 0) {
                            allPaidOff = false;
                            const monthlyRate = debt.interestRate / 100 / 12;
                            debtPayment.interest = debt.balance * monthlyRate;
                            debtPayment.newBalance = Math.max(0, debt.balance + debtPayment.interest - debtPayment.payment);
                            
                            // Track interest savings for months with extra payments
                            if (month.extraPaymentAdded) {
                                const originalMonth = results.paymentPlan[i];
                                const originalDebt = originalMonth.debts.find(d => d.name === debtPayment.name);
                                if (originalDebt) {
                                    totalInterestSaved += (originalDebt.interest - debtPayment.interest);
                                }
                            }
                            
                            debt.balance = debtPayment.newBalance;
                        } else {
                            debtPayment.interest = 0;
                            debtPayment.newBalance = 0;
                        }
                    });

                    // Update payoff month if this is the first month all debts are paid
                    if (allPaidOff) {
                        newPayoffMonth = i + 1;
                    }
                }

                // 3. Update the UI
                // Update summary cards
                document.getElementById('summary-months').textContent = newPayoffMonth;
                document.getElementById('summary-interest').textContent = formatMoney(
                    updatedPlan.slice(0, newPayoffMonth).reduce((sum, m) => sum + m.totalInterest, 0)
                );
                document.getElementById('summary-total').textContent = formatMoney(
                    updatedPlan.slice(0, newPayoffMonth).reduce((sum, m) => sum + m.totalPayment, 0)
                );
                document.getElementById('summary-extra').textContent = formatMoney(totalPrincipalAdded);
                document.getElementById('summary-savings').textContent = 
                    `${results.months - newPayoffMonth} mo, ${formatMoney(totalInterestSaved)}`;

                // Re-render the payment schedule table
                updateSummary(updatedPlan);

                renderPaymentSchedule(
                    updatedPlan.slice(0, newPayoffMonth),
                    calculator.debts,
                    results.strategy
                );

                // 4. Show impact summary
                const impactModal = new bootstrap.Modal(document.getElementById('paymentImpactModal'));

                document.getElementById('impact-total-extra').textContent = formatMoney(totalExtra);
                document.getElementById('impact-new-months').textContent = `${newPayoffMonth} months`;
                document.getElementById('impact-months-saved').textContent = 
                    `${results.months - newPayoffMonth} months`;
                document.getElementById('impact-interest-saved').textContent = 
                    formatMoney(totalInterestSaved);
                document.getElementById('impact-total-savings').textContent = 
                    formatMoney(totalPrincipalAdded + totalInterestSaved);

                impactModal.show();
            } else {
                // For no payments case, we can use a toast instead
                const toast = new bootstrap.Toast(document.getElementById('errorToast'));
                document.getElementById('toast-message').textContent = 'No extra payments entered';
                toast.show();
            }
        });
    
        // Reset to original plan
        document.getElementById('reset-payments').addEventListener('click', function() {
            document.getElementById('payment-schedule-body').innerHTML = generatePaymentRows(originalResults.paymentPlan);
            updateSummary(originalResults.paymentPlan);
            document.querySelectorAll('.extra-payment-input').forEach(input => {
                input.value = 0;
                input.closest('tr').classList.remove('table-warning');
            });
        });
        // Show and set up full schedule button
        dom.fullScheduleBtn.classList.remove('d-none');
        dom.fullScheduleBtn.textContent = `Show Full Payment Schedule (${results.months} months)`;
        
        // Remove any existing listener first
        dom.fullScheduleBtn.replaceWith(dom.fullScheduleBtn.cloneNode(true));
        const newBtn = document.getElementById('show-full-schedule');
        
        newBtn.addEventListener('click', function() {
            dom.planResult.innerHTML += `
                <div class="table-responsive mt-3">
                    <table class="table table-sm table-striped">
                        <thead class="table-light">
                            <tr>
                                <th>Month</th>
                                <th class="text-end">Total</th>
                                <th class="text-end">Principal</th>
                                <th class="text-end">Interest</th>
                                <th class="text-end">Debts Left</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.paymentPlan.map(month => `
                                <tr>
                                    <td>${formatDate(month.date)}</td>
                                    <td class="text-end">${formatMoney(month.totalPayment)}</td>
                                    <td class="text-end">${formatMoney(month.totalPayment - month.totalInterest)}</td>
                                    <td class="text-end">${formatMoney(month.totalInterest)}</td>
                                    <td class="text-end">
                                        ${month.debts.filter(d => d.newBalance > 0).length}/${calculator.debts.length}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            newBtn.classList.add('d-none');
        });
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}