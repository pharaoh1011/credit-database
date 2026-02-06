/* ============================================
   THE CREDIT DATABASE - Main Application Controller
   ============================================ */

const App = {

    // State
    currentPage: 'dashboard',
    currentClientId: null,
    parsedData: null,
    selectedAccounts: new Set(),
    selectedTemplate: 'basic_dispute',
    generatedLetters: null,
    currentBureau: 'experian',
    clientView: 'grid',

    // Initialize the app
    init: function() {
        this.initParticles();
        this.initDropZone();
        this.renderDashboard();
        this.renderTemplateGrid();
        this.renderTemplatesShowcase();
        CRM.populateClientDropdown();
        this.navigate('dashboard');
    },

    // ==========================================
    // NAVIGATION
    // ==========================================
    navigate: function(page, data) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // Remove active from nav links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        // Show target page
        const targetPage = document.getElementById('page-' + page);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Set active nav link
        const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (navLink) navLink.classList.add('active');

        this.currentPage = page;

        // Page-specific initialization
        switch (page) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'clients':
                this.renderClients();
                break;
            case 'client-detail':
                if (data) this.renderClientDetail(data);
                break;
            case 'upload':
                CRM.populateClientDropdown();
                break;
            case 'disputes':
                this.renderDisputesList();
                break;
            case 'templates':
                this.renderTemplatesShowcase();
                break;
        }

        // Close sidebar on mobile
        document.getElementById('sidebar').classList.remove('open');

        // Prevent default link behavior
        return false;
    },

    toggleSidebar: function() {
        document.getElementById('sidebar').classList.toggle('open');
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    renderDashboard: function() {
        const stats = CRM.getStats();
        document.getElementById('statClients').textContent = stats.clients;
        document.getElementById('statDisputes').textContent = stats.disputes;
        document.getElementById('statAccounts').textContent = stats.accounts;
        document.getElementById('statResolved').textContent = stats.letters;

        // Recent clients
        const clients = CRM.getClients().slice(-5).reverse();
        const recentList = document.getElementById('recentClientsList');
        if (clients.length === 0) {
            recentList.innerHTML = '<div class="empty-state-small"><p>No clients yet. Upload a credit report to get started.</p></div>';
        } else {
            recentList.innerHTML = clients.map(c => `
                <div class="activity-item" style="cursor:pointer" onclick="App.navigate('client-detail', '${c.id}')">
                    <div class="client-avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">
                        ${CRM.getInitials(c.fullName)}
                    </div>
                    <div class="activity-text">
                        <strong>${this.escapeHtml(c.fullName)}</strong>
                        <span style="margin-left:8px;font-size:11px;color:var(--text-muted)">${c.reports.length} reports, ${c.letters.length} disputes</span>
                    </div>
                    <span class="activity-time">${CRM.formatRelativeTime(c.updatedAt)}</span>
                </div>
            `).join('');
        }

        // Recent activity
        const activities = CRM.getActivity().slice(0, 10);
        const activityList = document.getElementById('recentActivity');
        if (activities.length === 0) {
            activityList.innerHTML = '<div class="empty-state-small"><p>No recent activity.</p></div>';
        } else {
            activityList.innerHTML = activities.map(a => `
                <div class="activity-item">
                    <div class="activity-dot ${a.type}"></div>
                    <span class="activity-text">${this.escapeHtml(a.message)}</span>
                    <span class="activity-time">${CRM.formatRelativeTime(a.timestamp)}</span>
                </div>
            `).join('');
        }
    },

    // ==========================================
    // UPLOAD & PARSING
    // ==========================================
    initDropZone: function() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        if (!dropZone || !fileInput) return;

        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());

        // Drag events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
    },

    onClientSelectChange: function() {
        const select = document.getElementById('uploadClientSelect');
        const newForm = document.getElementById('newClientForm');
        if (select.value === 'new') {
            newForm.style.display = 'block';
        } else {
            newForm.style.display = 'none';
        }
    },

    handleFileUpload: async function(file) {
        if (file.type !== 'application/pdf') {
            this.showToast('Please upload a PDF file.', 'error');
            return;
        }

        // Check client selection
        const clientSelect = document.getElementById('uploadClientSelect');
        if (!clientSelect.value) {
            this.showToast('Please select or create a client first.', 'error');
            return;
        }

        // If creating new client, validate required fields
        if (clientSelect.value === 'new') {
            const name = document.getElementById('clientName').value.trim();
            const address = document.getElementById('clientAddress').value.trim();
            const city = document.getElementById('clientCity').value.trim();
            const state = document.getElementById('clientState').value.trim();
            const zip = document.getElementById('clientZip').value.trim();

            if (!name) {
                this.showToast('Please enter the client\'s full name.', 'error');
                return;
            }
            if (!address || !city || !state || !zip) {
                this.showToast('Please enter the client\'s full address.', 'error');
                return;
            }
        }

        // Show progress
        const progressEl = document.getElementById('uploadProgress');
        const parsedEl = document.getElementById('parsedResults');
        progressEl.style.display = 'block';
        parsedEl.style.display = 'none';

        this.updateProgress(0, 'Extracting text from PDF...', 1);

        try {
            // Extract text from PDF
            const rawText = await PDFParser.extractText(file, (pct) => {
                this.updateProgress(pct * 0.5, 'Extracting text from PDF...', 1);
            });

            this.updateProgress(50, 'Identifying personal information...', 2);
            await this.sleep(300);

            // Parse the report
            const parsed = PDFParser.parseReport(rawText);
            this.parsedData = parsed;

            this.updateProgress(75, 'Analyzing accounts...', 3);
            await this.sleep(300);

            // Handle client creation/selection
            let clientId = clientSelect.value;
            if (clientId === 'new') {
                const client = CRM.createClient({
                    fullName: document.getElementById('clientName').value.trim(),
                    dob: document.getElementById('clientDob').value,
                    ssn: document.getElementById('clientSsn').value.trim(),
                    phone: document.getElementById('clientPhone').value.trim(),
                    email: document.getElementById('clientEmail').value.trim(),
                    address: document.getElementById('clientAddress').value.trim(),
                    city: document.getElementById('clientCity').value.trim(),
                    state: document.getElementById('clientState').value.trim(),
                    zip: document.getElementById('clientZip').value.trim()
                });
                clientId = client.id;
                this.currentClientId = clientId;

                // Override parsed personal info with manually entered info
                parsed.personalInfo.fullName = client.fullName || parsed.personalInfo.fullName;
                parsed.personalInfo.dob = client.dob || parsed.personalInfo.dob;
                parsed.personalInfo.ssn = client.ssn || parsed.personalInfo.ssn;
                parsed.personalInfo.address = client.address || parsed.personalInfo.address;
                parsed.personalInfo.city = client.city || parsed.personalInfo.city;
                parsed.personalInfo.state = client.state || parsed.personalInfo.state;
                parsed.personalInfo.zip = client.zip || parsed.personalInfo.zip;
            } else {
                this.currentClientId = clientId;
                const existingClient = CRM.getClient(clientId);
                if (existingClient) {
                    // Fill personal info from existing client data
                    parsed.personalInfo.fullName = existingClient.fullName || parsed.personalInfo.fullName;
                    parsed.personalInfo.dob = existingClient.dob || parsed.personalInfo.dob;
                    parsed.personalInfo.ssn = existingClient.ssn || parsed.personalInfo.ssn;
                    parsed.personalInfo.address = existingClient.address || parsed.personalInfo.address;
                    parsed.personalInfo.city = existingClient.city || parsed.personalInfo.city;
                    parsed.personalInfo.state = existingClient.state || parsed.personalInfo.state;
                    parsed.personalInfo.zip = existingClient.zip || parsed.personalInfo.zip;
                }
            }

            // Save report to client
            CRM.addReport(clientId, {
                fileName: file.name,
                accountsFound: parsed.accounts.length,
                parsedData: {
                    personalInfo: parsed.personalInfo,
                    accountCount: parsed.accounts.length
                }
            });

            this.updateProgress(100, 'Analysis complete!', 4);
            await this.sleep(500);

            // Populate the results
            this.populateParsedResults(parsed);

            // Select all accounts by default
            this.selectedAccounts = new Set(parsed.accounts.map((_, i) => i));

            progressEl.style.display = 'none';
            parsedEl.style.display = 'block';

            this.showToast(`Found ${parsed.accounts.length} derogatory account(s).`, 'success');

        } catch (err) {
            console.error('PDF parsing error:', err);
            progressEl.style.display = 'none';
            this.showToast('Error parsing PDF: ' + err.message, 'error');
        }
    },

    updateProgress: function(percent, title, step) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressPercent').textContent = Math.round(percent) + '%';
        document.getElementById('progressTitle').textContent = title;

        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById('step' + i);
            stepEl.classList.remove('active', 'done');
            if (i < step) stepEl.classList.add('done');
            if (i === step) stepEl.classList.add('active');
        }
    },

    populateParsedResults: function(parsed) {
        // Fill personal info fields
        document.getElementById('parsedName').value = parsed.personalInfo.fullName || '';
        document.getElementById('parsedDob').value = parsed.personalInfo.dob || '';
        document.getElementById('parsedSsn').value = parsed.personalInfo.ssn || '';
        document.getElementById('parsedAddress').value = parsed.personalInfo.address || '';
        document.getElementById('parsedCity').value = parsed.personalInfo.city || '';
        document.getElementById('parsedState').value = parsed.personalInfo.state || '';
        document.getElementById('parsedZip').value = parsed.personalInfo.zip || '';

        // Render accounts
        this.renderAccountsList(parsed.accounts);

        // Render template selection
        this.renderTemplateGrid();
    },

    renderAccountsList: function(accounts, filter) {
        const container = document.getElementById('accountsList');
        const summary = document.getElementById('accountsSummary');

        if (!accounts || accounts.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <p>No derogatory accounts were automatically detected. You can manually add accounts or try uploading a different format.</p>
                </div>`;
            summary.innerHTML = '';
            return;
        }

        const filteredAccounts = filter && filter !== 'all'
            ? accounts.filter(a => a.type === filter)
            : accounts;

        container.innerHTML = filteredAccounts.map((acc, idx) => {
            const realIdx = accounts.indexOf(acc);
            const isSelected = this.selectedAccounts.has(realIdx);
            return `
                <div class="account-item ${isSelected ? '' : 'deselected'}" data-index="${realIdx}" data-type="${acc.type}">
                    <div class="account-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="App.toggleAccount(${realIdx})">
                    </div>
                    <div class="account-details">
                        <div class="account-name">${this.escapeHtml(acc.creditorName)}</div>
                        <div class="account-meta">
                            ${acc.accountNumber ? `<span>Acct: ${this.escapeHtml(acc.accountNumber)}</span>` : ''}
                            ${acc.balance ? `<span>Balance: ${this.escapeHtml(acc.balance)}</span>` : ''}
                            ${acc.dateOpened ? `<span>Opened: ${this.escapeHtml(acc.dateOpened)}</span>` : ''}
                            ${acc.statusText ? `<span>Status: ${this.escapeHtml(acc.statusText)}</span>` : ''}
                        </div>
                    </div>
                    <span class="account-type-badge ${acc.type}">${PDFParser.getTypeLabel(acc.type)}</span>
                </div>
            `;
        }).join('');

        const selectedCount = this.selectedAccounts.size;
        summary.innerHTML = `
            <span><span class="selected-count">${selectedCount}</span> of ${accounts.length} accounts selected for dispute</span>
            <span style="color: var(--text-muted); font-size: 12px">Inquiries excluded</span>
        `;
    },

    toggleAccount: function(index) {
        if (this.selectedAccounts.has(index)) {
            this.selectedAccounts.delete(index);
        } else {
            this.selectedAccounts.add(index);
        }
        if (this.parsedData) {
            this.renderAccountsList(this.parsedData.accounts,
                document.querySelector('.filter-btn.active')?.dataset?.filter);
        }
    },

    selectAllAccounts: function() {
        if (this.parsedData) {
            this.selectedAccounts = new Set(this.parsedData.accounts.map((_, i) => i));
            this.renderAccountsList(this.parsedData.accounts,
                document.querySelector('.filter-btn.active')?.dataset?.filter);
        }
    },

    deselectAllAccounts: function() {
        this.selectedAccounts.clear();
        if (this.parsedData) {
            this.renderAccountsList(this.parsedData.accounts,
                document.querySelector('.filter-btn.active')?.dataset?.filter);
        }
    },

    filterAccounts: function(filter) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        if (this.parsedData) {
            this.renderAccountsList(this.parsedData.accounts, filter);
        }
    },

    // ==========================================
    // TEMPLATES
    // ==========================================
    renderTemplateGrid: function() {
        const grid = document.getElementById('templateGrid');
        if (!grid) return;

        const templates = DisputeTemplates.getAllTemplates();
        grid.innerHTML = templates.map(t => `
            <div class="template-card ${this.selectedTemplate === t.id ? 'selected' : ''}"
                 onclick="App.selectTemplate('${t.id}')">
                <h4>${this.escapeHtml(t.name)}</h4>
                <p>${this.escapeHtml(t.description)}</p>
                <span class="template-tag">${this.escapeHtml(t.tag)}</span>
            </div>
        `).join('');
    },

    selectTemplate: function(templateId) {
        this.selectedTemplate = templateId;
        this.renderTemplateGrid();
    },

    renderTemplatesShowcase: function() {
        const container = document.getElementById('templatesShowcase');
        if (!container) return;

        const templates = DisputeTemplates.getAllTemplates();
        container.innerHTML = templates.map(t => {
            // Generate a preview snippet with dummy data
            const previewText = t.generate({
                personalInfo: { fullName: '[Client Name]', address: '[Address]', city: '[City]', state: '[ST]', zip: '[ZIP]', ssn: '1234', dob: '01/01/1990' },
                bureau: 'experian',
                accounts: [{ creditorName: '[Creditor Name]', accountNumber: 'XXXX1234', type: 'collection', statusText: 'Collection', balance: '$500', dateOpened: '01/2020' }],
                date: 'January 1, 2025'
            });

            return `
                <div class="showcase-card">
                    <h3>${this.escapeHtml(t.name)}</h3>
                    <p>${this.escapeHtml(t.description)}</p>
                    <span class="badge ${t.tag === 'Most Popular' ? 'badge-info' : t.tag === 'Aggressive' ? 'badge-danger' : 'badge-warning'}">${this.escapeHtml(t.tag)}</span>
                    <div class="preview-snippet" style="margin-top: 12px">
                        ${this.escapeHtml(previewText.substring(0, 300))}...
                    </div>
                </div>
            `;
        }).join('');
    },

    // ==========================================
    // LETTER GENERATION
    // ==========================================
    generateLetters: function() {
        if (!this.parsedData) {
            this.showToast('No credit report data. Please upload a report first.', 'error');
            return;
        }

        if (this.selectedAccounts.size === 0) {
            this.showToast('Please select at least one account to dispute.', 'error');
            return;
        }

        // Gather current personal info from the form
        const personalInfo = {
            fullName: document.getElementById('parsedName').value.trim(),
            address: document.getElementById('parsedAddress').value.trim(),
            city: document.getElementById('parsedCity').value.trim(),
            state: document.getElementById('parsedState').value.trim(),
            zip: document.getElementById('parsedZip').value.trim(),
            ssn: document.getElementById('parsedSsn').value.trim(),
            dob: document.getElementById('parsedDob').value.trim()
        };

        if (!personalInfo.fullName) {
            this.showToast('Please enter the client\'s name.', 'error');
            return;
        }

        // Get selected accounts
        const selectedAccts = this.parsedData.accounts.filter((_, i) => this.selectedAccounts.has(i));

        try {
            this.generatedLetters = LetterGenerator.generateAll(personalInfo, selectedAccts, this.selectedTemplate);
            this.currentBureau = 'experian';

            // Show letter preview page
            this.navigate('letter-preview');
            this.renderLetterPreview();

            // Update client info if needed
            if (this.currentClientId) {
                CRM.updateClient(this.currentClientId, {
                    fullName: personalInfo.fullName,
                    address: personalInfo.address,
                    city: personalInfo.city,
                    state: personalInfo.state,
                    zip: personalInfo.zip,
                    ssn: personalInfo.ssn,
                    dob: personalInfo.dob
                });
            }

            const templateObj = DisputeTemplates.getTemplate(this.selectedTemplate);
            CRM.logActivity('letter', `Generated ${templateObj.name} for ${personalInfo.fullName} (${selectedAccts.length} accounts)`);

            this.showToast('Dispute letters generated successfully!', 'success');
        } catch (err) {
            console.error('Letter generation error:', err);
            this.showToast('Error generating letters: ' + err.message, 'error');
        }
    },

    renderLetterPreview: function() {
        if (!this.generatedLetters) return;

        const preview = document.getElementById('letterPreview');
        preview.innerHTML = LetterGenerator.renderLetterHTML(this.generatedLetters[this.currentBureau]);

        // Update tabs
        document.querySelectorAll('.letter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.bureau === this.currentBureau);
        });
    },

    switchLetterTab: function(bureau) {
        this.currentBureau = bureau;
        this.renderLetterPreview();
    },

    downloadLetter: function(which) {
        if (!this.generatedLetters) return;

        const personalInfo = {
            fullName: document.getElementById('parsedName')?.value || ''
        };

        const bureau = which === 'current' ? this.currentBureau : which;
        LetterGenerator.downloadPDF(this.generatedLetters[bureau], bureau, personalInfo);
        this.showToast(`Downloading ${LetterGenerator.capitalizeBureau(bureau)} letter...`, 'info');
    },

    downloadAllLetters: function() {
        if (!this.generatedLetters) return;

        const personalInfo = {
            fullName: document.getElementById('parsedName')?.value || ''
        };

        LetterGenerator.downloadAllPDFs(this.generatedLetters, personalInfo);
        this.showToast('Downloading all 3 dispute letters...', 'info');
    },

    saveToClient: function() {
        if (!this.generatedLetters || !this.currentClientId) {
            this.showToast('No client selected or no letters generated.', 'error');
            return;
        }

        const templateObj = DisputeTemplates.getTemplate(this.selectedTemplate);
        const selectedAccts = this.parsedData.accounts.filter((_, i) => this.selectedAccounts.has(i));

        CRM.addLetters(this.currentClientId, {
            templateName: templateObj.name,
            accountCount: selectedAccts.length,
            experian: this.generatedLetters.experian,
            equifax: this.generatedLetters.equifax,
            transunion: this.generatedLetters.transunion
        });

        this.showToast('Letters saved to client file.', 'success');
    },

    // ==========================================
    // CLIENTS / CRM
    // ==========================================
    renderClients: function(clientsList) {
        const clients = clientsList || CRM.getClients();
        const grid = document.getElementById('clientsGrid');
        const emptyEl = document.getElementById('clientsEmpty');

        if (clients.length === 0) {
            grid.innerHTML = '';
            grid.appendChild(emptyEl);
            emptyEl.style.display = '';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        grid.className = `clients-grid ${this.clientView === 'list' ? 'list-view' : ''}`;

        grid.innerHTML = clients.map(c => `
            <div class="client-card" onclick="App.navigate('client-detail', '${c.id}')">
                <div class="client-card-header">
                    <div class="client-avatar">${CRM.getInitials(c.fullName)}</div>
                    <div>
                        <div class="client-card-name">${this.escapeHtml(c.fullName)}</div>
                        <div class="client-card-email">${this.escapeHtml(c.email || c.phone || 'No contact info')}</div>
                    </div>
                </div>
                <div class="client-card-stats">
                    <div class="client-stat">
                        <span class="client-stat-value">${c.reports.length}</span>
                        <span class="client-stat-label">Reports</span>
                    </div>
                    <div class="client-stat">
                        <span class="client-stat-value">${c.letters.length}</span>
                        <span class="client-stat-label">Disputes</span>
                    </div>
                    <div class="client-stat">
                        <span class="client-stat-value">${CRM.formatRelativeTime(c.updatedAt)}</span>
                        <span class="client-stat-label">Last Updated</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    setClientView: function(view) {
        this.clientView = view;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        this.renderClients();
    },

    showAddClientModal: function() {
        document.getElementById('modalTitle').textContent = 'Add New Client';
        document.getElementById('modalBody').innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="modalClientName" placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="modalClientDob">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>SSN (Last 4)</label>
                    <input type="text" id="modalClientSsn" maxlength="4" placeholder="1234">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="modalClientPhone" placeholder="(555) 123-4567">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="modalClientEmail" placeholder="john@example.com">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2">
                    <label>Street Address</label>
                    <input type="text" id="modalClientAddress" placeholder="123 Main St">
                </div>
                <div class="form-group">
                    <label>City</label>
                    <input type="text" id="modalClientCity" placeholder="Atlanta">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>State</label>
                    <input type="text" id="modalClientState" maxlength="2" placeholder="GA">
                </div>
                <div class="form-group">
                    <label>Zip</label>
                    <input type="text" id="modalClientZip" maxlength="10" placeholder="30301">
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-outline-light" onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.saveNewClient()">Add Client</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('active');
    },

    saveNewClient: function() {
        const name = document.getElementById('modalClientName').value.trim();
        if (!name) {
            this.showToast('Please enter the client\'s name.', 'error');
            return;
        }

        CRM.createClient({
            fullName: name,
            dob: document.getElementById('modalClientDob').value,
            ssn: document.getElementById('modalClientSsn').value.trim(),
            phone: document.getElementById('modalClientPhone').value.trim(),
            email: document.getElementById('modalClientEmail').value.trim(),
            address: document.getElementById('modalClientAddress').value.trim(),
            city: document.getElementById('modalClientCity').value.trim(),
            state: document.getElementById('modalClientState').value.trim(),
            zip: document.getElementById('modalClientZip').value.trim()
        });

        this.closeModal();
        this.renderClients();
        this.showToast(`Client "${name}" added successfully.`, 'success');
    },

    renderClientDetail: function(clientId) {
        const client = CRM.getClient(clientId);
        if (!client) {
            this.navigate('clients');
            return;
        }

        this.currentClientId = clientId;
        document.getElementById('clientDetailName').textContent = client.fullName;

        // Client info
        const infoEl = document.getElementById('clientDetailInfo');
        infoEl.innerHTML = `
            <div class="info-row"><span class="info-label">Name</span><span class="info-value">${this.escapeHtml(client.fullName)}</span></div>
            <div class="info-row"><span class="info-label">Email</span><span class="info-value">${this.escapeHtml(client.email || '-')}</span></div>
            <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${this.escapeHtml(client.phone || '-')}</span></div>
            <div class="info-row"><span class="info-label">Date of Birth</span><span class="info-value">${this.escapeHtml(client.dob || '-')}</span></div>
            <div class="info-row"><span class="info-label">SSN (Last 4)</span><span class="info-value">${client.ssn ? 'XXX-XX-' + this.escapeHtml(client.ssn) : '-'}</span></div>
            <div class="info-row"><span class="info-label">Address</span><span class="info-value">${this.escapeHtml(client.address || '-')}${client.city ? ', ' + this.escapeHtml(client.city) : ''}${client.state ? ', ' + this.escapeHtml(client.state) : ''} ${this.escapeHtml(client.zip || '')}</span></div>
            <div class="info-row"><span class="info-label">Added</span><span class="info-value">${CRM.formatDate(client.createdAt)}</span></div>
        `;

        // Reports
        const filesEl = document.getElementById('clientDetailFiles');
        if (client.reports.length === 0) {
            filesEl.innerHTML = '<div class="empty-state-small"><p>No credit reports uploaded yet.</p></div>';
        } else {
            filesEl.innerHTML = client.reports.map(r => `
                <div class="file-item">
                    <div class="file-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <div>
                            <div class="file-name">${this.escapeHtml(r.fileName)}</div>
                            <div class="file-date">${CRM.formatDate(r.uploadedAt)} - ${r.accountsFound} derogatory accounts found</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Letters
        const lettersEl = document.getElementById('clientDetailLetters');
        if (client.letters.length === 0) {
            lettersEl.innerHTML = '<div class="empty-state-small"><p>No dispute letters generated yet.</p></div>';
        } else {
            lettersEl.innerHTML = client.letters.map(lg => `
                <div class="letter-item">
                    <div class="letter-info">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <div>
                            <div class="letter-name">${this.escapeHtml(lg.templateName)} (${lg.accountCount} accounts)</div>
                            <div class="letter-date">${CRM.formatDate(lg.createdAt)} - Experian, Equifax, TransUnion</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-sm" onclick="App.viewSavedLetter('${client.id}', '${lg.id}', 'experian')">EXP</button>
                        <button class="btn-sm" onclick="App.viewSavedLetter('${client.id}', '${lg.id}', 'equifax')">EQF</button>
                        <button class="btn-sm" onclick="App.viewSavedLetter('${client.id}', '${lg.id}', 'transunion')">TU</button>
                        <button class="btn-sm btn-outline" onclick="App.downloadSavedLetters('${client.id}', '${lg.id}')">Download All</button>
                    </div>
                </div>
            `).join('');
        }
    },

    viewSavedLetter: function(clientId, letterGroupId, bureau) {
        const client = CRM.getClient(clientId);
        if (!client) return;

        const lg = client.letters.find(l => l.id === letterGroupId);
        if (!lg) return;

        this.generatedLetters = lg.letters;
        this.currentBureau = bureau;
        this.navigate('letter-preview');
        this.renderLetterPreview();
    },

    downloadSavedLetters: function(clientId, letterGroupId) {
        const client = CRM.getClient(clientId);
        if (!client) return;

        const lg = client.letters.find(l => l.id === letterGroupId);
        if (!lg) return;

        LetterGenerator.downloadAllPDFs(lg.letters, { fullName: client.fullName });
        this.showToast('Downloading all 3 letters...', 'info');
    },

    editClient: function() {
        const client = CRM.getClient(this.currentClientId);
        if (!client) return;

        document.getElementById('modalTitle').textContent = 'Edit Client';
        document.getElementById('modalBody').innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="editClientName" value="${this.escapeAttr(client.fullName)}">
                </div>
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="editClientDob" value="${this.escapeAttr(client.dob)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>SSN (Last 4)</label>
                    <input type="text" id="editClientSsn" maxlength="4" value="${this.escapeAttr(client.ssn)}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="editClientPhone" value="${this.escapeAttr(client.phone)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="editClientEmail" value="${this.escapeAttr(client.email)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2">
                    <label>Street Address</label>
                    <input type="text" id="editClientAddress" value="${this.escapeAttr(client.address)}">
                </div>
                <div class="form-group">
                    <label>City</label>
                    <input type="text" id="editClientCity" value="${this.escapeAttr(client.city)}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>State</label>
                    <input type="text" id="editClientState" maxlength="2" value="${this.escapeAttr(client.state)}">
                </div>
                <div class="form-group">
                    <label>Zip</label>
                    <input type="text" id="editClientZip" maxlength="10" value="${this.escapeAttr(client.zip)}">
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-outline-light" style="color: var(--accent-red); border-color: var(--accent-red);" onclick="App.confirmDeleteClient('${client.id}')">Delete Client</button>
                <div style="flex:1"></div>
                <button class="btn-outline-light" onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.saveEditClient()">Save Changes</button>
            </div>
        `;
        document.getElementById('modalOverlay').classList.add('active');
    },

    saveEditClient: function() {
        const name = document.getElementById('editClientName').value.trim();
        if (!name) {
            this.showToast('Name is required.', 'error');
            return;
        }

        CRM.updateClient(this.currentClientId, {
            fullName: name,
            dob: document.getElementById('editClientDob').value,
            ssn: document.getElementById('editClientSsn').value.trim(),
            phone: document.getElementById('editClientPhone').value.trim(),
            email: document.getElementById('editClientEmail').value.trim(),
            address: document.getElementById('editClientAddress').value.trim(),
            city: document.getElementById('editClientCity').value.trim(),
            state: document.getElementById('editClientState').value.trim(),
            zip: document.getElementById('editClientZip').value.trim()
        });

        this.closeModal();
        this.renderClientDetail(this.currentClientId);
        this.showToast('Client updated.', 'success');
    },

    confirmDeleteClient: function(clientId) {
        if (confirm('Are you sure you want to delete this client? This will also remove all their reports and dispute letters.')) {
            CRM.deleteClient(clientId);
            this.closeModal();
            this.navigate('clients');
            this.showToast('Client deleted.', 'info');
        }
    },

    uploadForClient: function() {
        // Navigate to upload page with client pre-selected
        this.navigate('upload');
        setTimeout(() => {
            const select = document.getElementById('uploadClientSelect');
            if (select && this.currentClientId) {
                select.value = this.currentClientId;
            }
        }, 100);
    },

    // ==========================================
    // DISPUTES LIST
    // ==========================================
    renderDisputesList: function() {
        const clients = CRM.getClients();
        const container = document.getElementById('disputesList');
        let hasLetters = false;
        let html = '';

        clients.forEach(client => {
            if (client.letters.length > 0) {
                hasLetters = true;
                html += `
                    <div class="dispute-group">
                        <div class="dispute-group-header">
                            <h3>${this.escapeHtml(client.fullName)}</h3>
                            <button class="btn-sm" onclick="App.navigate('client-detail', '${client.id}')">View Client</button>
                        </div>
                        <div class="dispute-group-body">
                            ${client.letters.map(lg => `
                                <div class="letter-item">
                                    <div class="letter-info">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                        </svg>
                                        <div>
                                            <div class="letter-name">${this.escapeHtml(lg.templateName)} - ${lg.accountCount} accounts</div>
                                            <div class="letter-date">${CRM.formatDate(lg.createdAt)}</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-sm" onclick="App.viewSavedLetter('${client.id}', '${lg.id}', 'experian')">View</button>
                                        <button class="btn-sm btn-outline" onclick="App.downloadSavedLetters('${client.id}', '${lg.id}')">Download</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });

        if (!hasLetters) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
                        <rect x="16" y="8" width="48" height="64" rx="4" stroke="#3a3a5c" stroke-width="2"/>
                        <line x1="26" y1="24" x2="54" y2="24" stroke="#3a3a5c" stroke-width="2"/>
                        <line x1="26" y1="34" x2="54" y2="34" stroke="#3a3a5c" stroke-width="2"/>
                        <line x1="26" y1="44" x2="44" y2="44" stroke="#3a3a5c" stroke-width="2"/>
                    </svg>
                    <h3>No Dispute Letters Yet</h3>
                    <p>Upload a credit report and generate dispute letters to see them here.</p>
                    <button class="btn-primary" onclick="App.navigate('upload')">Upload Credit Report</button>
                </div>`;
        } else {
            container.innerHTML = html;
        }
    },

    // ==========================================
    // SEARCH
    // ==========================================
    handleSearch: function(query) {
        if (!query.trim()) return;
        // Search across clients and navigate to clients page with results
        const results = CRM.searchClients(query);
        this.navigate('clients');
        this.renderClients(results);
        document.getElementById('clientSearch').value = query;
    },

    // ==========================================
    // MODAL
    // ==========================================
    closeModal: function() {
        document.getElementById('modalOverlay').classList.remove('active');
    },

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    showToast: function(message, type) {
        type = type || 'info';
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ==========================================
    // VISUAL EFFECTS
    // ==========================================
    initParticles: function() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDuration = (5 + Math.random() * 10) + 's';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.width = (1 + Math.random() * 2) + 'px';
            particle.style.height = particle.style.width;

            // Random color between cyan and purple
            if (Math.random() > 0.5) {
                particle.style.background = '#00d4ff';
            } else {
                particle.style.background = '#8b5cf6';
            }

            container.appendChild(particle);
        }
    },

    // ==========================================
    // UTILITIES
    // ==========================================
    escapeHtml: function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeAttr: function(str) {
        if (!str) return '';
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    sleep: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
