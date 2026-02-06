/* ============================================
   THE CREDIT DATABASE - Letter Generator
   ============================================ */

const LetterGenerator = {

    // Generate dispute letters for all 3 bureaus
    generateAll: function(personalInfo, selectedAccounts, templateId) {
        const template = DisputeTemplates.getTemplate(templateId);
        if (!template) {
            throw new Error('Template not found: ' + templateId);
        }

        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        const bureaus = ['experian', 'equifax', 'transunion'];
        const letters = {};

        bureaus.forEach(bureau => {
            letters[bureau] = template.generate({
                personalInfo: personalInfo,
                bureau: bureau,
                accounts: selectedAccounts,
                date: dateStr
            });
        });

        return letters;
    },

    // Generate a PDF from letter text
    generatePDF: function(letterText, bureau, personalInfo) {
        const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
        const doc = new jsPDF({
            unit: 'pt',
            format: 'letter'
        });

        const margin = 72; // 1 inch margins
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - (margin * 2);
        const lineHeight = 16;
        let y = margin;

        doc.setFont('times', 'normal');
        doc.setFontSize(12);

        const lines = letterText.split('\n');

        lines.forEach(line => {
            // Check if we need a new page
            if (y > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }

            if (line.trim() === '') {
                y += lineHeight * 0.6;
                return;
            }

            // Handle long lines by wrapping
            const wrappedLines = doc.splitTextToSize(line, maxWidth);
            wrappedLines.forEach(wl => {
                if (y > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }
                doc.text(wl, margin, y);
                y += lineHeight;
            });
        });

        return doc;
    },

    // Download a single letter as PDF
    downloadPDF: function(letterText, bureau, personalInfo) {
        const doc = this.generatePDF(letterText, bureau, personalInfo);
        const name = personalInfo.fullName ? personalInfo.fullName.replace(/\s+/g, '_') : 'Client';
        const fileName = `Dispute_Letter_${this.capitalizeBureau(bureau)}_${name}.pdf`;
        doc.save(fileName);
    },

    // Download all 3 letters
    downloadAllPDFs: function(letters, personalInfo) {
        const bureaus = ['experian', 'equifax', 'transunion'];
        bureaus.forEach(bureau => {
            if (letters[bureau]) {
                // Small delay between downloads to prevent browser blocking
                setTimeout(() => {
                    this.downloadPDF(letters[bureau], bureau, personalInfo);
                }, bureaus.indexOf(bureau) * 500);
            }
        });
    },

    // Render letter as HTML for preview
    renderLetterHTML: function(letterText) {
        if (!letterText) return '<p style="color: #999; text-align: center;">No letter generated.</p>';

        // Escape HTML
        let html = letterText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert text formatting
        // Bold: text between ** or lines that are all caps headers
        html = html.replace(/^(RE:.*?)$/gm, '<strong>$1</strong>');
        html = html.replace(/^(ITEMS TO BE REMOVED.*?)$/gm, '<strong>$1</strong>');
        html = html.replace(/^(LEGAL BASIS.*?)$/gm, '<strong>$1</strong>');
        html = html.replace(/^(NOTICE OF INTENT.*?)$/gm, '<strong>$1</strong>');
        html = html.replace(/^(FRAUDULENT ACCOUNTS.*?)$/gm, '<strong>$1</strong>');

        // Numbered list items
        html = html.replace(/^(\d+\.)\s/gm, '<strong>$1</strong> ');

        // Bureau names
        html = html.replace(/\b(Experian|Equifax|TransUnion)\b/g, '<strong>$1</strong>');

        // Convert newlines to <br>
        html = html.replace(/\n/g, '<br>');

        // Wrap in styled container
        return `<div style="font-family: 'Times New Roman', Times, serif; font-size: 13px; line-height: 1.7; color: #111;">${html}</div>`;
    },

    // Capitalize bureau name
    capitalizeBureau: function(bureau) {
        const names = {
            experian: 'Experian',
            equifax: 'Equifax',
            transunion: 'TransUnion'
        };
        return names[bureau] || bureau;
    }
};
