"use client"
import { useState, useEffect } from "react"


const QuotationDetails = ({
  quotationData,
  handleInputChange,
  isRevising,
  existingQuotations,
  selectedQuotation,
  handleQuotationSelect,
  isLoadingQuotation,
  preparedByOptions,
  stateOptions,
  dropdownData,
}) => {
  const [localSearch, setLocalSearch] = useState(selectedQuotation || "")

  useEffect(() => {
    setLocalSearch(selectedQuotation || "")
  }, [selectedQuotation])

  const handleSearchChange = (e) => {
    const val = e.target.value
    setLocalSearch(val)
    if (existingQuotations.includes(val)) {
      handleQuotationSelect(val)
    } else if (val === "") {
      handleQuotationSelect("")
    }
  }

  const handleStateChange = (e) => {
    const selectedState = e.target.value
    handleInputChange("consignorState", selectedState)

    // Bank details are a single company-wide row (fetched once, independent
    // of state — see quotation-form.jsx's fetchBankDetails), so state
    // selection only fills the consignor's own address/GSTIN/MSME details.
    if (selectedState && dropdownData.states && dropdownData.states[selectedState]) {
      const stateDetails = dropdownData.states[selectedState]

      if (stateDetails.consignerAddress) {
        handleInputChange("consignorAddress", stateDetails.consignerAddress)
      }

      if (stateDetails.stateCode) {
        handleInputChange("consignorStateCode", stateDetails.stateCode)
      }

      if (stateDetails.gstin) {
        handleInputChange("consignorGSTIN", stateDetails.gstin)
      }

      if (stateDetails.msmeNumber) {
        handleInputChange("msmeNumber", stateDetails.msmeNumber)
      }
    } else {
      handleInputChange("consignorAddress", "")
      handleInputChange("consignorStateCode", "")
      handleInputChange("consignorGSTIN", "")
      handleInputChange("msmeNumber", "")
    }
  }

  return (
    <>
      <h3 className="text-lg font-medium mb-4">Quotation Details</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Quotation No.</label>
            {isRevising ? (
              <div className="flex items-center">
                <input
                  type="text"
                  list="quotationList"
                  value={localSearch}
                  onChange={handleSearchChange}
                  placeholder="Search and Select Quotation"
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
                <datalist id="quotationList">
                  {existingQuotations && existingQuotations.length > 0 ? (
                    existingQuotations.map((quotation, index) => (
                      <option key={`${quotation}-${index}`} value={quotation} />
                    ))
                  ) : null}
                </datalist>
                {isLoadingQuotation && (
                  <div className="ml-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={quotationData.quotationNo}
                readOnly
                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Date</label>
            <input
              type="date"
              value={quotationData.date.split("/").reverse().join("-")}
              onChange={(e) => {
                const dateValue = e.target.value
                if (dateValue) {
                  const [year, month, day] = dateValue.split("-")
                  handleInputChange("date", `${day}/${month}/${year}`)
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Prepared By</label>
          <input
            type="text"
            list="preparedByList"
            value={quotationData.preparedBy}
            onChange={(e) => handleInputChange("preparedBy", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter or select the name of the person preparing this quotation"
            required
          />
          <datalist id="preparedByList">
            {preparedByOptions.map((name, idx) => (
              <option key={idx} value={name} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">State</label>
          <select
            value={quotationData.consignorState}
            onChange={handleStateChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            {stateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}

export default QuotationDetails
