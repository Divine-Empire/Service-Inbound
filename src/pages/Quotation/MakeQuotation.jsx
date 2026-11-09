"use client";

import { useState, useEffect } from "react";
import { Download as DownloadIcon, Save as SaveIcon, Share2 as ShareIcon } from "lucide-react";
import image1 from "../../assets/WhatsApp Image 2025-05-14 at 4.11.43 PM.jpeg";
import imageform from "../../assets/WhatsApp Image 2025-05-14 at 4.11.54 PM.jpeg";
import QuotationHeader from "./quotation-header";
import QuotationForm from "./quotation-form";
import QuotationPreview from "./quotation-preview";
import { generatePDFFromData } from "./pdf-generator";
import { getNextQuotationNumber } from "./quotation-service";
import { useQuotationData } from "./use-quotation-data";
import { supabase } from "../../lib/supabase/client";

// `ticket` (optional): the Quotation-stage row this was opened from. It pre-fills the consignee
// block and links the saved quotation to the ticket — the same fields the form's Lead No. picker sets.
function MakeQuotation({ ticket = null }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotationLink, setQuotationLink] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [existingQuotations, setExistingQuotations] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState("");
  const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);
  const [specialDiscount, setSpecialDiscount] = useState(0);
  const [selectedReferences, setSelectedReferences] = useState([]);

  // NEW: Add hidden columns state
  const [hiddenColumns, setHiddenColumns] = useState({
    hideDisc: false,
    hideFlatDisc: false,
    hideTotalFlatDisc: false,
    hideSpecialDiscount: false,
  });

  // Check if we're in view mode
  const params = new URLSearchParams(window.location.search);
  const isViewMode = params.has("view");

  // Use the custom hook for quotation data
  const {
    quotationData,
    setQuotationData,
    handleInputChange,
    handleItemChange,
    handleFlatDiscountChange,
    handleSpecialDiscountChange,
    handleAddItem,
    handleNoteChange,
    addNote,
    removeNote,
    hiddenFields,
    toggleFieldVisibility,
    addSpecialOffer,
    removeSpecialOffer,
    handleSpecialOfferChange,
  } = useQuotationData(specialDiscount);

  const handleSpecialDiscountChangeWrapper = (value) => {
    const discount = Number(value) || 0;
    setSpecialDiscount(discount);
    handleSpecialDiscountChange(discount);
  };

  // Fetch existing quotations when component mounts or when revising
  useEffect(() => {
    const fetchExistingQuotations = async () => {
      try {
        const { data, error } = await supabase
          .from("inbound_make_quotations")
          .select("quotation_no")
          .order("created_at", { ascending: false });

        if (error) throw error;

        setExistingQuotations((data || []).map((row) => row.quotation_no));
      } catch (error) {
        console.error("Error fetching quotation numbers:", error);
        setExistingQuotations([]);
      }
    };

    fetchExistingQuotations();

    if (isRevising) {
      fetchExistingQuotations();
    }
  }, [isRevising]);

  // Initialize quotation number
  useEffect(() => {
    const initializeQuotationNumber = async () => {
      try {
        const nextQuotationNumber = await getNextQuotationNumber();
        setQuotationData((prev) => ({
          ...prev,
          quotationNo: nextQuotationNumber,
        }));
      } catch (error) {
        console.error("Error initializing quotation number:", error);
      }
    };

    initializeQuotationNumber();
  }, [setQuotationData]);

  // Pre-fill from the ticket this was opened for (consignee state has no ticket source).
  useEffect(() => {
    if (!ticket?.ticketId) return;
    setQuotationData((prev) => ({
      ...prev,
      companyName: prev.companyName || ticket.companyName || "",
      consigneeName: ticket.companyName || prev.consigneeName,
      consigneeAddress: ticket.siteAddress || prev.consigneeAddress,
      consigneeContactName: ticket.clientName || prev.consigneeContactName,
      consigneeContactNo: ticket.phoneNumber || prev.consigneeContactNo,
      consigneeGSTIN: ticket.gstNo || prev.consigneeGSTIN,
      linkedTicketUuid: ticket.ticketUuid || prev.linkedTicketUuid,
    }));
  }, [ticket, setQuotationData]);

  // Load quotation data from URL if in view mode
  useEffect(() => {
    const viewId = params.get("view");

    if (viewId) {
      const savedQuotation = localStorage.getItem(viewId);

      if (savedQuotation) {
        try {
          const parsedData = JSON.parse(savedQuotation);
          setQuotationData(parsedData);
          setActiveTab("preview");
        } catch (error) {
          console.error("Error loading quotation data:", error);
        }
      }
    }
  }, [setQuotationData]);

  const toggleRevising = () => {
    const newIsRevising = !isRevising;
    setIsRevising(newIsRevising);

    if (newIsRevising) {
      setSelectedQuotation("");
    }
  };

  // Helper function to check if IGST should be applied
  const checkShouldUseIGST = (consignorState, consigneeState) => {
    if (!consignorState || !consigneeState) return false;
    return consignorState.toLowerCase().trim() !== consigneeState.toLowerCase().trim();
  };

  const handleQuotationSelect = async (quotationNo) => {
    if (!quotationNo) return;

    setIsLoadingQuotation(true);
    setSelectedQuotation(quotationNo);

    try {
      const { data: header, error: headerError } = await supabase
        .from("inbound_make_quotations")
        .select("*")
        .eq("quotation_no", quotationNo)
        .single();

      if (headerError) throw headerError;

      const { data: itemRows, error: itemsError } = await supabase
        .from("inbound_quotation_items")
        .select("*")
        .eq("quotation_no", quotationNo);

      if (itemsError) throw itemsError;

      {
        const loadedData = {
          quotationNo: header.quotation_no,
          date: header.quotation_date || "",
          preparedBy: header.prepared_by || "",
          consignorState: header.consignor_state || "",
          consignorName: header.consignor_name || "",
          consignorAddress: header.consignor_address || "",
          consignorMobile: header.consignor_mobile || "",
          consignorPhone: header.consignor_phone || "",
          consignorGSTIN: header.consignor_gstin || "",
          consignorStateCode: header.consignor_state_code || "",
          consigneeName: header.consignee_name || "",
          consigneeAddress: header.consignee_address || "",
          shipTo: header.ship_to || "",
          consigneeState: header.consignee_state || "",
          consigneeContactName: header.consignee_contact_name || "",
          consigneeContactNo: header.consignee_contact_no || "",
          consigneeGSTIN: header.consignee_gstin || "",
          consigneeStateCode: header.consignee_state_code || "",
          msmeNumber: header.msme_number || "",
          validity: header.validity || "",
          paymentTerms: header.payment_terms || "",
          delivery: header.delivery || "",
          freight: header.freight || "",
          insurance: header.insurance || "",
          taxes: header.taxes || "",
          notes: header.notes || "",
          accountNo: header.account_no || "",
          bankName: header.bank_name || "",
          bankAddress: header.bank_address || "",
          ifscCode: header.ifsc_code || "",
          email: header.email || "",
          website: header.website || "",
          pan: header.pan || "",
          specialOffers: header.special_offers || "",
          specialDiscount: header.special_discount || 0,
          // Carry the original quotation's ticket link forward into the
          // revision — without this, every revision saves with
          // ticket_uuid = null and never shows up in Quotation.jsx's
          // Quotation No. dropdown (which filters by ticket_uuid).
          linkedTicketUuid: header.ticket_uuid || "",
          items: (itemRows || []).map((item) => ({
            code: item.code || "",
            name: item.name || "",
            description: item.description || "",
            gst: item.gst,
            qty: item.qty,
            units: item.units || "Nos",
            rate: item.rate,
            discount: item.discount,
            flatDiscount: item.flat_discount,
            amount: item.amount,
          })),
        };

        const references = loadedData.consignorName
          ? loadedData.consignorName
            .split(",")
            .map((r) => r.trim())
            .filter((r) => r)
          : [];
        setSelectedReferences(references);

        let items = [];
        const specialDiscountFromItems = loadedData.specialDiscount || 0;

        if (
          loadedData.items &&
          Array.isArray(loadedData.items) &&
          loadedData.items.length > 0
        ) {
          items = loadedData.items.map((item, index) => ({
            id: index + 1,
            code: item.code || "",
            name: item.name || "",
            description: item.description || "",
            gst: String(item.gst) || "",
            units: item.units || "Nos",
            rate: Number(item.rate) || 0,
            discount: Number(item.discount) || 0,
            flatDiscount: Number(item.flatDiscount) || 0,
            amount: Number(item.amount) || 0,
            qty: Number(item.qty) || 0,

          }));
        }

        const subtotal = items.reduce(
          (sum, item) => sum + Number(item.amount),
          0
        );
        const totalFlatDiscount = Number(loadedData.totalFlatDiscount) || 0;
        const cgstRate = Number(loadedData.cgstRate) || 9;
        const sgstRate = Number(loadedData.sgstRate) || 9;
        const igstRate = Number(loadedData.igstRate) || 18;
        // const taxableAmount = Math.max(0, subtotal - totalFlatDiscount);
        // const cgstAmount = Number(
        //   (taxableAmount * (cgstRate / 100)).toFixed(2)
        // );
        // const sgstAmount = Number(
        //   (taxableAmount * (sgstRate / 100)).toFixed(2)
        // );
        // const total = Number(
        //   (
        //     taxableAmount +
        //     cgstAmount +
        //     sgstAmount -
        //     specialDiscountFromItems
        //   ).toFixed(2)
        // );
        const taxableAmount = Math.max(0, subtotal - totalFlatDiscount);
        const shouldUseIGST = checkShouldUseIGST(loadedData.consignorState, loadedData.consigneeState);

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let total = 0;

        if (shouldUseIGST) {
          igstAmount = Number((taxableAmount * (igstRate / 100)).toFixed(2));
          total = Number((taxableAmount + igstAmount - specialDiscountFromItems).toFixed(2));
        } else {
          cgstAmount = Number((taxableAmount * (cgstRate / 100)).toFixed(2));
          sgstAmount = Number((taxableAmount * (sgstRate / 100)).toFixed(2));
          total = Number((taxableAmount + cgstAmount + sgstAmount - specialDiscountFromItems).toFixed(2));
        }

        // Parse special offers from loaded data
        let specialOffers = [""];
        if (loadedData.specialOffers) {
          if (typeof loadedData.specialOffers === "string") {
            // If it's a string, split by delimiter
            specialOffers = loadedData.specialOffers
              .split("|")
              .filter((offer) => offer.trim());
            if (specialOffers.length === 0) specialOffers = [""];
          } else if (Array.isArray(loadedData.specialOffers)) {
            specialOffers = loadedData.specialOffers;
          }
        }

        setQuotationData({
          ...loadedData,
          items,
          subtotal,
          totalFlatDiscount,
          cgstRate,
          sgstRate,
          igstRate: Number(loadedData.igstRate) || 18,
          isIGST: shouldUseIGST,
          cgstAmount,
          sgstAmount,
          igstAmount,
          total,
          accountNo: loadedData.accountNo || "",
          bankName: loadedData.bankName || "",
          bankAddress: loadedData.bankAddress || "",
          ifscCode: loadedData.ifscCode || "",
          email: loadedData.email || "",
          website: loadedData.website || "",
          pan: loadedData.pan || "",
          consignorState: loadedData.consignorState || "",
          consignorName: loadedData.consignorName || "",
          consignorAddress: loadedData.consignorAddress || "",
          consignorMobile: loadedData.consignorMobile || "",
          consignorPhone: loadedData.consignorPhone || "",
          consignorGSTIN: loadedData.consignorGSTIN || "",
          consignorStateCode: loadedData.consignorStateCode || "",
          consigneeName: loadedData.consigneeName || "",
          consigneeAddress: loadedData.consigneeAddress || "",
          shipTo: loadedData.shipTo || "",
          consigneeState: loadedData.consigneeState || "",
          consigneeContactName: loadedData.consigneeContactName || "",
          consigneeContactNo: loadedData.consigneeContactNo || "",
          consigneeGSTIN: loadedData.consigneeGSTIN || "",
          consigneeStateCode: loadedData.consigneeStateCode || "",
          msmeNumber: loadedData.msmeNumber || "",
          preparedBy: loadedData.preparedBy || "",
          specialOffers: specialOffers,
          notes: Array.isArray(loadedData.notes)
            ? loadedData.notes
            : loadedData.notes
              ? [loadedData.notes]
              : [""],
        });

        setSpecialDiscount(specialDiscountFromItems);
      }
    } catch (error) {
      console.error("Error fetching quotation data:", error);
      alert("Failed to load quotation data");
    } finally {
      setIsLoadingQuotation(false);
    }
  };



  const handleGeneratePDF = async () => {
    setIsGenerating(true);

    try {
      // const base64Data = await generatePDFFromData(
      //   quotationData,
      //   selectedReferences,
      //   specialDiscount,
      //   hiddenColumns
      // );

      const pdfDataUri = await generatePDFFromData(
        quotationData,
        selectedReferences,
        specialDiscount,
        hiddenColumns
      );
      const base64Data = pdfDataUri.split(",")[1];

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Quotation_${quotationData.quotationNo}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(link.href);

      setIsGenerating(false);
      alert("PDF generated and downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF: " + error.message);
      setIsGenerating(false);
    }
  };

  // NOTE: This used to upload the PDF via a separate Apps Script deployment
  // (VITE_QUOTATION_EMAIL_API) and send it by email from there. That's
  // unlinked now — real email sending needs a Supabase Edge Function + email
  // provider, a separate infra decision. This now just uploads the PDF to
  // Supabase Storage (same "inbound_enquiry" bucket / make_quotation folder
  // handleSaveQuotation already uses) and hands back a permanent link to
  // share manually.
  const handleGenerateLink = async () => {
    setIsGenerating(true);

    try {
      const pdfDataUri = await generatePDFFromData(
        quotationData,
        selectedReferences,
        specialDiscount,
        hiddenColumns
      );
      const base64Data = pdfDataUri.split(",")[1];

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const pdfBlob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });

      const pdfFileName = `Quotation_${quotationData.quotationNo}_${Date.now()}.pdf`;
      const storagePath = `make_quotation/${pdfFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inbound_enquiry")
        .upload(storagePath, pdfBlob, { contentType: "application/pdf" });

      if (uploadError) {
        throw new Error("Failed to upload PDF: " + uploadError.message);
      }

      const { data: pdfUrlData } = supabase.storage
        .from("inbound_enquiry")
        .getPublicUrl(storagePath);
      const permanentPdfUrl = pdfUrlData.publicUrl;

      // Create local storage link (for your own reference)
      const quotationId = `quotation_${Date.now()}`;
      localStorage.setItem(quotationId, JSON.stringify(quotationData));
      const localLink = `${window.location.origin}${window.location.pathname}?view=${quotationId}`;

      setQuotationLink(localLink);
      setPdfUrl(permanentPdfUrl);
      setIsGenerating(false);

      alert(
        `Quotation link generated.\n\n` +
        `🔗 Your reference link: ${localLink}\n` +
        `📎 PDF: ${permanentPdfUrl}\n\n` +
        `Share these links manually — automated emailing isn't wired up yet.`
      );
    } catch (error) {
      console.error("Error generating link:", error);
      alert("Failed to generate link: " + error.message);
      setIsGenerating(false);
    }
  };

  const handleSaveQuotation = async () => {
    if (!quotationData.consigneeName) {
      alert("Please select a company name");
      return;
    }

    if (!quotationData.preparedBy) {
      alert("Please enter prepared by name");
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate grand total
      const taxableAmount = Math.max(
        0,
        quotationData.subtotal - quotationData.totalFlatDiscount
      );
      let grandTotal = 0;

      if (quotationData.isIGST) {
        const igstAmt = taxableAmount * (quotationData.igstRate / 100);
        grandTotal = taxableAmount + igstAmt - (Number(specialDiscount) || 0);
      } else {
        const cgstAmt = taxableAmount * (quotationData.cgstRate / 100);
        const sgstAmt = taxableAmount * (quotationData.sgstRate / 100);
        grandTotal =
          taxableAmount + cgstAmt + sgstAmt - (Number(specialDiscount) || 0);
      }

      const finalGrandTotal = Math.max(0, grandTotal).toFixed(2);
      // const base64Data = await generatePDFFromData(
      //   quotationData,
      //   selectedReferences,
      //   specialDiscount,
      //   hiddenColumns
      // );

      // The new revision number must be known BEFORE the PDF is rendered:
      // the PDF prints its own "Quo No" (generator prefers finalQuotationNo).
      // Computing it afterwards made every revision's PDF show the PREVIOUS
      // revision's number (file -06 contained "Quo No: ...-05").
      let finalQuotationNo = quotationData.quotationNo;
      // Re-read straight from the root row being revised, rather than
      // trusting quotationData.linkedTicketUuid — that's only as fresh as
      // whatever handleQuotationSelect populated it with when "Revise" was
      // first clicked, and nothing re-syncs it afterward if the user edits
      // fields in between. selectedQuotation (the original quotation_no)
      // is untouched by those edits, so re-fetching from it guarantees the
      // new revision row always carries the SAME ticket_uuid as its root.
      let revisionTicketUuid = null;
      if (isRevising && selectedQuotation) {
        // Find the base quotation number (remove existing -XX suffix if present)
        let baseQuotationNo = selectedQuotation;
        if (baseQuotationNo.match(/-\d{2}$/)) {
          baseQuotationNo = baseQuotationNo.replace(/-\d{2}$/, "");
        }

        // Query the DB to find the highest suffix for this base quotation
        const { data: revisions, error: revError } = await supabase
          .from("inbound_make_quotations")
          .select("quotation_no")
          .like("quotation_no", `${baseQuotationNo}%`);

        let maxRevision = 0;
        if (!revError && revisions) {
          revisions.forEach((rev) => {
            const match = rev.quotation_no.match(/-\d{2}$/);
            if (match && rev.quotation_no.startsWith(baseQuotationNo + "-")) {
              const revNum = parseInt(match[0].replace("-", ""), 10);
              if (revNum > maxRevision) {
                maxRevision = revNum;
              }
            }
          });
        }

        const newRevision = (maxRevision + 1).toString().padStart(2, "0");
        finalQuotationNo = `${baseQuotationNo}-${newRevision}`;

        const { data: rootRow, error: rootRowError } = await supabase
          .from("inbound_make_quotations")
          .select("ticket_uuid")
          .eq("quotation_no", selectedQuotation)
          .single();

        if (rootRowError) {
          console.error("Error re-fetching root quotation's ticket_uuid:", rootRowError);
        }
        revisionTicketUuid = rootRow?.ticket_uuid || null;
      }

      const pdfDataUri = await generatePDFFromData(
        { ...quotationData, finalQuotationNo },
        selectedReferences,
        specialDiscount,
        hiddenColumns
      );
      const base64Data = pdfDataUri.split(",")[1];

      const fileName = `Quotation_${finalQuotationNo}_${Date.now()}.pdf`;

      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const pdfBlob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });

      const { error: uploadError } = await supabase.storage
        .from("inbound_enquiry")
        .upload(`make_quotation/${fileName}`, pdfBlob, { contentType: "application/pdf" });

      if (uploadError) {
        throw new Error("Failed to upload PDF: " + uploadError.message);
      }

      const { data: pdfUrlData } = supabase.storage
        .from("inbound_enquiry")
        .getPublicUrl(`make_quotation/${fileName}`);
      const pdfUrl = pdfUrlData.publicUrl;

      const { error: headerError } = await supabase.from("inbound_make_quotations").insert({
        quotation_no: finalQuotationNo,
        quotation_date: quotationData.date,
        prepared_by: quotationData.preparedBy,
        consignor_state: quotationData.consignorState,
        consignor_name: quotationData.consignorName,
        consignor_address: quotationData.consignorAddress,
        consignor_mobile: quotationData.consignorMobile,
        consignor_phone: quotationData.consignorPhone,
        consignor_gstin: quotationData.consignorGSTIN,
        consignor_state_code: quotationData.consignorStateCode,
        consignee_name: quotationData.consigneeName,
        consignee_address: quotationData.consigneeAddress,
        ship_to: quotationData.shipTo || quotationData.consigneeAddress,
        consignee_state: quotationData.consigneeState,
        consignee_contact_name: quotationData.consigneeContactName,
        consignee_contact_no: quotationData.consigneeContactNo,
        consignee_gstin: quotationData.consigneeGSTIN,
        consignee_state_code: quotationData.consigneeStateCode,
        msme_number: quotationData.msmeNumber,
        validity: quotationData.validity,
        payment_terms: quotationData.paymentTerms,
        delivery: quotationData.delivery,
        freight: quotationData.freight,
        insurance: quotationData.insurance,
        taxes: quotationData.taxes,
        notes: quotationData.notes.filter((note) => note.trim()).join("|"),
        account_no: quotationData.accountNo,
        bank_name: quotationData.bankName,
        bank_address: quotationData.bankAddress,
        ifsc_code: quotationData.ifscCode,
        email: quotationData.email,
        website: quotationData.website,
        pan: quotationData.pan,
        special_offers: quotationData.specialOffers
          ? quotationData.specialOffers.filter((offer) => offer.trim()).join("|")
          : "",
        special_discount: Number(specialDiscount) || 0,
        pdf_url: pdfUrl,
        grand_total: Number(finalGrandTotal),
        // Revisions always inherit their root's ticket_uuid (re-fetched
        // above, not trusted from form state); a brand-new quotation uses
        // whatever linkedTicketUuid the Lead No./ticket prop flow set.
        ticket_uuid: (isRevising && selectedQuotation)
          ? revisionTicketUuid
          : (quotationData.linkedTicketUuid || null),
      });

      if (headerError) {
        throw new Error("Error saving quotation: " + headerError.message);
      }

      const itemRows = quotationData.items.map((item) => ({
        quotation_no: finalQuotationNo,
        code: item.code || "",
        name: item.name || "",
        description: item.description || "",
        gst: item.gst || 0,
        qty: item.qty || 0,
        units: item.units || "Nos",
        rate: item.rate || 0,
        discount: item.discount || 0,
        flat_discount: item.flatDiscount || 0,
        amount: item.amount || 0,
        is_freight: (item.name || "").trim().toLowerCase() === "freight",
      }));

      const { error: itemsError } = await supabase.from("inbound_quotation_items").insert(itemRows);
      if (itemsError) {
        throw new Error("Error saving quotation items: " + itemsError.message);
      }

      setPdfUrl(pdfUrl);

      if (isRevising && selectedQuotation) {
        setQuotationData((prev) => ({
          ...prev,
          quotationNo: finalQuotationNo,
        }));
      }

      alert("Quotation saved successfully with all items!");

      const nextQuotationNumber = await getNextQuotationNumber();
      setQuotationData((prev) => ({
        // Bank details are a static, company-wide row fetched once on mount
        // (not tied to state anymore) — carry them forward instead of
        // clearing them, since nothing will re-fetch them after this reset.
        accountNo: prev.accountNo,
        bankName: prev.bankName,
        bankAddress: prev.bankAddress,
        ifscCode: prev.ifscCode,
        email: prev.email,
        website: prev.website,
        pan: prev.pan,
        quotationNo: nextQuotationNumber,
        date: new Date().toLocaleDateString("en-GB"),
        consignorState: "",
        consignorName: "",
        consignorAddress: "",
        consignorMobile: "",
        consignorPhone: "",
        consignorGSTIN: "",
        consignorStateCode: "",
        companyName: "",
        consigneeName: "",
        consigneeAddress: "",
        consigneeState: "",
        consigneeContactName: "",
        consigneeContactNo: "",
        consigneeGSTIN: "",
        consigneeStateCode: "",
        msmeNumber: "",
        linkedTicketUuid: "",
        items: [
          {
            id: 1,
            code: "",
            name: "",
            gst: 18,
            qty: 1,
            units: "Nos",
            rate: 0,
            discount: 0,
            flatDiscount: 0,
            amount: 0,
          },
        ],
        totalFlatDiscount: 0,
        subtotal: 0,
        cgstRate: 9,
        sgstRate: 9,
        cgstAmount: 0,
        sgstAmount: 0,
        total: 0,
        validity:
          "The above quoted prices are valid up to 10 days from date of offer.",
        paymentTerms:
          "100% advance payment in the mode of NEFT, RTGS & DD.Payment only accepted in company's account - DIVINE EMPIRE INDIA PVT LTD.",
        delivery: "Material is ready in our stock",
        freight: "Extra as per actual.",
        insurance: "Transit insurance for all shipment is at Buyer's risk.",
        taxes: "Extra as per actual.",
        notes: [""],
        preparedBy: "",
        specialOffers: [""],
      }));
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <QuotationHeader
        image={image1}
        isRevising={isRevising}
        toggleRevising={toggleRevising}
      />

      <div className="bg-white rounded-lg shadow border">
        <div className="border-b">
          <div className="flex">
            <button
              className={`px-4 py-2 font-medium ${activeTab === "edit"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-tl-lg"
                : "text-gray-600"
                }`}
              onClick={() => setActiveTab("edit")}
              disabled={isViewMode}
            >
              Edit Quotation
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "preview"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                : "text-gray-600"
                }`}
              onClick={() => setActiveTab("preview")}
            >
              Preview
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === "edit" ? (
            <QuotationForm
              quotationData={quotationData}
              handleInputChange={handleInputChange}
              handleItemChange={handleItemChange}
              handleFlatDiscountChange={handleFlatDiscountChange}
              handleAddItem={handleAddItem}
              handleNoteChange={handleNoteChange}
              addNote={addNote}
              removeNote={removeNote}
              hiddenFields={hiddenFields}
              toggleFieldVisibility={toggleFieldVisibility}
              isRevising={isRevising}
              existingQuotations={existingQuotations}
              selectedQuotation={selectedQuotation}
              handleQuotationSelect={handleQuotationSelect}
              isLoadingQuotation={isLoadingQuotation}
              handleSpecialDiscountChange={handleSpecialDiscountChangeWrapper}
              specialDiscount={specialDiscount}
              setSpecialDiscount={setSpecialDiscount}
              selectedReferences={selectedReferences}
              setSelectedReferences={setSelectedReferences}
              imageform={imageform}
              addSpecialOffer={addSpecialOffer}
              removeSpecialOffer={removeSpecialOffer}
              handleSpecialOfferChange={handleSpecialOfferChange}
              setQuotationData={setQuotationData} // ADD THIS LINE
              hiddenColumns={hiddenColumns} // ADD THIS LINE
              setHiddenColumns={setHiddenColumns} // ADD THIS LINE
            />
          ) : (
            <QuotationPreview
              quotationData={quotationData}
              quotationLink={quotationLink}
              pdfUrl={pdfUrl}
              selectedReferences={selectedReferences}
              specialDiscount={specialDiscount}
              imageform={imageform}
              handleGenerateLink={handleGenerateLink}
              handleGeneratePDF={handleGeneratePDF}
              isGenerating={isGenerating}
              isSubmitting={isSubmitting}
              hiddenColumns={hiddenColumns}
            />
          )}
        </div>
      </div>

      {activeTab === "edit" && (
        <div className="flex justify-between mt-4">
          <button
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center"
            onClick={handleSaveQuotation}
            disabled={isSubmitting || isGenerating}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="h-4 w-4 mr-2" />
                Save Quotation
              </>
            )}
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
              {isGenerating ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MakeQuotation;
