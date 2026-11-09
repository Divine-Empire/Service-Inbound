"use client"

const TermsAndConditions = ({ quotationData, handleInputChange, hiddenFields, toggleFieldVisibility }) => {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-medium mb-4">Terms & Conditions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries({
          validity: "Validity",
          paymentTerms: "Payment Terms",
          scopOfWork: "Scope of Work",
          visitTravel: "Visit & Travel",
          siteReadness: "Site Readiness",
          ObservationAndFixing: "Observation & Fixing",
          Safety_Compliance: "Safety Compliance",
          GST_Taxes: "GST & Taxes",
          Parts_Availability: "Parts Availability",
          Delays_Rescheduling: "Delays & Rescheduling",
        }).map(([field, label]) => (
          <div key={field} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium">{label}</label>
              <button
                type="button"
                onClick={() => toggleFieldVisibility(field)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {hiddenFields[field] ? "Show" : "Hide"}
              </button>
            </div>
            {!hiddenFields[field] && (
              <input
                type="text"
                value={quotationData[field] || ""}
                onChange={(e) => handleInputChange(field, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TermsAndConditions
