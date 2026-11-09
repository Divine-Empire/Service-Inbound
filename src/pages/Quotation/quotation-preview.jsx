"use client"
import { Copy as CopyIcon, Share2 as ShareIcon, Eye as EyeIcon, Download as DownloadIcon } from "lucide-react"

const QuotationPreview = ({
  quotationData,
  quotationLink,
  pdfUrl,
  selectedReferences,
  specialDiscount,
  imageform,
  handleGenerateLink,
  handleGeneratePDF,
  isGenerating,
  isSubmitting,
  hiddenColumns,
}) => {
  return (
    <div className="space-y-6">
      <div id="quotation-preview" className="bg-white border p-6 rounded-lg">
        <div className="flex justify-between items-start border-b pb-4">
          <div className="w-1/3">
            <p className="font-bold">{selectedReferences[0] || "Consignor Name"}</p>
            <p className="text-sm">{quotationData.consignorAddress || "Consignor Address"}</p>
            <p className="text-sm">Mobile: {quotationData.consignorMobile?.split(",")[0] || "N/A"}</p>
            <p className="text-sm">Phone: {quotationData.consignorPhone || "N/A"}</p>
            <p className="text-sm">GSTIN: {quotationData.consignorGSTIN || "N/A"}</p>
            <p className="text-sm">State Code: {quotationData.consignorStateCode || "N/A"}</p>
          </div>
          <div className="w-1/3 text-center">
            <h1 className="text-xl font-bold">QUOTATION</h1>
          </div>
          <div className="w-1/3 text-right">
            <p className="font-bold">Quo No: {quotationData.quotationNo}</p>
            <p>Date: {quotationData.date}</p>
            <p>Prepared By: {quotationData.preparedBy || "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b pb-4">
          <div>
            <h3 className="font-bold mb-2">Consignor Details</h3>
            <p>{selectedReferences[0] || "N/A"}</p>
            <p>{quotationData.consignorAddress || "N/A"}</p>
            <p>GSTIN: {quotationData.consignorGSTIN || "N/A"}</p>
            <p>State Code: {quotationData.consignorStateCode || "N/A"}</p>
            <p>MSME Number: {quotationData.msmeNumber || "N/A"}</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Consignee Details</h3>
            <p>Company Name: {quotationData.consigneeName || "N/A"}</p>
            <p>Contact Name: {quotationData.consigneeContactName || "N/A"}</p>
            <p>Contact No.: {quotationData.consigneeContactNo || "N/A"}</p>
            <p>State: {quotationData.consigneeState || "N/A"}</p>
            <p>GSTIN: {quotationData.consigneeGSTIN || "N/A"}</p>
            <p>State Code: {quotationData.consigneeStateCode || "N/A"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b pb-4">
          <div>
            <h3 className="font-bold mb-2">Bill To</h3>
            <p>{quotationData.consigneeAddress || "N/A"}</p>
          </div>
          <div>
            <h3 className="font-bold mb-2">Ship To</h3>
            <p>{quotationData.shipTo || "N/A"}</p>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border">
                <th className="border p-2 text-left">S No.</th>
                <th className="border p-2 text-left">Code</th>
                <th className="border p-2 text-left">Product Name</th>
                <th className="border p-2 text-left">Description</th>
                <th className="border p-2 text-left">GST %</th>
                <th className="border p-2 text-left">Qty</th>
                <th className="border p-2 text-left">Units</th>
                <th className="border p-2 text-left">Rate</th>
                {!hiddenColumns?.hideDisc && <th className="border p-2 text-left">Disc %</th>}
                {!hiddenColumns?.hideFlatDisc && <th className="border p-2 text-left">Flat Disc</th>}
                <th className="border p-2 text-left">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quotationData.items.map((item, index) => (
                <tr key={item.id} className="border">
                  <td className="border p-2">{index + 1}</td>
                  <td className="border p-2">{item.code || "N/A"}</td>
                  <td className="border p-2">{item.name || "N/A"}</td>
                  <td className="border p-2">{item.description || "N/A"}</td>
                  <td className="border p-2">{item.gst}%</td>
                  <td className="border p-2">{item.qty}</td>
                  <td className="border p-2">{item.units}</td>
                  <td className="border p-2">₹{Number(item.rate).toFixed(2)}</td>
                  {!hiddenColumns?.hideDisc && <td className="border p-2">{item.discount}%</td>}
                  {!hiddenColumns?.hideFlatDisc && <td className="border p-2">₹{Number(item.flatDiscount).toFixed(2)}</td>}
                  <td className="border p-2">₹{Number(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border">
                <td colSpan={(() => {
                  let span = 9; // Base columns: S No, Code, Product Name, Description, GST, Qty, Units, Rate, Amount
                  if (!hiddenColumns?.hideDisc) span += 1;
                  if (!hiddenColumns?.hideFlatDisc) span += 1;
                  return span - 1; // Subtract 1 because Amount column is separate
                })()} className="border p-2 text-right font-bold">
                  Subtotal
                </td>
                <td className="border p-2 font-bold">₹{Number(quotationData.subtotal).toFixed(2)}</td>
              </tr>
              {!hiddenColumns?.hideTotalFlatDisc && (
                <tr className="border">
                  <td colSpan={(() => {
                    let span = 9;
                    if (!hiddenColumns?.hideDisc) span += 1;
                    if (!hiddenColumns?.hideFlatDisc) span += 1;
                    return span - 1;
                  })()} className="border p-2 text-right">
                    Total Flat Discount
                  </td>
                  <td className="border p-2">-₹{Number(quotationData.totalFlatDiscount).toFixed(2)}</td>
                </tr>
              )}
              <tr className="border">
                <td colSpan={(() => {
                  let span = 9;
                  if (!hiddenColumns?.hideDisc) span += 1;
                  if (!hiddenColumns?.hideFlatDisc) span += 1;
                  return span - 1;
                })()} className="border p-2 text-right">
                  Taxable Amount
                </td>
                <td className="border p-2">
                  ₹{Number(quotationData.subtotal - quotationData.totalFlatDiscount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <h3 className="font-bold mb-2">Tax Breakdown</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border">
                  <th className="border p-2 text-left">Tax Type</th>
                  <th className="border p-2 text-left">Rate</th>
                  <th className="border p-2 text-left">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotationData.isIGST ? (
                  <tr className="border">
                    <td className="border p-2">IGST</td>
                    <td className="border p-2">{quotationData.igstRate}%</td>
                    <td className="border p-2">₹{Number(quotationData.igstAmount).toFixed(2)}</td>
                  </tr>
                ) : (
                  <>
                    <tr className="border">
                      <td className="border p-2">CGST</td>
                      <td className="border p-2">{quotationData.cgstRate}%</td>
                      <td className="border p-2">₹{Number(quotationData.cgstAmount).toFixed(2)}</td>
                    </tr>
                    <tr className="border">
                      <td className="border p-2">SGST</td>
                      <td className="border p-2">{quotationData.sgstRate}%</td>
                      <td className="border p-2">₹{Number(quotationData.sgstAmount).toFixed(2)}</td>
                    </tr>
                  </>
                )}
                <tr className="border font-bold">
                  <td className="border p-2">Total Tax</td>
                  <td className="border p-2">
                    {quotationData.isIGST ? quotationData.igstRate : quotationData.cgstRate + quotationData.sgstRate}%
                  </td>
                  <td className="border p-2">
                    ₹
                    {Number(
                      quotationData.isIGST
                        ? quotationData.igstAmount
                        : quotationData.cgstAmount + quotationData.sgstAmount,
                    ).toFixed(2)}
                  </td>
                </tr>
                {!hiddenColumns?.hideSpecialDiscount && (
                  <tr className="border">
                    <td colSpan="2" className="border p-2 text-right">
                      Special Discount
                    </td>
                    <td className="border p-2">-₹{Number(specialDiscount).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="border font-bold">
                  <td colSpan="2" className="border p-2 text-right">
                    Grand Total
                  </td>
                  <td className="border p-2">₹{Number(quotationData.total).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <p className="font-bold">Amount Chargeable (in words)</p>
              <p className="capitalize">
                Rupees{" "}
                {Number(quotationData.total) > 0
                  ? new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                      minimumFractionDigits: 2,
                    })
                      .format(quotationData.total)
                      .replace("₹", "")
                      .trim() + " Only"
                  : "Zero Only"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl">Grand Total: ₹{Number(quotationData.total).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center justify-center p-6 rounded-lg border border-gray-200">
              <img
                src={imageform || "/placeholder.svg?height=200&width=300"}
                alt="ManiQuip Logo"
                className="max-h-100 w-auto object-contain"
              />
            </div>

            <div>
              <h3 className="font-bold mb-2">Terms & Conditions</h3>
              <table className="w-full">
                <tbody>
                  <tr>
                    <td className="py-1 font-medium">Validity</td>
                    <td className="py-1">{quotationData.validity}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium">Payment Terms</td>
                    <td className="py-1">{quotationData.paymentTerms}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium">Delivery</td>
                    <td className="py-1">{quotationData.delivery}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium">Freight</td>
                    <td className="py-1">{quotationData.freight}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium">Insurance</td>
                    <td className="py-1">{quotationData.insurance}</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-medium">Taxes</td>
                    <td className="py-1">{quotationData.taxes}</td>
                  </tr>
                </tbody>
              </table>

              {quotationData.specialOffers &&
                quotationData.specialOffers.filter((offer) => offer.trim()).length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-bold mb-2 text-orange-600">Divine Empire's 10th Anniversary Special Offer</h4>
                    <div className="bg-orange-50 p-3 rounded border border-orange-200">
                      {quotationData.specialOffers
                        .filter((offer) => offer.trim())
                        .map((offer, index) => (
                          <p key={index} className="mb-2 last:mb-0">
                            • {offer}
                          </p>
                        ))}
                    </div>
                  </div>
                )}

              {quotationData.notes && quotationData.notes.filter((note) => note.trim()).length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold mb-2">Notes</h4>
                  <ul className="list-disc pl-5">
                    {quotationData.notes
                      .filter((note) => note.trim())
                      .map((note, index) => (
                        <li key={index} className="py-1">
                          {note}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
          <div>
            <h3 className="font-bold mb-2">Bank Details</h3>
            <p>Account No.: {quotationData.accountNo || "N/A"}</p>
            <p>Bank Name: {quotationData.bankName || "N/A"}</p>
            <p>Bank Address: {quotationData.bankAddress || "N/A"}</p>
            <p>IFSC CODE: {quotationData.ifscCode || "N/A"}</p>
            <p>Email: {quotationData.email || "N/A"}</p>
            <p>Website: {quotationData.website || "N/A"}</p>
            <p>Company PAN: {quotationData.pan || "N/A"}</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold mb-2">Declaration:</h3>
            <p>
              We declare that this Quotation shows the actual price of the goods described and that all particulars are
              true and correct.
            </p>
            <p className="mt-4">Prepared By: {quotationData.preparedBy || "N/A"}</p>
            <p className="mt-4 text-sm italic">
              This Quotation is computer-generated and does not require a seal or signature.
            </p>
          </div>
        </div>
      </div>

      {quotationLink && (
        <div className="p-4 border rounded-md bg-gray-50">
          <p className="font-medium mb-2">Quotation Link:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={quotationLink}
              readOnly
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <button
              className="border border-gray-300 hover:bg-gray-100 p-2 rounded-md"
              onClick={() => {
                navigator.clipboard.writeText(quotationLink)
                alert("Quotation link copied to clipboard")
              }}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
            <button className="border border-gray-300 hover:bg-gray-100 p-2 rounded-md">
              <ShareIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Share this link with the client. They can view and request updates to the quotation.
          </p>
        </div>
      )}

      {pdfUrl && (
        <div className="p-4 border rounded-md bg-gray-50">
          <p className="font-medium mb-2">PDF Document:</p>
          <div className="flex items-center gap-2">
            <input type="text" value={pdfUrl} readOnly className="w-full p-2 border border-gray-300 rounded-md" />
            <button
              className="border border-gray-300 hover:bg-gray-100 p-2 rounded-md"
              onClick={() => {
                navigator.clipboard.writeText(pdfUrl)
                alert("PDF URL copied to clipboard")
              }}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-300 hover:bg-gray-100 p-2 rounded-md"
            >
              <EyeIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-md flex items-center">
          <EyeIcon className="h-4 w-4 mr-2" />
          View as Client
        </button>
        <div className="space-x-2">
          <button
            className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-md flex items-center inline-flex"
            onClick={handleGenerateLink}
            disabled={isGenerating || isSubmitting}
          >
            <ShareIcon className="h-4 w-4 mr-2" />
            Generate Link
          </button>
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center inline-flex"
            onClick={handleGeneratePDF}
            disabled={isGenerating || isSubmitting}
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuotationPreview