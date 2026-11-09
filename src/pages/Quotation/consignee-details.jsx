"use client"

import { getNextQuotationNumber } from "./quotation-service"

const ConsigneeDetails = ({
  quotationData,
  handleInputChange,
  companyOptions,
  dropdownData,
  onQuotationNumberUpdate,
  showLeadNoDropdown,
  setShowLeadNoDropdown,
  leadNoOptions,
  handleLeadNoSelect,
}) => {
  const handleCompanyChange = async (e) => {
    const selectedCompany = e.target.value
    handleInputChange("consigneeName", selectedCompany)

    if (selectedCompany && dropdownData.companies && dropdownData.companies[selectedCompany]) {
      const companyDetails = dropdownData.companies[selectedCompany]

      handleInputChange("consigneeAddress", companyDetails.address)
      handleInputChange("consigneeState", companyDetails.state)
      handleInputChange("consigneeContactName", companyDetails.contactName)
      handleInputChange("consigneeContactNo", companyDetails.contactNo)
      handleInputChange("consigneeGSTIN", companyDetails.gstin)
      handleInputChange("consigneeStateCode", companyDetails.stateCode)

      // Update quotation number (items are only auto-filled via Lead No.
      // selection now — typing a Company Name directly no longer looks up
      // an item list, since that used to come from the retired Google Sheet).
      try {
        const newQuotationNumber = await getNextQuotationNumber()

        if (onQuotationNumberUpdate) {
          onQuotationNumberUpdate(newQuotationNumber)
        }
      } catch (error) {
        console.error("Error updating quotation number:", error)
      }
    } else {
      handleInputChange("consigneeAddress", "")
      handleInputChange("consigneeState", "")
      handleInputChange("consigneeContactName", "")
      handleInputChange("consigneeContactNo", "")
      handleInputChange("consigneeGSTIN", "")
      handleInputChange("consigneeStateCode", "")
    }
  }

  const handleLeadNoChange = (e) => {
    const selectedLeadNo = e.target.value
    if (handleLeadNoSelect) {
      handleLeadNoSelect(selectedLeadNo)
    }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Consignee Details</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLeadNoDropdown(!showLeadNoDropdown)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showLeadNoDropdown ? "Remove" : "Show"} Lead No.
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {showLeadNoDropdown && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            <label className="block text-sm font-medium">Lead No.</label>
            <input
              list="leadNoOptions"
              onChange={handleLeadNoChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Select or type lead number"
            />
            <datalist id="leadNoOptions">
              {leadNoOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Company Name</label>
          <input
            list="companyOptions"
            value={quotationData.consigneeName}
            onChange={handleCompanyChange}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          />
          <datalist id="companyOptions">
            {companyOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Ship Address</label>
          <textarea
            value={quotationData.consigneeAddress}
            onChange={(e) => handleInputChange("consigneeAddress", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Enter address"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Billing Address</label>
          <textarea
            value={quotationData.shipTo || ""}
            onChange={(e) => handleInputChange("shipTo", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Enter shipping address if different from billing address"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">State</label>
          <input
            type="text"
            value={quotationData.consigneeState}
            onChange={(e) => handleInputChange("consigneeState", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter State"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Contact Name</label>
            <input
              type="text"
              value={quotationData.consigneeContactName}
              onChange={(e) => handleInputChange("consigneeContactName", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Contact No.</label>
            <input
              type="text"
              value={quotationData.consigneeContactNo}
              onChange={(e) => handleInputChange("consigneeContactNo", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">GSTIN</label>
            <input
              type="text"
              value={quotationData.consigneeGSTIN}
              onChange={(e) => handleInputChange("consigneeGSTIN", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">State Code</label>
            <input
              type="text"
              value={quotationData.consigneeStateCode}
              onChange={(e) => handleInputChange("consigneeStateCode", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default ConsigneeDetails
