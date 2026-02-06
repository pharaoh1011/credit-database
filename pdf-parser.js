/* ============================================
   THE CREDIT DATABASE - Credit Report PDF Parser
   ============================================ */

const PDFParser = {

    // Set PDF.js worker
    init: function() {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    },

    // Extract all text from a PDF file
    extractText: async function(file, progressCallback) {
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;
                let fullText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';

                    if (progressCallback) {
                        progressCallback(Math.round((i / totalPages) * 100));
                    }
                }

                resolve(fullText);
            } catch (err) {
                reject(err);
            }
        });
    },

    // Main parse function - extracts personal info and derogatory accounts
    parseReport: function(rawText) {
        const result = {
            personalInfo: this.extractPersonalInfo(rawText),
            accounts: this.extractDerogatoryAccounts(rawText),
            rawText: rawText
        };
        return result;
    },

    // Extract personal information from the report text
    extractPersonalInfo: function(text) {
        const info = {
            fullName: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            ssn: '',
            dob: ''
        };

        // Try to find name - typically at the top of report
        // Pattern: looks for name after common headers
        const namePatterns = [
            /(?:Personal\s+Information|Consumer\s+Information|Report\s+for|Name|Consumer)[:\s]*([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})/i,
            /(?:Name|Consumer)[:\s]+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})/i,
            /^([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})\s*$/m,
            /Credit\s+Report\s+(?:for\s+)?([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,3})/i
        ];

        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                // Filter out common false positives
                if (!this.isCommonHeader(name)) {
                    info.fullName = this.formatName(name);
                    break;
                }
            }
        }

        // Extract SSN (last 4)
        const ssnPatterns = [
            /(?:SSN|Social\s*Security|SS#|Social)[:\s#]*(?:XXX-XX-|xxx-xx-|\*{3}-\*{2}-)(\d{4})/i,
            /(?:SSN|Social\s*Security)[:\s#]*\d{3}-?\d{2}-?(\d{4})/i,
            /(?:SSN|SS#)[:\s]*(?:\*+[- ]?)(\d{4})/i
        ];

        for (const pattern of ssnPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                info.ssn = match[1];
                break;
            }
        }

        // Extract Date of Birth
        const dobPatterns = [
            /(?:Date\s+of\s+Birth|DOB|Birth\s*Date|Born)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
            /(?:Date\s+of\s+Birth|DOB|Birth\s*Date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
        ];

        for (const pattern of dobPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                info.dob = match[1].trim();
                break;
            }
        }

        // Extract Address
        const addressPatterns = [
            /(?:Address|Current\s+Address|Residence)[:\s]*(\d+[^,\n]{5,60})[,\s]+([A-Za-z\s]{2,30})[,\s]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i,
            /(\d+\s+[A-Za-z0-9\s.#-]{5,50})\s+([A-Za-z\s]{2,25}),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/
        ];

        for (const pattern of addressPatterns) {
            const match = text.match(pattern);
            if (match) {
                info.address = match[1].trim();
                info.city = match[2].trim();
                info.state = match[3].trim();
                info.zip = match[4].trim();
                break;
            }
        }

        return info;
    },

    // Extract derogatory accounts from the report
    extractDerogatoryAccounts: function(text) {
        const accounts = [];
        const textUpper = text.toUpperCase();

        // Check if we're past the inquiries section - we want to exclude inquiries
        const inquirySectionStart = this.findInquirySection(text);

        // Derogatory status keywords
        const derogatoryKeywords = [
            'COLLECTION', 'CHARGE OFF', 'CHARGED OFF', 'CHARGE-OFF',
            'PAST DUE', 'LATE', 'DELINQUENT', 'DEROGATORY',
            'REPOSSESSION', 'FORECLOSURE', 'BANKRUPTCY', 'JUDGMENT',
            'TAX LIEN', 'SETTLED', 'WRITTEN OFF', 'PROFIT AND LOSS',
            'INCLUDED IN BANKRUPTCY', 'VOLUNTARY SURRENDER',
            'INVOLUNTARY REPOSSESSION', 'ACCOUNT CHARGED OFF',
            'SERIOUSLY PAST DUE', 'PLACED FOR COLLECTION',
            '30 DAYS LATE', '60 DAYS LATE', '90 DAYS LATE',
            '120 DAYS LATE', '150 DAYS LATE', '180 DAYS LATE',
            'PAYS AS AGREED WAS PAST DUE', 'ACCOUNT PAID IN FULL WAS A CHARGE-OFF',
            'UNPAID', 'BAD DEBT', 'TRANSFERRED TO RECOVERY',
            'CLAIM FILED WITH GOVERNMENT', 'PAID CHARGE OFF',
            'ACCOUNT IN DISPUTE', 'CLOSED'
        ];

        // Patterns to find account blocks
        // Generic pattern: creditor name followed by account details
        const accountBlockPatterns = [
            // Pattern for structured reports with clear account sections
            /(?:Account\s*(?:Name|#)?|Creditor|Company\s*Name|Subscriber)[:\s]*([^\n]{3,60})\s*(?:Account\s*(?:Number|#|No))[:\s]*([^\n]{3,30})/gi,
            // Pattern for collection accounts
            /(?:Collection|Collections)[:\s]*([^\n]{3,60})\s*(?:Account|Acct|#)[:\s]*([^\n]{3,30})/gi
        ];

        // Strategy 1: Look for structured account blocks
        const structuredAccounts = this.parseStructuredAccounts(text, inquirySectionStart);
        if (structuredAccounts.length > 0) {
            return this.deduplicateAccounts(structuredAccounts);
        }

        // Strategy 2: Look for account name + status pairs with derogatory indicators
        const lines = text.split(/\n/);
        let currentAccount = null;
        let accountText = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineUpper = line.toUpperCase();

            // Skip if we're in the inquiries section
            if (inquirySectionStart > 0 && this.getLinePosition(text, i) > inquirySectionStart) {
                break;
            }

            // Skip inquiry-related lines
            if (this.isInquiryLine(lineUpper)) continue;

            // Look for potential account/creditor names
            const creditorMatch = line.match(/^([A-Z][A-Za-z0-9\s&.'\/,-]{2,50})(?:\s{2,}|\t)/);

            if (creditorMatch) {
                // Save previous account if derogatory
                if (currentAccount && currentAccount.isDerogatory) {
                    accounts.push(currentAccount);
                }

                currentAccount = {
                    creditorName: creditorMatch[1].trim(),
                    accountNumber: '',
                    type: 'negative',
                    statusText: '',
                    balance: '',
                    dateOpened: '',
                    isDerogatory: false
                };
                accountText = '';
            }

            // Accumulate text for current context
            accountText += ' ' + lineUpper;

            // Check if current line/context contains derogatory indicators
            if (currentAccount) {
                for (const keyword of derogatoryKeywords) {
                    if (lineUpper.includes(keyword) || accountText.includes(keyword)) {
                        currentAccount.isDerogatory = true;
                        currentAccount.type = this.classifyAccountType(keyword);
                        currentAccount.statusText = this.extractStatus(accountText);
                        break;
                    }
                }

                // Try to extract account number
                const acctMatch = line.match(/(?:Account|Acct|#)[:\s#]*([A-Za-z0-9*X-]{4,20})/i);
                if (acctMatch) {
                    currentAccount.accountNumber = acctMatch[1].trim();
                }

                // Try to extract balance
                const balMatch = line.match(/(?:Balance|Amount|Bal)[:\s]*\$?([\d,]+\.?\d{0,2})/i);
                if (balMatch) {
                    currentAccount.balance = '$' + balMatch[1];
                }

                // Try to extract date
                const dateMatch = line.match(/(?:Opened|Date\s*Opened|Open\s*Date)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
                if (dateMatch) {
                    currentAccount.dateOpened = dateMatch[1];
                }
            }
        }

        // Don't forget the last account
        if (currentAccount && currentAccount.isDerogatory) {
            accounts.push(currentAccount);
        }

        // Strategy 3: If we found nothing, do a broader search for derogatory keywords near potential creditor names
        if (accounts.length === 0) {
            return this.broadSearch(text, derogatoryKeywords, inquirySectionStart);
        }

        return this.deduplicateAccounts(accounts);
    },

    // Parse structured account format (common in formatted reports)
    parseStructuredAccounts: function(text, inquiryStart) {
        const accounts = [];

        // Common structured patterns
        const patterns = [
            // "CREDITOR NAME    Account#: XXXX    Status: Collection"
            {
                regex: /([A-Z][A-Z0-9\s&.'\/,-]{2,40})\s+(?:Account|Acct)\s*#?\s*:?\s*([A-Za-z0-9*X-]{3,20})\s+(?:Status|Condition|Rating)\s*:?\s*([^\n]{3,40})/gi,
                nameIdx: 1, acctIdx: 2, statusIdx: 3
            },
            // Tabular format with columns
            {
                regex: /([A-Z][A-Z0-9\s&.',-]{2,35})\s{2,}([A-Za-z0-9*X-]{4,20})\s{2,}.*?(Collection|Charge\s*Off|Late|Past\s*Due|Delinquent|Derogatory|Repossession|Foreclosure|Bankruptcy)/gi,
                nameIdx: 1, acctIdx: 2, statusIdx: 3
            }
        ];

        for (const p of patterns) {
            let match;
            while ((match = p.regex.exec(text)) !== null) {
                // Skip if in inquiries section
                if (inquiryStart > 0 && match.index > inquiryStart) continue;

                const statusText = match[p.statusIdx].trim();
                if (this.isDerogStatus(statusText)) {
                    accounts.push({
                        creditorName: match[p.nameIdx].trim(),
                        accountNumber: match[p.acctIdx].trim(),
                        type: this.classifyAccountType(statusText.toUpperCase()),
                        statusText: statusText,
                        balance: this.extractNearbyBalance(text, match.index),
                        dateOpened: this.extractNearbyDate(text, match.index),
                        isDerogatory: true
                    });
                }
            }
        }

        return accounts;
    },

    // Broad search - last resort for finding derogatory items
    broadSearch: function(text, keywords, inquiryStart) {
        const accounts = [];
        const workingText = inquiryStart > 0 ? text.substring(0, inquiryStart) : text;

        // Split into chunks and look for keyword matches
        const chunks = workingText.split(/\n{2,}/);

        for (const chunk of chunks) {
            const chunkUpper = chunk.toUpperCase();

            // Skip if it looks like an inquiry
            if (this.isInquiryLine(chunkUpper)) continue;

            let foundKeyword = null;
            for (const kw of keywords) {
                if (chunkUpper.includes(kw)) {
                    foundKeyword = kw;
                    break;
                }
            }

            if (foundKeyword) {
                // Try to extract a creditor name from this chunk
                const creditorName = this.extractCreditorFromChunk(chunk);
                if (creditorName) {
                    // Extract account number
                    const acctMatch = chunk.match(/(?:Account|Acct|#)\s*:?\s*#?\s*([A-Za-z0-9*X-]{4,20})/i);
                    const balMatch = chunk.match(/(?:Balance|Amount|Bal)\s*:?\s*\$?([\d,]+\.?\d{0,2})/i);
                    const dateMatch = chunk.match(/(?:Opened|Date\s*Opened)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);

                    accounts.push({
                        creditorName: creditorName,
                        accountNumber: acctMatch ? acctMatch[1].trim() : '',
                        type: this.classifyAccountType(foundKeyword),
                        statusText: this.extractStatusFromChunk(chunk, foundKeyword),
                        balance: balMatch ? '$' + balMatch[1] : '',
                        dateOpened: dateMatch ? dateMatch[1] : '',
                        isDerogatory: true
                    });
                }
            }
        }

        return this.deduplicateAccounts(accounts);
    },

    // Find where the inquiries section begins
    findInquirySection: function(text) {
        const patterns = [
            /\bINQUIR(?:Y|IES)\b/i,
            /\bCREDIT\s+INQUIR/i,
            /\bREGULAR\s+INQUIR/i,
            /\bHARD\s+INQUIR/i,
            /\bSOFT\s+INQUIR/i,
            /\bPROMOTIONAL\s+INQUIR/i,
            /\bACCOUNT\s+REVIEW\s+INQUIR/i,
            /\bREQUESTS\s+VIEWED\s+BY\s+OTHERS/i
        ];

        let earliest = -1;
        for (const p of patterns) {
            const match = text.search(p);
            if (match !== -1 && (earliest === -1 || match < earliest)) {
                earliest = match;
            }
        }

        return earliest;
    },

    // Check if a line is inquiry-related
    isInquiryLine: function(lineUpper) {
        const inquiryTerms = ['INQUIRY', 'INQUIRIES', 'PROMOTIONAL', 'ACCOUNT REVIEW',
            'REQUESTS VIEWED', 'SOFT PULL', 'HARD PULL'];
        return inquiryTerms.some(term => lineUpper.includes(term));
    },

    // Check if status text indicates derogatory
    isDerogStatus: function(status) {
        const statusUpper = status.toUpperCase();
        const derogTerms = ['COLLECTION', 'CHARGE OFF', 'CHARGED OFF', 'CHARGE-OFF',
            'PAST DUE', 'LATE', 'DELINQUENT', 'DEROGATORY', 'REPOSSESSION',
            'FORECLOSURE', 'BANKRUPTCY', 'JUDGMENT', 'TAX LIEN', 'SETTLED',
            'WRITTEN OFF', 'PROFIT AND LOSS', 'BAD DEBT', 'UNPAID'];
        return derogTerms.some(term => statusUpper.includes(term));
    },

    // Classify the type of derogatory account
    classifyAccountType: function(keyword) {
        const kw = keyword.toUpperCase();
        if (kw.includes('COLLECTION') || kw.includes('PLACED FOR COLLECTION') || kw.includes('TRANSFERRED TO RECOVERY')) return 'collection';
        if (kw.includes('CHARGE OFF') || kw.includes('CHARGE-OFF') || kw.includes('CHARGED OFF') || kw.includes('PROFIT AND LOSS') || kw.includes('BAD DEBT')) return 'charge_off';
        if (kw.includes('LATE') || kw.includes('PAST DUE') || kw.includes('DELINQUENT') || kw.includes('DAYS LATE')) return 'late_payment';
        if (kw.includes('BANKRUPTCY') || kw.includes('JUDGMENT') || kw.includes('TAX LIEN') || kw.includes('PUBLIC RECORD') || kw.includes('FORECLOSURE')) return 'public_record';
        if (kw.includes('REPOSSESSION') || kw.includes('VOLUNTARY SURRENDER') || kw.includes('INVOLUNTARY')) return 'repossession';
        return 'negative';
    },

    // Get human-readable type label
    getTypeLabel: function(type) {
        const labels = {
            'collection': 'Collection',
            'charge_off': 'Charge-Off',
            'late_payment': 'Late Payment',
            'public_record': 'Public Record',
            'repossession': 'Repossession',
            'negative': 'Negative'
        };
        return labels[type] || 'Negative';
    },

    // Extract status text from surrounding context
    extractStatus: function(contextText) {
        const statusPatterns = [
            /(?:Status|Condition|Pay\s*Status|Account\s*Status)\s*:?\s*([^\n,]{3,40})/i,
            /(Collection|Charge[d]?\s*Off|Past\s*Due|Delinquent|\d+\s*Days?\s*Late|Foreclosure|Repossession|Bankruptcy)/i
        ];

        for (const p of statusPatterns) {
            const match = contextText.match(p);
            if (match) return match[1].trim();
        }
        return '';
    },

    // Extract creditor name from a text chunk
    extractCreditorFromChunk: function(chunk) {
        const lines = chunk.trim().split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            // Look for lines that look like creditor names
            const nameMatch = trimmed.match(/^([A-Z][A-Za-z0-9\s&.'\/,-]{2,50})$/);
            if (nameMatch && !this.isCommonHeader(nameMatch[1])) {
                return nameMatch[1].trim();
            }
            // Also try: "Creditor: NAME"
            const labelMatch = trimmed.match(/(?:Creditor|Company|Name|Subscriber)\s*:?\s*([A-Z][A-Za-z0-9\s&.'\/,-]{2,50})/i);
            if (labelMatch) {
                return labelMatch[1].trim();
            }
        }

        // Fallback: first non-empty line that's not a label
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 3 && trimmed.length < 50 && /[A-Z]/.test(trimmed.charAt(0))) {
                if (!this.isCommonHeader(trimmed) && !/^(Account|Status|Balance|Date|Payment|Type|Condition)/i.test(trimmed)) {
                    return trimmed;
                }
            }
        }

        return null;
    },

    // Extract status from a chunk near the found keyword
    extractStatusFromChunk: function(chunk, keyword) {
        const statusMatch = chunk.match(/(?:Status|Condition|Pay\s*Status)\s*:?\s*([^\n]{3,40})/i);
        if (statusMatch) return statusMatch[1].trim();

        // Return the keyword context
        const kwIndex = chunk.toUpperCase().indexOf(keyword.toUpperCase());
        if (kwIndex !== -1) {
            return chunk.substring(Math.max(0, kwIndex - 5), Math.min(chunk.length, kwIndex + keyword.length + 20)).trim();
        }

        return keyword;
    },

    // Extract balance near a match position
    extractNearbyBalance: function(text, position) {
        const context = text.substring(position, Math.min(text.length, position + 200));
        const match = context.match(/(?:Balance|Amount|Bal|Owed)\s*:?\s*\$?([\d,]+\.?\d{0,2})/i);
        return match ? '$' + match[1] : '';
    },

    // Extract date near a match position
    extractNearbyDate: function(text, position) {
        const context = text.substring(position, Math.min(text.length, position + 200));
        const match = context.match(/(?:Opened|Date\s*Opened|Open\s*Date)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
        return match ? match[1] : '';
    },

    // Remove duplicate accounts
    deduplicateAccounts: function(accounts) {
        const seen = new Set();
        return accounts.filter(acc => {
            const key = (acc.creditorName + (acc.accountNumber || '')).toUpperCase().replace(/\s+/g, '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    // Check if text is a common report header (false positive for name extraction)
    isCommonHeader: function(text) {
        const headers = [
            'CREDIT REPORT', 'PERSONAL INFORMATION', 'CONSUMER INFORMATION',
            'ACCOUNT INFORMATION', 'CREDIT SUMMARY', 'ACCOUNT SUMMARY',
            'PUBLIC RECORDS', 'COLLECTION ACCOUNTS', 'CREDIT INQUIRIES',
            'INQUIRY INFORMATION', 'PERSONAL PROFILE', 'CREDIT HISTORY',
            'EXPERIAN', 'EQUIFAX', 'TRANSUNION', 'TRANS UNION',
            'CREDIT SCORE', 'FICO SCORE', 'VANTAGE SCORE',
            'DATE REPORTED', 'DATE OPENED', 'ACCOUNT STATUS',
            'PAYMENT STATUS', 'PAYMENT HISTORY', 'ACCOUNT DETAILS'
        ];
        return headers.some(h => text.toUpperCase().includes(h));
    },

    // Format a name properly
    formatName: function(name) {
        return name.split(/\s+/).map(part => {
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join(' ');
    },

    // Get approximate line position in text
    getLinePosition: function(text, lineIndex) {
        const lines = text.split('\n');
        let pos = 0;
        for (let i = 0; i < lineIndex && i < lines.length; i++) {
            pos += lines[i].length + 1;
        }
        return pos;
    }
};

// Initialize on load
PDFParser.init();
