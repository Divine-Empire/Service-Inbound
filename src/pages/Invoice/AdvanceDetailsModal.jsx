import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";

// Payment Mode + Advance Payment Attachment + Senior Approval for one ticket (Pending tab's eye
// icon). Render it only while a ticket is selected.
export default function AdvanceDetailsModal({ ticket: advanceDetailsTicket, onClose }) {
  return (
      <Modal
        isOpen
        onClose={onClose}
        title="Advance Details"
        size="sm"
      >
        <div className="p-2 space-y-4">
          <div>
            <p className="text-gray-500 font-medium text-sm">Payment Mode</p>
            <p className="text-blue-900">{advanceDetailsTicket?.paymentMode || "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Advance Payment Attachment</p>
            {advanceDetailsTicket?.advancePaymentAttachment ? (
              <a
                href={advanceDetailsTicket.advancePaymentAttachment}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View File
              </a>
            ) : (
              <p className="text-blue-900">N/A</p>
            )}
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Senior Approval</p>
            {advanceDetailsTicket?.seniorApproval ? (
              <a
                href={advanceDetailsTicket.seniorApproval}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View File
              </a>
            ) : (
              <p className="text-blue-900">N/A</p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
  );
}
