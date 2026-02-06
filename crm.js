/* ============================================
   THE CREDIT DATABASE - CRM Client Management
   ============================================ */

const CRM = {

    STORAGE_KEY: 'creditdb_clients',
    ACTIVITY_KEY: 'creditdb_activity',

    // Get all clients from storage
    getClients: function() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading clients:', e);
            return [];
        }
    },

    // Save clients to storage
    saveClients: function(clients) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        } catch (e) {
            console.error('Error saving clients:', e);
        }
    },

    // Create a new client
    createClient: function(clientData) {
        const clients = this.getClients();
        const client = {
            id: this.generateId(),
            fullName: clientData.fullName || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            dob: clientData.dob || '',
            ssn: clientData.ssn || '',
            address: clientData.address || '',
            city: clientData.city || '',
            state: clientData.state || '',
            zip: clientData.zip || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reports: [],
            letters: [],
            notes: ''
        };
        clients.push(client);
        this.saveClients(clients);
        this.logActivity('client', `Added new client: ${client.fullName}`);
        return client;
    },

    // Update an existing client
    updateClient: function(clientId, updates) {
        const clients = this.getClients();
        const index = clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
            clients[index] = { ...clients[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveClients(clients);
            return clients[index];
        }
        return null;
    },

    // Delete a client
    deleteClient: function(clientId) {
        let clients = this.getClients();
        const client = clients.find(c => c.id === clientId);
        clients = clients.filter(c => c.id !== clientId);
        this.saveClients(clients);
        if (client) {
            this.logActivity('client', `Removed client: ${client.fullName}`);
        }
    },

    // Get a single client by ID
    getClient: function(clientId) {
        const clients = this.getClients();
        return clients.find(c => c.id === clientId) || null;
    },

    // Add a report to a client
    addReport: function(clientId, reportData) {
        const clients = this.getClients();
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const report = {
                id: this.generateId(),
                fileName: reportData.fileName || 'credit_report.pdf',
                uploadedAt: new Date().toISOString(),
                accountsFound: reportData.accountsFound || 0,
                parsedData: reportData.parsedData || null
            };
            client.reports.push(report);
            client.updatedAt = new Date().toISOString();
            this.saveClients(clients);
            this.logActivity('upload', `Uploaded credit report for ${client.fullName}`);
            return report;
        }
        return null;
    },

    // Add generated letters to a client
    addLetters: function(clientId, lettersData) {
        const clients = this.getClients();
        const client = clients.find(c => c.id === clientId);
        if (client) {
            const letterGroup = {
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                templateName: lettersData.templateName || 'Basic Dispute',
                accountCount: lettersData.accountCount || 0,
                letters: {
                    experian: lettersData.experian || '',
                    equifax: lettersData.equifax || '',
                    transunion: lettersData.transunion || ''
                }
            };
            client.letters.push(letterGroup);
            client.updatedAt = new Date().toISOString();
            this.saveClients(clients);
            this.logActivity('letter', `Generated dispute letters for ${client.fullName}`);
            return letterGroup;
        }
        return null;
    },

    // Search clients by name or email
    searchClients: function(query) {
        const clients = this.getClients();
        const q = query.toLowerCase().trim();
        if (!q) return clients;
        return clients.filter(c =>
            c.fullName.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
    },

    // Filter clients by name
    filterClients: function(query) {
        const filtered = this.searchClients(query);
        App.renderClients(filtered);
    },

    // Get activity log
    getActivity: function() {
        try {
            const data = localStorage.getItem(this.ACTIVITY_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    // Log an activity event
    logActivity: function(type, message) {
        try {
            const activities = this.getActivity();
            activities.unshift({
                type: type,
                message: message,
                timestamp: new Date().toISOString()
            });
            // Keep only last 50 activities
            if (activities.length > 50) activities.length = 50;
            localStorage.setItem(this.ACTIVITY_KEY, JSON.stringify(activities));
        } catch (e) {
            console.error('Error logging activity:', e);
        }
    },

    // Get stats for dashboard
    getStats: function() {
        const clients = this.getClients();
        let totalDisputes = 0;
        let totalAccounts = 0;
        let totalLetters = 0;

        clients.forEach(c => {
            totalDisputes += c.letters.length;
            c.letters.forEach(lg => {
                totalAccounts += lg.accountCount;
                totalLetters += 3; // 3 bureaus per letter group
            });
        });

        return {
            clients: clients.length,
            disputes: totalDisputes,
            accounts: totalAccounts,
            letters: totalLetters
        };
    },

    // Generate unique ID
    generateId: function() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Format date for display
    formatDate: function(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    // Format relative time
    formatRelativeTime: function(isoString) {
        const now = new Date();
        const then = new Date(isoString);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return CRM.formatDate(isoString);
    },

    // Populate the client dropdown on upload page
    populateClientDropdown: function() {
        const select = document.getElementById('uploadClientSelect');
        if (!select) return;

        // Clear existing options (keep first two)
        while (select.options.length > 2) {
            select.remove(2);
        }

        const clients = this.getClients();
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.fullName;
            select.appendChild(option);
        });
    },

    // Get initials for avatar
    getInitials: function(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }
};
