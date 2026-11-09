"use client"

import { useState, useEffect } from "react"
import QuotationDetails from "./quotation-details"
import ConsignorDetails from "./consignor-details"
import ConsigneeDetails from "./consignee-details"
import ItemsTable from "./items-table"
import TermsAndConditions from "./terms and conditions"
import BankDetails from "./bank-details"
import NotesSection from "./notes-section"
import SpecialOfferSection from "./special-offer-section"
import { getNextQuotationNumber } from "./quotation-service"
import { supabase } from "../../lib/supabase/client"
import { ltoSupabase } from "../../lib/supabase/ltoClient"

const QuotationForm = ({
  quotationData,
  handleInputChange,
  handleItemChange,
  handleFlatDiscountChange,
  handleAddItem,
  handleNoteChange,
  addNote,
  removeNote,
  hiddenFields,
  toggleFieldVisibility,
  isRevising,
  existingQuotations,
  selectedQuotation,
  handleSpecialDiscountChange,
  handleQuotationSelect,
  isLoadingQuotation,
  specialDiscount,
  setSpecialDiscount,
  selectedReferences,
  setSelectedReferences,
  imageform,
  addSpecialOffer,
  removeSpecialOffer,
  handleSpecialOfferChange,
  setQuotationData, // ADD THIS LINE
  hiddenColumns,    // ADD THIS LINE
  setHiddenColumns, // ADD THIS LINE
}) => {
  const [dropdownData, setDropdownData] = useState({})
  const [stateOptions, setStateOptions] = useState(["Select State"])
  const [companyOptions, setCompanyOptions] = useState(["Select Company"])
  const [referenceOptions, setReferenceOptions] = useState(["Select Reference"])
  const [preparedByOptions, setPreparedByOptions] = useState([""])
  const [productCodes, setProductCodes] = useState([])
  const [productNames, setProductNames] = useState([])
  const [productData, setProductData] = useState({})
  const [isItemsLoading, setIsItemsLoading] = useState(false);

  // Lead number (TN-xxx ticket) states
  const [showLeadNoDropdown, setShowLeadNoDropdown] = useState(false)
  const [leadNoOptions, setLeadNoOptions] = useState(["Select Lead No."])
  const [leadNoData, setLeadNoData] = useState({})

  // "Unconditional" master data — consignor state list, reference names and
  // prepared-by list — sourced live from the production Lead-To-Order-Supabase-New
  // project, mirroring that project's own quotation-form.jsx queries exactly.
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const stateOptionsData = ["Select State"]
        const stateDetailsMap = {}
        const referenceOptionsData = ["Select Reference"]
        const referenceDetailsMap = {}
        const preparedByOptionsData = [""]

        const [consignorRes, referenceRes, preparedByRes] = await Promise.all([
          ltoSupabase
            .from("lto_consignor_details")
            .select("state, state_code, address, gstin, msme_num, pan_num"),
          ltoSupabase.from("lto_dropdown").select("value").eq("category", "reference"),
          ltoSupabase.from("lto_dropdown").select("value").eq("category", "prepared_by"),
        ])

        if (consignorRes.error) throw consignorRes.error
        ;(consignorRes.data || []).forEach((row) => {
          const stateName = row.state || ""
          if (stateName && !stateOptionsData.includes(stateName)) {
            stateOptionsData.push(stateName)
            stateDetailsMap[stateName] = {
              consignerAddress: row.address || "",
              stateCode: row.state_code || "",
              gstin: row.gstin || "",
              msmeNumber: row.msme_num || "",
            }
          }
        })

        if (referenceRes.error) throw referenceRes.error
        ;(referenceRes.data || []).forEach(({ value }) => {
          if (!value) return
          // Stored as "Name — Number"
          const [name, ...rest] = String(value).split("—").map((part) => part.trim())
          const contact = rest.join("—").trim()
          if (name && !referenceOptionsData.includes(name)) {
            referenceOptionsData.push(name)
            referenceDetailsMap[name] = { mobile: contact, phone: contact }
          }
        })

        if (preparedByRes.error) throw preparedByRes.error
        ;(preparedByRes.data || []).forEach(({ value }) => {
          if (value && !preparedByOptionsData.includes(value)) {
            preparedByOptionsData.push(value)
          }
        })

        setStateOptions(stateOptionsData)
        setReferenceOptions(referenceOptionsData)
        setPreparedByOptions(preparedByOptionsData)
        setDropdownData((prev) => ({
          ...prev,
          states: stateDetailsMap,
          references: referenceDetailsMap,
        }))
      } catch (error) {
        console.error("Error fetching master data from production project:", error)
      }
    }

    fetchMasterData()
  }, [])

  // Bank details — a single static company-wide row in production, not tied
  // to the selected state (matches lto_bank_details / Lead-To-Order's own
  // bank-details.jsx). Fetched once on mount.
  useEffect(() => {
    const fetchBankDetails = async () => {
      try {
        const { data, error } = await ltoSupabase
          .from("lto_bank_details")
          .select("*")
          .limit(1)
          .maybeSingle()

        if (error) throw error
        if (data) {
          handleInputChange("accountNo", data.account_no || "")
          handleInputChange("bankName", data.bank_name || "")
          handleInputChange("bankAddress", data.bank_address || "")
          handleInputChange("ifscCode", data.ifsc_code || "")
          handleInputChange("email", data.email || "")
          handleInputChange("website", data.website || "")
          handleInputChange("pan", data.pan || "")
        }
      } catch (error) {
        console.error("Error fetching bank details from production project:", error)
      }
    }

    fetchBankDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Company Name datalist (consignee) — sourced from this project's own
  // tickets table so it stays consistent with the Lead No. source below.
  useEffect(() => {
    const fetchCompanyOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("inbound_tickets")
          .select("company_name, site_address, client_name, phone_number, gst_no, created_at")
          .order("created_at", { ascending: false })
          .limit(500)

        if (error) throw error

        const companyOptionsData = ["Select Company"]
        const companyDetailsMap = {}
        ;(data || []).forEach((row) => {
          const name = row.company_name
          if (!name || companyDetailsMap[name]) return
          companyOptionsData.push(name)
          companyDetailsMap[name] = {
            address: row.site_address || "",
            state: "",
            contactName: row.client_name || "",
            contactNo: row.phone_number || "",
            gstin: row.gst_no || "",
            stateCode: "",
          }
        })

        setCompanyOptions(companyOptionsData)
        setDropdownData((prev) => ({ ...prev, companies: companyDetailsMap }))
      } catch (error) {
        console.error("Error fetching company list from tickets:", error)
      }
    }

    fetchCompanyOptions()
  }, [])

  // Lead No. (TN-xxx) list — this project's own tickets table (TN-xxx tickets
  // only ever exist here, never in the production project).
  useEffect(() => {
    const fetchLeadNumbers = async () => {
      try {
        const { data, error } = await supabase
          .from("inbound_tickets")
          .select("ticket_id, uuid, company_name, site_address, gst_no, client_name, phone_number, created_at")
          .order("created_at", { ascending: false })
          .limit(300)

        if (error) throw error

        const leadNoOptionsData = ["Select Lead No."]
        const leadNoDataMap = {}
        ;(data || []).forEach((row) => {
          const leadNo = row.ticket_id
          if (!leadNo || leadNoDataMap[leadNo]) return
          leadNoOptionsData.push(leadNo)
          leadNoDataMap[leadNo] = {
            ticketUuid: row.uuid,
            ticketId: row.ticket_id,
            companyName: row.company_name || "",
            address: row.site_address || "",
            contactName: row.client_name || "",
            contactNo: row.phone_number || "",
            gstin: row.gst_no || "",
          }
        })

        setLeadNoOptions(leadNoOptionsData)
        setLeadNoData(leadNoDataMap)
      } catch (error) {
        console.error("Error fetching tickets for Lead No.:", error)
      }
    }

    fetchLeadNumbers()
  }, [])

  const handleSpecialDiscountChangeWrapper = (value) => {
    const discount = Number(value) || 0
    setSpecialDiscount(discount)
    handleSpecialDiscountChange(discount)
  }

  // Product master — lto_items (+ its 'basic' lto_item_specs row for rate /
  // technical specs), paginated 500 rows/page.
  useEffect(() => {
    const fetchProductData = async () => {
      try {
        const codes = ["Select Code"]
        const names = ["Select Product"]
        const productDataMap = {}
        const step = 500
        let from = 0
        let keepGoing = true

        while (keepGoing) {
          const res = await ltoSupabase
            .from("lto_items")
            .select("item_code, item_name, lto_item_specs(rate, technical_specs)")
            .eq("lto_item_specs.type", "basic")
            .order("item_name", { ascending: true })
            .range(from, from + step - 1)

          if (res.error) throw res.error

          const rows = res.data || []
          rows.forEach((item) => {
            const basic = (item.lto_item_specs && item.lto_item_specs[0]) || {}
            const row = { ...item, description: basic.technical_specs, rate: basic.rate }
            const code = row.item_code
            const name = row.item_name
            if (!name) return

            if (code && !codes.includes(code)) codes.push(code)
            if (!names.includes(name)) names.push(name)

            const entry = {
              name,
              code: code || "",
              description: row.description || "",
              rate: row.rate || 0,
            }
            if (code) productDataMap[code] = entry
            productDataMap[name] = entry
          })

          keepGoing = rows.length === step
          from += step
        }

        setProductCodes(codes)
        setProductNames(names)
        setProductData(productDataMap)
      } catch (error) {
        console.error("Error fetching product master from production project:", error)
      }
    }

    fetchProductData()
  }, [])

  // Function to handle quotation number updates
  const handleQuotationNumberUpdate = (newQuotationNumber) => {
    handleInputChange("quotationNo", newQuotationNumber)
  }

  // NEW: Handle lead number (TN-xxx ticket) selection and autofill
  const handleLeadNoSelect = async (selectedLeadNo) => {
    if (!selectedLeadNo || selectedLeadNo === "Select Lead No." || !leadNoData[selectedLeadNo]) {
      return
    }

    setIsItemsLoading(true)

    const leadData = leadNoData[selectedLeadNo]
    const companyName = leadData.companyName

    // Fill consignee details from the ticket
    handleInputChange("consigneeName", companyName)
    handleInputChange("consigneeAddress", leadData.address)
    handleInputChange("consigneeContactName", leadData.contactName)
    handleInputChange("consigneeContactNo", leadData.contactNo)
    handleInputChange("consigneeGSTIN", leadData.gstin)
    // tickets doesn't store a consignee state — left for manual entry.

    // Tag this quotation with the ticket it was built for (nullable FK,
    // written on save in MakeQuotation.jsx).
    handleInputChange("linkedTicketUuid", leadData.ticketUuid || "")

    // Regenerate the quotation number (Supabase-based generator — the ticket
    // has no company-prefix concept, so use the default prefix).
    try {
      const newQuotationNumber = await getNextQuotationNumber()
      handleInputChange("quotationNo", newQuotationNumber)
    } catch (error) {
      console.error("Error updating quotation number from lead selection:", error)
    }

    setIsItemsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <QuotationDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            isRevising={isRevising}
            existingQuotations={existingQuotations}
            selectedQuotation={selectedQuotation}
            handleQuotationSelect={handleQuotationSelect}
            isLoadingQuotation={isLoadingQuotation}
            preparedByOptions={preparedByOptions}
            stateOptions={stateOptions}
            dropdownData={dropdownData}
          />

          <ConsignorDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            referenceOptions={referenceOptions}
            selectedReferences={selectedReferences}
            setSelectedReferences={setSelectedReferences}
            dropdownData={dropdownData}
          />
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <ConsigneeDetails
            quotationData={quotationData}
            handleInputChange={handleInputChange}
            companyOptions={companyOptions}
            dropdownData={dropdownData}
            onQuotationNumberUpdate={handleQuotationNumberUpdate}
            showLeadNoDropdown={showLeadNoDropdown}
            setShowLeadNoDropdown={setShowLeadNoDropdown}
            leadNoOptions={leadNoOptions}
            handleLeadNoSelect={handleLeadNoSelect}
          />
        </div>
      </div>

      <ItemsTable
        quotationData={quotationData}
        handleItemChange={handleItemChange}
        handleAddItem={handleAddItem}
        handleSpecialDiscountChange={handleSpecialDiscountChangeWrapper}
        specialDiscount={specialDiscount}
        setSpecialDiscount={setSpecialDiscount}
        productCodes={productCodes}
        productNames={productNames}
        productData={productData}
        setQuotationData={setQuotationData}
        isLoading={isItemsLoading}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
      />

      <TermsAndConditions
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        hiddenFields={hiddenFields}
        toggleFieldVisibility={toggleFieldVisibility}
      />

      <SpecialOfferSection
        quotationData={quotationData}
        handleInputChange={handleInputChange}
        addSpecialOffer={addSpecialOffer}
        removeSpecialOffer={removeSpecialOffer}
        handleSpecialOfferChange={handleSpecialOfferChange}
      />

      <NotesSection
        quotationData={quotationData}
        handleNoteChange={handleNoteChange}
        addNote={addNote}
        removeNote={removeNote}
      />

      <BankDetails quotationData={quotationData} handleInputChange={handleInputChange} imageform={imageform} />
    </div>
  )
}

export default QuotationForm
