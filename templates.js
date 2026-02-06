/* ============================================
   THE CREDIT DATABASE - Dispute Letter Templates
   ============================================ */

const DisputeTemplates = {
    templates: [
        {
            id: 'basic_dispute',
            name: 'Basic Dispute Letter',
            description: 'A straightforward dispute letter citing inaccuracies under the FCRA. Requests investigation and removal of unverifiable items.',
            tag: 'Most Popular',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Creditor/Company Name: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    accountList += `\n    Reason for Dispute: ${acc.reasonText || 'This account is inaccurate and is being reported incorrectly'}`;
                    accountList += `\n    Status Reported: ${acc.statusText || acc.type}`;
                    if (acc.balance) accountList += `\n    Balance Reported: ${acc.balance}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Dispute of Inaccurate Credit Report Information

To Whom It May Concern:

I am writing to dispute the following inaccurate information that appears on my credit report. I have identified the items listed below as inaccurate and request that they be investigated and corrected or removed from my credit report pursuant to the Fair Credit Reporting Act (FCRA), Section 611 (15 U.S.C. § 1681i).

The following accounts are being reported inaccurately:
${accountList}
I am disputing these items because the information is inaccurate and does not reflect the true status of these accounts. Under the FCRA, you are required to conduct a reasonable investigation into this matter and remove or correct any information that cannot be verified within 30 days of receiving this dispute.

Please investigate these items and provide me with the results of your investigation, including a copy of my updated credit report reflecting any changes made.

I have enclosed a copy of my identification for verification purposes.

Thank you for your prompt attention to this matter.

Sincerely,


${personalInfo.fullName}

Enclosures:
- Copy of Driver's License or State ID
- Copy of Social Security Card or W-2
- Proof of Address (utility bill or bank statement)`;
            }
        },
        {
            id: 'factual_dispute',
            name: 'Factual Dispute Letter',
            description: 'Disputes based on specific factual inaccuracies such as wrong balances, dates, or account statuses. Cites specific FCRA sections.',
            tag: 'Detailed',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach((acc, idx) => {
                    accountList += `\nItem #${idx + 1}:`;
                    accountList += `\n  Creditor Name: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n  Account Number: ${acc.accountNumber}`;
                    accountList += `\n  Status Reported: ${acc.statusText || acc.type}`;
                    if (acc.balance) accountList += `\n  Balance Reported: ${acc.balance}`;
                    if (acc.dateOpened) accountList += `\n  Date Opened: ${acc.dateOpened}`;
                    accountList += `\n  Dispute Reason: The information reported for this account is factually inaccurate. ${acc.reasonText || 'The reported status, balance, and/or payment history does not accurately reflect the actual history of this account.'}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Formal Dispute - Factually Inaccurate Account Information

To Whom It May Concern:

I am writing to formally dispute factually inaccurate information contained in my credit report maintained by your bureau. Pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i, I am exercising my right to dispute incomplete and inaccurate information.

After careful review of my credit report, I have identified the following items that contain factual errors:
${accountList}
As required by Section 611(a) of the FCRA, I am requesting that you conduct a thorough and reasonable investigation of each disputed item listed above. The FCRA requires that credit reporting agencies follow reasonable procedures to assure maximum possible accuracy of the information in consumer credit reports (15 U.S.C. § 1681e(b)).

Furthermore, under Section 611(a)(1)(A), you are required to:
1. Conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate
2. Record the current status of the disputed information before the beginning of the 30-day period
3. Forward all relevant information regarding the dispute to the furnisher of information

If you are unable to verify any of the disputed items within 30 days, I request that they be promptly removed from my credit report in accordance with FCRA Section 611(a)(5)(A).

Please forward me an updated copy of my credit report once the investigation is complete.

Respectfully,


${personalInfo.fullName}

Enclosures:
- Copy of Government-Issued Photo ID
- Proof of Current Address
- Copy of Social Security Card`;
            }
        },
        {
            id: 'method_of_verification',
            name: 'Method of Verification (MOV)',
            description: 'Requests the credit bureau to provide the method used to verify disputed accounts. Powerful follow-up letter after initial dispute.',
            tag: 'Follow-Up',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Creditor Name: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    accountList += `\n    Status: ${acc.statusText || acc.type}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Request for Method of Verification - Previously Disputed Items

To Whom It May Concern:

I recently submitted a dispute regarding inaccurate items on my credit report. I received your response stating that the items were "verified." However, I am requesting that you provide me with the method of verification used for each of the following accounts pursuant to FCRA Section 611(a)(6)(B)(iii) and Section 611(a)(7):

The following items were previously disputed and allegedly verified:
${accountList}
Under Section 611(a)(6)(B)(iii) of the Fair Credit Reporting Act, upon the completion of a reinvestigation, the consumer reporting agency shall provide to the consumer a description or notice of the procedure used to determine the accuracy and completeness of the information, including the name, business address, and telephone number of any furnisher contacted in connection with such information.

Additionally, Section 611(a)(7) states that the consumer reporting agency shall provide a description of the reinvestigation procedure used to determine the accuracy and completeness of the information.

I am requesting the following for each disputed account:
1. The name, address, and telephone number of each person contacted regarding each disputed item
2. A description of the method used to verify each item
3. A copy of any documentation obtained during the reinvestigation
4. The dates on which the reinvestigation was conducted

If you are unable to provide this information, then the items have not been properly verified and must be deleted from my credit report immediately under FCRA Section 611(a)(5)(A).

I expect a response within 15 days of receipt of this letter.

Sincerely,


${personalInfo.fullName}

Enclosures:
- Copy of Previous Dispute Response (if available)
- Copy of Government-Issued Photo ID`;
            }
        },
        {
            id: 'debt_validation',
            name: 'Debt Validation Letter',
            description: 'Specifically targets collection accounts. Demands validation of the debt and proof that the collector has the right to collect.',
            tag: 'Collections',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Collection Agency / Creditor: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    if (acc.balance) accountList += `\n    Amount Reported: ${acc.balance}`;
                    accountList += `\n    Account Status: ${acc.statusText || acc.type}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Dispute of Unvalidated Collection Accounts

To Whom It May Concern:

I am writing to dispute the following collection accounts appearing on my credit report. I do not recognize these debts and I am requesting that they be properly validated and verified before being reported on my credit file.

The following collection accounts are in dispute:
${accountList}
Under the Fair Credit Reporting Act, Section 611, you are required to conduct a reasonable investigation of items disputed by consumers. Additionally, under Section 1681e(b), every consumer reporting agency shall follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates.

I am requesting that you verify the following for each disputed collection account:
1. Proof that the collection agency or creditor has the legal authority to collect this debt
2. Verification of the complete payment history and original amount owed
3. Proof that the statute of limitations has not expired on this debt
4. A copy of the original signed contract or agreement bearing my signature
5. Verification that the amount being reported is accurate

If any of the above information cannot be provided or verified within 30 days, I demand that these items be immediately deleted from my credit report as required under FCRA Section 611(a)(5)(A).

Please be advised that reporting unverified information is a violation of the FCRA and may subject your agency to liability under Section 616 and Section 617 of the Act.

Respectfully,


${personalInfo.fullName}

Enclosures:
- Copy of Driver's License or State ID
- Proof of Address`;
            }
        },
        {
            id: 'aggressive_removal',
            name: 'Aggressive Removal Request',
            description: 'A strongly worded letter demanding removal of negative items. References legal consequences of FCRA violations and intent to pursue remedies.',
            tag: 'Aggressive',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach((acc, idx) => {
                    accountList += `\n  ${idx + 1}. ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += ` (Account #: ${acc.accountNumber})`;
                    accountList += ` - ${acc.statusText || acc.type}`;
                    if (acc.balance) accountList += ` - Balance: ${acc.balance}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: DEMAND FOR IMMEDIATE REMOVAL OF INACCURATE INFORMATION

To Whom It May Concern:

This letter serves as a formal demand for the immediate removal of the following inaccurate, misleading, and unverifiable information from my credit report. I have previously reviewed my credit report and found these items to be in violation of the Fair Credit Reporting Act.

ITEMS TO BE REMOVED IMMEDIATELY:
${accountList}
LEGAL BASIS FOR THIS DEMAND:

1. Under 15 U.S.C. § 1681e(b), consumer reporting agencies are required to follow reasonable procedures to assure maximum possible accuracy of consumer credit information. The items listed above fail to meet this standard.

2. Under 15 U.S.C. § 1681i(a), you are required to conduct a reasonable reinvestigation and delete information that is found to be inaccurate, incomplete, or unverifiable.

3. Under 15 U.S.C. § 1681s-2(b), furnishers of information are required to conduct an investigation when notified of a dispute by a consumer reporting agency.

NOTICE OF INTENT:

Please be advised that if these items are not removed within 30 days of your receipt of this letter, I intend to exercise my rights under the FCRA, including but not limited to:

- Filing a formal complaint with the Consumer Financial Protection Bureau (CFPB)
- Filing a complaint with the Federal Trade Commission (FTC)
- Pursuing statutory damages of $100 to $1,000 per violation under 15 U.S.C. § 1681n
- Seeking actual damages for any harm caused by the continued reporting of this inaccurate information
- Recovery of attorney's fees and court costs

I trust this matter will be handled with the seriousness and urgency it deserves.

This letter is being sent via certified mail and I will retain a copy for my records.

Sincerely,


${personalInfo.fullName}

Enclosures:
- Copy of Government-Issued Photo ID
- Copy of Social Security Card
- Proof of Current Address`;
            }
        },
        {
            id: 'early_exclusion',
            name: 'Early Exclusion / Obsolete Data Request',
            description: 'Requests removal of items that are approaching or past the 7-year reporting limit. Challenges the date of first delinquency.',
            tag: 'Timing-Based',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Creditor Name: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    accountList += `\n    Status: ${acc.statusText || acc.type}`;
                    if (acc.dateOpened) accountList += `\n    Date Reported: ${acc.dateOpened}`;
                    accountList += `\n    Dispute Basis: The date of first delinquency for this account may be inaccurate, potentially making this item obsolete under FCRA reporting guidelines.`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Request for Removal of Obsolete / Expired Information

To Whom It May Concern:

I am writing to request the removal of the following items from my credit report that I believe to be obsolete or approaching obsolescence under the Fair Credit Reporting Act, Section 605 (15 U.S.C. § 1681c).

The following items are in question:
${accountList}
Under FCRA Section 605(a), the following reporting time limits apply:
- Most negative information: 7 years from the date of first delinquency
- Bankruptcies: 10 years from the date of filing (Chapter 7) or 7 years (Chapter 13)
- Collection accounts: 7 years from the date of first delinquency on the ORIGINAL account

I am requesting that you verify the accuracy of the date of first delinquency for each of these accounts. Under FCRA Section 623(a)(5), the furnisher of information is required to report the date of first delinquency accurately.

If the date of first delinquency cannot be accurately verified, or if these items have exceeded the allowable reporting period, I demand their immediate removal from my credit report.

Please provide me with documentation showing the verified date of first delinquency for each disputed item.

Thank you for your attention to this matter.

Sincerely,


${personalInfo.fullName}

Enclosures:
- Copy of Government-Issued Photo ID
- Proof of Address`;
            }
        },
        {
            id: 'identity_theft',
            name: 'Identity Theft Dispute',
            description: 'For disputing accounts opened fraudulently. Includes FTC identity theft report references and demands under extended fraud alert provisions.',
            tag: 'Fraud',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Creditor/Company: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    if (acc.balance) accountList += `\n    Balance: ${acc.balance}`;
                    accountList += `\n    This account was opened fraudulently and without my knowledge or authorization.`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Identity Theft Dispute - Request for Fraudulent Account Removal

To Whom It May Concern:

I am a victim of identity theft and I am writing to dispute the following fraudulent accounts that appear on my credit report. These accounts were opened without my knowledge, consent, or authorization.

FRAUDULENT ACCOUNTS:
${accountList}
Pursuant to the Fair Credit Reporting Act, Section 605B (15 U.S.C. § 1681c-2), I am requesting that you block the reporting of any information resulting from identity theft. I have filed the appropriate reports and am enclosing supporting documentation.

Under Section 605B, you are required to:
1. Block the reporting of information resulting from identity theft no later than 4 business days after receiving this notice
2. Notify the furnisher of information that the information may be a result of identity theft
3. Notify the furnisher that the block has been established

Additionally, under Section 609(e), I am requesting that you provide me with copies of all business transaction records related to the fraudulent accounts, including applications and other documents.

I have not authorized anyone to use my personal information to open these accounts, and I demand their immediate removal from my credit file.

Please confirm in writing that these accounts have been removed and provide me with an updated copy of my credit report.

Sincerely,


${personalInfo.fullName}

Enclosures:
- FTC Identity Theft Report / Affidavit
- Copy of Government-Issued Photo ID
- Copy of Social Security Card
- Police Report (if available)
- Proof of Address`;
            }
        },
        {
            id: 'goodwill_removal',
            name: 'Goodwill Adjustment Letter',
            description: 'A polite request to creditors to remove negative marks as a gesture of goodwill. Best for one-time late payments with otherwise good history.',
            tag: 'Goodwill',
            generate: function(data) {
                const { personalInfo, bureau, accounts, date } = data;
                const bureauAddress = DisputeTemplates.getBureauAddress(bureau);

                let accountList = '';
                accounts.forEach(acc => {
                    accountList += `\n  - Creditor: ${acc.creditorName}`;
                    if (acc.accountNumber) accountList += `\n    Account Number: ${acc.accountNumber}`;
                    accountList += `\n    Issue: ${acc.statusText || acc.type}`;
                    accountList += '\n';
                });

                return `${personalInfo.fullName}
${personalInfo.address}
${personalInfo.city}, ${personalInfo.state} ${personalInfo.zip}
${personalInfo.ssn ? 'SSN: XXX-XX-' + personalInfo.ssn : ''}
${personalInfo.dob ? 'Date of Birth: ' + personalInfo.dob : ''}

Date: ${date}

${bureauAddress.name}
${bureauAddress.address}
${bureauAddress.cityStateZip}

RE: Goodwill Request for Removal of Negative Information

To Whom It May Concern:

I am writing to respectfully request a goodwill adjustment to my credit report maintained by your bureau. I am requesting that the following negative items be considered for removal or updated reporting:
${accountList}
I understand that the reported information may be technically accurate. However, I am requesting this adjustment as a gesture of goodwill based on the following circumstances:

The negative marks on my report were the result of circumstances beyond my normal control. Since that time, I have taken significant steps to ensure my financial responsibilities are met consistently and on time. I have demonstrated a strong commitment to maintaining good credit standing.

This negative information is significantly impacting my ability to obtain favorable credit terms and is not reflective of my current financial responsibility and creditworthiness.

I am not disputing the accuracy of the information, but rather requesting that you consider updating this information as a courtesy based on my overall positive credit history and the steps I have taken to resolve any outstanding issues.

I would greatly appreciate your consideration in this matter.

Thank you for your time and attention.

Respectfully,


${personalInfo.fullName}`;
            }
        }
    ],

    getBureauAddress: function(bureau) {
        const addresses = {
            experian: {
                name: 'Experian',
                address: 'P.O. Box 4500',
                cityStateZip: 'Allen, TX 75013'
            },
            equifax: {
                name: 'Equifax Information Services LLC',
                address: 'P.O. Box 740256',
                cityStateZip: 'Atlanta, GA 30374'
            },
            transunion: {
                name: 'TransUnion LLC',
                address: 'P.O. Box 2000',
                cityStateZip: 'Chester, PA 19016'
            }
        };
        return addresses[bureau] || addresses.experian;
    },

    getTemplate: function(id) {
        return this.templates.find(t => t.id === id);
    },

    getAllTemplates: function() {
        return this.templates;
    }
};
