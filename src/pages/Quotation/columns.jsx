import { Button } from "../../components/ui/button";

// Kept local: an unparseable value is shown as-is (lib/format returns "").
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const linkCell = (url, label) =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {label}
    </a>
  ) : (
    ""
  );

// Pending: Quotation action + enquiry columns. History: what was quoted/shared
// (admin-only Edit). Pending and History intentionally overlap (see fetchData).
export const COLUMNS = [
  { key: "quote", label: "Action", fixed: true, tabs: ["pending"], cell: (r, { onQuote }) => (
    <Button size="sm" variant="outline" onClick={() => onQuote(r)} data-testid={`button-quotation-${r.ticketId}`}>
      Quotation
    </Button>
  ) },
  { key: "edit", label: "Action", fixed: true, tabs: ["history"], cell: (r, { onEdit }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onEdit(r)}
      title="Edit this ticket's quotation — e.g. to pull in a revised Make Quotation PDF"
    >
      Edit
    </Button>
  ) },
  { key: "date", label: "Date", defaultVisible: true, strong: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: false, text: (r) => r.machineName },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: false, wrap: true, width: 200, text: (r) => r.mentionIssue },
  { key: "quotationNo", label: "Quotation No.", defaultVisible: true, text: (r) => r.quotationNo },
  { key: "basicValue", label: "Quotation Basic Value", defaultVisible: true, tabs: ["pending"], text: (r) => (
    r.basicAmount !== null && r.basicAmount !== undefined ? String(r.basicAmount).trim() || "0" : "N/A"
  ) },
  { key: "basicAmount", label: "Basic Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.basicAmount || "0"}` },
  { key: "totalAmount", label: "Total Amount", defaultVisible: true, tabs: ["history"], text: (r) => `₹${r.totalQutation || "0"}` },
  { key: "shareBy", label: "Share By", defaultVisible: false, tabs: ["history"], text: (r) => r.quotationShareBy },
  { key: "shareThrough", label: "Share Through", defaultVisible: false, tabs: ["history"], text: (r) => r.shareThrough },
  { key: "quotationPdf", label: "Quotation PDF", defaultVisible: true, cell: (r) => linkCell(r.quotationPdfLink, "View PDF") },
  { key: "remarks", label: "Remarks", defaultVisible: false, tabs: ["history"], wrap: true, width: 200, text: (r) => r.remarks },
];
// The History "Edit" action is admin-only.
export const COLUMNS_NON_ADMIN = COLUMNS.filter((c) => c.key !== "edit");
