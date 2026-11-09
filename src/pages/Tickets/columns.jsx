import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared";
import { formatDate } from "../../lib/format";

export const COLUMNS = [
  { key: "actions", label: "Actions", fixed: true, cell: (r, { onEdit }) => (
    <Button variant="outline" size="sm" onClick={() => onEdit(r)}>Edit</Button>
  ) },
  { key: "currentStage", label: "Current Stage", defaultVisible: true, cell: (r) => (
    r.currentStage ? <StatusBadge tone="info">{r.currentStage}</StatusBadge> : ""
  ) },
  { key: "date", label: "Date", defaultVisible: true, text: (r) => formatDate(r.timeStemp) },
  { key: "ticketId", label: "Ticket-ID", defaultVisible: true, strong: true, text: (r) => r.ticketId },
  { key: "sourceOfEnquiry", label: "Source of enquiry", defaultVisible: false, text: (r) => r.sourceOfEnquiry },
  { key: "callType", label: "Call type", defaultVisible: false, text: (r) => r.callType },
  { key: "enquiryReceiverName", label: "Enquiry Receiver Name", defaultVisible: false, text: (r) => r.enquiryReceiverName },
  { key: "clientType", label: "Client Type", defaultVisible: false, text: (r) => r.clientType },
  { key: "companyName", label: "Company Name", defaultVisible: true, wrap: true, width: 180, text: (r) => r.companyName },
  { key: "clientName", label: "Client Name", defaultVisible: true, text: (r) => r.clientName },
  { key: "phoneNumber", label: "Phone Number", defaultVisible: true, text: (r) => r.phoneNumber },
  { key: "siteAddress", label: "Site Address", defaultVisible: false, wrap: true, width: 200, text: (r) => r.siteAddress },
  { key: "gstNo", label: "GST No.", defaultVisible: false, text: (r) => r.gstNo },
  { key: "machineName", label: "Machine Name", defaultVisible: true, wrap: true, width: 200, text: (r) => r.machineName },
  { key: "enquiryType", label: "Enquiry Type", defaultVisible: false, text: (r) => r.enquiryType },
  { key: "category", label: "Category", defaultVisible: true, text: (r) => r.category },
  { key: "mentionIssue", label: "Mention Issue", defaultVisible: true, wrap: true, width: 250, text: (r) => r.mentionIssue },
  { key: "serviceLocation", label: "Service Location", defaultVisible: true, text: (r) => r.serviceLocation },
];
