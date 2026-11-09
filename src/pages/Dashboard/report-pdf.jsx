import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const dateFormat = (dateVal) => {
  if (!dateVal || dateVal === "-" || String(dateVal).trim() === "") return "-";
  try {
    const s = String(dateVal).trim();
    
    // Check if it's already in DD/MM/YYYY or DD-MM-YYYY format
    const slashDmy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    const dashDmy = /^\d{1,2}-\d{1,2}-\d{4}$/;
    if (slashDmy.test(s) || dashDmy.test(s)) {
      return s;
    }

    // Try parsing as number
    const num = Number(s);
    if (!isNaN(num)) {
      // Millisecond timestamp (e.g. 13+ digits) or UNIX timestamp (10 digits)
      if (num > 1000000000) {
        const d = new Date(num < 10000000000 ? num * 1000 : num);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          return `${day}/${month}/${year}`;
        }
      }
      // Excel/Google Sheets serial date (usually around 40000-60000)
      if (num > 30000 && num < 60000) {
        const d = new Date((num - 25569) * 86400000);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          return `${day}/${month}/${year}`;
        }
      }
    }

    // Try normal Date parsing
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return s;
  } catch (e) {
    return String(dateVal);
  }
};

const styles = StyleSheet.create({
  page: { padding: 15, paddingBottom: 30, fontSize: 9, fontFamily: 'Helvetica' },
  section: { marginBottom: 15 },
  header: { fontSize: 15, marginBottom: 15, textAlign: 'center', fontWeight: 'bold', color: '#0f172a' },
  stageHeader: { fontSize: 11, marginTop: 8, marginBottom: 4, fontWeight: 'bold', backgroundColor: '#f3f4f6', padding: 4, color: '#374151' },
  table: { display: 'flex', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', minHeight: 18, alignItems: 'center' },
  // Summary columns
  colSumStage: { width: '40%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colSumPending: { width: '20%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb', textAlign: 'center' },
  colSumResponsible: { width: '40%', padding: 3 },
  // Detailed columns
  colDetTicket: { width: '15%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetGenericCompany: { width: '25%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetClient: { width: '20%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetDetails: { width: '30%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetDelay: { width: '10%', padding: 3, textAlign: 'center' },
  // Stage-specific columns - Follow-Up (6 cols, wider for A4 landscape)
  colDetDate: { width: '10%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetFollowCompany: { width: '20%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetCategory: { width: '12%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetSiteAddr: { width: '18%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetFollowStage: { width: '12%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetCustomerSay: { width: '28%', padding: 3 },
  // Stage-specific columns - Site Visit Plan (4 cols)
  colDetSVDate: { width: '12%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetSVCompany: { width: '28%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetSVSiteAddr: { width: '40%', padding: 3, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetSVCategory: { width: '20%', padding: 3 },
  
  tableCellHeader: { fontSize: 9, fontWeight: 'bold', color: '#ffffff' },
  tableCell: { fontSize: 8, color: '#1f2937' },
  bgHeader: { backgroundColor: '#1e293b' },
  pageNumber: { position: 'absolute', fontSize: 8, bottom: 15, left: 0, right: 0, textAlign: 'center', color: '#9ca3af' }
});

export const ReportDocument = ({ summaryData, detailedData, followUpCategoryBreakdown }) => {
  // Group detailedData by stage, only allow Follow-Up and Site Visit Plan
  const groupedDetailedData = detailedData.reduce((acc, curr) => {
    if (curr.stage === "Follow-Up" || curr.stage === "Site Visit Plan") {
      if (!acc[curr.stage]) acc[curr.stage] = [];
      acc[curr.stage].push(curr);
    }
    return acc;
  }, {});

  const getHeaders = (stageName) => {
    if (stageName === "Follow-Up") {
      return ["Date", "Company Name", "Enquiry Type", "Site Address", "Stage", "Additional Details"];
    }
    return ["Ticket ID", "Company Name", "Client Name", "Details", "Delay (Days)"];
  };

  const getColStyles = (stageName) => {
    if (stageName === "Follow-Up") {
      return [
        styles.colDetDate,
        styles.colDetFollowCompany,
        styles.colDetCategory,
        styles.colDetSiteAddr,
        styles.colDetFollowStage,
        styles.colDetCustomerSay
      ];
    }
    return [
      styles.colDetTicket,
      styles.colDetGenericCompany,
      styles.colDetClient,
      styles.colDetDetails,
      styles.colDetDelay
    ];
  };

  const getRowData = (row, stageName) => {
    if (stageName === "Follow-Up") {
      const fStage = row.followUpStage || "";
      let details = "";
      if (fStage === "Order Received") {
        details = `Basic Amt: ${row.basicAmount || "-"}`;
      } else if (fStage === "Follow-Up") {
        details = `Last Follow: ${dateFormat(row.dateOfLastFollowUp) || "-"}\nSay: ${row.whatDidCustomerSay || "-"}`;
      } else {
        details = `Amt: ${row.basicAmount || "-"}\nSay: ${row.whatDidCustomerSay || "-"}`;
      }
      return [
        dateFormat(row.date) || "-",
        row.companyName || "-",
        row.category || "-",
        row.siteAddress || "-",
        fStage || "-",
        details
      ];
    }
    return [
      row.ticketId || "-",
      row.companyName || "-",
      row.clientName || "-",
      row.details || "-",
      String(row.delay !== undefined && row.delay !== null ? row.delay : "0")
    ];
  };

  return (
    <Document>
      {/* Summary Page */}
      <Page size={{ width: 842, height: 595 }} style={styles.page}>
        <Text style={styles.header}>Summary Report (Service-Inbound)</Text>
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.bgHeader]} fixed>
              <View style={styles.colSumStage}><Text style={styles.tableCellHeader}>Stages</Text></View>
              <View style={styles.colSumPending}><Text style={styles.tableCellHeader}>Pending</Text></View>
              <View style={styles.colSumResponsible}><Text style={styles.tableCellHeader}>Responsible</Text></View>
            </View>
            {summaryData.map((row, i) => (
              <View style={styles.tableRow} key={i} wrap={false}>
                <View style={styles.colSumStage}><Text style={styles.tableCell}>{String(row.stage)}</Text></View>
                <View style={styles.colSumPending}>
                  <Text style={styles.tableCell}>
                    {String(row.pending)}
                  </Text>
                </View>
                <View style={styles.colSumResponsible}><Text style={styles.tableCell}>{String(row.responsible)}</Text></View>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>

      {/* Detailed Report Pages */}
      {Object.entries(groupedDetailedData).map(([stageName, itemsArray], idx) => {
        let items = itemsArray;
        
        const heads = getHeaders(stageName);
        const colStyles = getColStyles(stageName);
        
        let headerText = `Detailed Report: ${String(stageName)} (${String(items.length)} Pending)`;

        return (
          <Page key={idx} size={{ width: 842, height: 595 }} style={styles.page}>
            <Text style={styles.header}>{headerText}</Text>

            {stageName === "Follow-Up" && followUpCategoryBreakdown && Object.keys(followUpCategoryBreakdown).length > 0 && (
              <View style={{ marginBottom: 10, padding: 5, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', borderRadius: 4 }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: '#0f766e', marginBottom: 2 }}>
                  Enquiry Type Breakdown (Pending):
                </Text>
                <Text style={{ fontSize: 8.5, color: '#115e59' }}>
                  {Object.entries(followUpCategoryBreakdown)
                    .map(([cat, val]) => `${cat}: ${val}`)
                    .join("  |  ")}
                </Text>
              </View>
            )}
            
            <View style={styles.section}>
              <View style={styles.table}>
                {/* Column Headers */}
                <View style={[styles.tableRow, styles.bgHeader]} fixed >
                  {heads.map((head, i) => (
                    <View key={i} style={colStyles[i] || {}} >
                      <Text style={styles.tableCellHeader}>{head}</Text>
                    </View>
                  ))}
                </View>

                {items.map((row, i) => {
                  const data = getRowData(row, stageName);
                  return (
                    <View style={styles.tableRow} key={i} wrap={false}>
                      {data.map((cell, j) => (
                        <View key={j} style={colStyles[j] || {}} >
                          <Text style={styles.tableCell}>{String(cell || "-")}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
          </Page>
        );
      })}
    </Document>
  );
};
