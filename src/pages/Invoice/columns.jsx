import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { Eye } from "lucide-react";
import { formatDate, formatDelayLabel, delayTone } from "../../lib/format";

const linkCell = (url, label = "View") =>
  url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
      {label}
    </a>
  ) : null;

const rupees = (v) => "₹" + (v || "0");

// Pending: ticket + order details. History: the posted invoice (numbers, amounts, files, delay).
export const COLUMNS = [
  { key: "action", label: "Action", fixed: true, cell: (r, { tab, onInvoice, onEdit }) =>
    tab === "pending" ? (
      <Button size="sm" variant="outline" onClick={() => onInvoice(r)} data-testid={`button-invoice-${r.ticketId}`}>Invoice</Button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => onEdit(r)} data-testid={`button-edit-history-${r.ticketId}`}>Edit</Button>
    ) },
  { key: "ticketId", label: "Ticket ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: true, text: (r) => r.enquiryType },
  { key: "quotationNo", label: "Quotation No.", defaultVisible: true, text: (r) => r.quotationNo },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 220, text: (r) => r.companyName },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, tabs: ["pending"], wrap: true, width: 220, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST Number", defaultVisible: false, tabs: ["pending"], text: (r) => r.gstNo },
  { key: "gstAddress", label: "Billing Address", defaultVisible: false, tabs: ["pending"], wrap: true, width: 220, text: (r) => r.gstAddress },
  { key: "paymentTerm", label: "Payment Term", defaultVisible: true, tabs: ["pending"], text: (r) => r.paymentTerm },
  { key: "clientApproval", label: "Client Approval", defaultVisible: true, tabs: ["pending"], cell: (r) => linkCell(r.clientApproval) },
  { key: "seniorApproval", label: "Senior Approval", defaultVisible: true, tabs: ["pending"], cell: (r) => linkCell(r.seniorApproval) },
  { key: "advance", label: "Advance Details", defaultVisible: true, tabs: ["pending"], cell: (r, { onAdvance }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onAdvance(r)}
      aria-label={`Advance details for ${r.ticketId}`}
      className="h-7 px-2"
      data-testid={`button-advance-details-${r.ticketId}`}
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  ) },
  { key: "quotationPdf", label: "Quotation PDF", defaultVisible: true, tabs: ["pending"], cell: (r) => linkCell(r.quotationPdfLink, "View PDF") },
  { key: "invoiceDate", label: "Invoice Date", defaultVisible: true, tabs: ["history"], text: (r) => formatDate(r.invoiceDate) },
  { key: "invoicePostedBy", label: "Invoice Posted By", defaultVisible: true, tabs: ["history"], text: (r) => r.invoicePostedBy },
  { key: "invoiceNoSERVICE", label: "Invoice No (SERVICE)", defaultVisible: true, tabs: ["history"], text: (r) => r.invoiceNoSERVICE },
  { key: "invoiceNoSPARE", label: "Invoice No (SPARE)", defaultVisible: true, tabs: ["history"], text: (r) => r.invoiceNoSPARE },
  { key: "serviceAmountBasic", label: "Service Amount (Basic)", defaultVisible: true, tabs: ["history"], text: (r) => rupees(r.serviceAmountBasic) },
  { key: "serviceAmountGst", label: "Service Amount (GST)", defaultVisible: false, tabs: ["history"], text: (r) => rupees(r.serviceAmountGst) },
  { key: "spareAmountBasic", label: "Spare Amount (Basic)", defaultVisible: true, tabs: ["history"], text: (r) => rupees(r.spareAmountBasic) },
  { key: "spareAmountGst", label: "Spare Amount (GST)", defaultVisible: false, tabs: ["history"], text: (r) => rupees(r.spareAmountGst) },
  { key: "attachmentService", label: "Attachment Service", defaultVisible: true, tabs: ["history"], cell: (r) => linkCell(r.attachmentService) },
  { key: "attachmentSpare", label: "Attachment Spare", defaultVisible: true, tabs: ["history"], cell: (r) => linkCell(r.attachmentSpare) },
  { key: "delay", label: "Delay", defaultVisible: true, tabs: ["history"], cell: (r) => (
    <StatusBadge tone={delayTone(r.delayMinutes)}>{formatDelayLabel(r.delayMinutes)}</StatusBadge>
  ) },
];
