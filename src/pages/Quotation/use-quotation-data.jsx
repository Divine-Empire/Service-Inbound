"use client";

import { useState } from "react";

export const useQuotationData = (initialSpecialDiscount = 0) => {
  const [specialDiscount, setSpecialDiscount] = useState(
    initialSpecialDiscount
  );
  const [hiddenFields, setHiddenFields] = useState({
    validity: false,
    paymentTerms: false,
    delivery: false,
    freight: false,
    insurance: false,
    taxes: false,
  });

  const [quotationData, setQuotationData] = useState({
    quotationNo: "IN-...",
    date: new Date().toLocaleDateString("en-GB"),
    consignorState: "",
    consignorName: "",
    consignorAddress: "",
    consignorMobile: "",
    consignorPhone: "0771-4900515",
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
    // Set when built via "Lead No." selection — links this quotation to the
    // ticket it was built for (make_quotation.ticket_uuid, nullable).
    linkedTicketUuid: "",
    items: [
      {
        id: 1,
        code: "",
        name: "",
        description: "",
        gst: 18,
        qty: 1,
        units: "Nos",
        rate: 0,
        discount: 0,
        flatDiscount: 0,
        amount: 0,
      },
    ],
    subtotal: 0,
    totalFlatDiscount: 0,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    isIGST: false,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    total: 0,
    // Matches Lead-To-Order-Supabase-New's own use-quotation-data.jsx defaults,
    // so this "unconditional" section behaves identically out of the box.
    validity:
      "The above quoted prices are valid up to 10 days from date of offer.",

    paymentTerms:
      "100% advance payment in the mode of NEFT, RTGS & DD.Payment only accepted in company's account - DIVINE EMPIRE INDIA PVT LTD.",

    scopOfWork:
      "Includes repair/installation/service as specified in quotation. Any additional work will be chargeable separately.",

    visitTravel:
      "TA/DA will be applicable as specified in the quotation.Any stay or accommodation expenses, if required, will be charged separately as per actuals.",

    siteReadness:
      "Kindly ensure the site is accessible, power is available, and all required areas are ready before the arrival of our service team.",

    ObservationAndFixing:
      "Additional charges may apply for any consumables, spares, or parts replaced during the service.",

    Safety_Compliance:
      "Client must ensure adherence to all safety guidelines at the site. Our team may decline to work in unsafe environments",

    GST_Taxes:
      "All rates are exclusive of GST. Applicable taxes will be charged extra as per government norms",

    Parts_Availability:
      "Service timelines depend on the availability of required parts. If a part is unavailable, the company will inform the client with an updated timeline.",

    Delays_Rescheduling:
      "Service visits may be rescheduled due to unavoidable circumstances (weather, travel issues, emergencies).Clients must inform at least 24 hours in advance for rescheduling; otherwise, visit charges may still apply.",

    accountNo: "",
    bankName: "",
    bankAddress: "",
    ifscCode: "",
    email: "",
    website: "",
    pan: "",
    notes: [""],
    preparedBy: "",
    specialOffers: [""],
  });

  const checkStateAndCalculateGST = (consignorState, consigneeState) => {
    const statesMatch =
      consignorState &&
      consigneeState &&
      consignorState.toLowerCase().trim() ===
        consigneeState.toLowerCase().trim();
    return !statesMatch;
  };

  const handleInputChange = (field, value) => {
    setQuotationData((prev) => {
      const newData = {
        ...prev,
        [field]: value,
      };

      // NEW: Handle items array update
      if (field === "items") {
        newData.items = value;

        // Recalculate totals when items change
        const totalFlatDiscount = value.reduce(
          (sum, item) => sum + Number(item.flatDiscount),
          0
        );
        const subtotal = value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const taxableAmount = subtotal;

        const shouldUseIGST = checkStateAndCalculateGST(
          prev.consignorState,
          prev.consigneeState
        );

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;

        if (shouldUseIGST) {
          igstAmount = Number(
            (taxableAmount * (prev.igstRate / 100)).toFixed(2)
          );
        } else {
          cgstAmount = Number(
            (taxableAmount * (prev.cgstRate / 100)).toFixed(2)
          );
          sgstAmount = Number(
            (taxableAmount * (prev.sgstRate / 100)).toFixed(2)
          );
        }

        const totalBeforeSpecialDiscount =
          taxableAmount + cgstAmount + sgstAmount;
        const total = Math.max(0, totalBeforeSpecialDiscount - specialDiscount);

        Object.assign(newData, {
          totalFlatDiscount,
          subtotal,
          isIGST: shouldUseIGST,
          cgstAmount,
          sgstAmount,
          igstAmount,
          total,
        });

        return newData;
      }

      if (field === "consignorState" || field === "consigneeState") {
        const shouldUseIGST = checkStateAndCalculateGST(
          field === "consignorState" ? value : prev.consignorState,
          field === "consigneeState" ? value : prev.consigneeState
        );

        newData.isIGST = shouldUseIGST;

        const totalFlatDiscount = prev.items.reduce(
          (sum, item) => sum + Number(item.flatDiscount),
          0
        );
       const subtotal = prev.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const taxableAmount = subtotal;

        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;

        if (shouldUseIGST) {
          igstAmount = Number(
            (taxableAmount * (prev.igstRate / 100)).toFixed(2)
          );
        } else {
          cgstAmount = Number(
            (taxableAmount * (prev.cgstRate / 100)).toFixed(2)
          );
          sgstAmount = Number(
            (taxableAmount * (prev.sgstRate / 100)).toFixed(2)
          );
        }

        const totalBeforeSpecialDiscount =
          taxableAmount + cgstAmount + sgstAmount;
        const total = Math.max(0, totalBeforeSpecialDiscount - specialDiscount);

        Object.assign(newData, {
          totalFlatDiscount,
          subtotal,
          cgstAmount,
          sgstAmount,
          igstAmount,
          total,
        });
      }

      return newData;
    });
  };

  // Handle item changes
  const handleItemChange = (id, field, value) => {
    setQuotationData((prev) => {
      const newItems = prev.items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          if (
            field === "qty" ||
            field === "rate" ||
            field === "discount" ||
            field === "flatDiscount"
          ) {
            const baseAmount =
              Number(updatedItem.qty) * Number(updatedItem.rate);
            const discountedAmount =
              baseAmount * (1 - Number(updatedItem.discount) / 100);
            updatedItem.amount = Math.max(
              0,
              discountedAmount - Number(updatedItem.flatDiscount)
            );
          }

          return updatedItem;
        }
        return item;
      });

      const totalFlatDiscount = newItems.reduce(
        (sum, item) => sum + Number(item.flatDiscount),
        0
      );
      const subtotal = Number(
        newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      );
      const taxableAmount = subtotal;

      const shouldUseIGST = checkStateAndCalculateGST(
        prev.consignorState,
        prev.consigneeState
      );

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (shouldUseIGST) {
        igstAmount = Number((taxableAmount * (prev.igstRate / 100)).toFixed(2));
      } else {
        cgstAmount = Number((taxableAmount * (prev.cgstRate / 100)).toFixed(2));
        sgstAmount = Number((taxableAmount * (prev.sgstRate / 100)).toFixed(2));
      }

      const totalBeforeSpecialDiscount =
        taxableAmount + cgstAmount + sgstAmount;
      const total = Math.max(0, totalBeforeSpecialDiscount - specialDiscount);

      return {
        ...prev,
        items: newItems,
        totalFlatDiscount,
        subtotal,
        isIGST: shouldUseIGST,
        cgstAmount,
        sgstAmount,
        igstAmount,
        total,
      };
    });
  };

  const handleFlatDiscountChange = (value) => {
    setQuotationData((prev) => {
      const numValue = Number(value);
      const subtotal = prev.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const taxableAmount = subtotal;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (prev.isIGST) {
        igstAmount = Number((taxableAmount * (prev.igstRate / 100)).toFixed(2));
      } else {
        cgstAmount = Number((taxableAmount * (prev.cgstRate / 100)).toFixed(2));
        sgstAmount = Number((taxableAmount * (prev.sgstRate / 100)).toFixed(2));
      }

      const totalBeforeSpecialDiscount =
        taxableAmount + cgstAmount + sgstAmount;
      const total = Math.max(0, totalBeforeSpecialDiscount - specialDiscount);

      return {
        ...prev,
        totalFlatDiscount: numValue,
        subtotal: subtotal,
        cgstAmount,
        sgstAmount,
        igstAmount,
        total,
      };
    });
  };

  const handleSpecialDiscountChange = (value) => {
    const discount = Number(value) || 0;
    setSpecialDiscount(discount);

    setQuotationData((prev) => {
      const taxableAmount = prev.subtotal;
      const totalBeforeSpecialDiscount =
        taxableAmount + prev.cgstAmount + prev.sgstAmount;
      const newTotal = Math.max(0, totalBeforeSpecialDiscount - discount);

      return {
        ...prev,
        total: newTotal,
      };
    });
  };

  const toggleFieldVisibility = (field) => {
    setHiddenFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleNoteChange = (index, value) => {
    setQuotationData((prev) => {
      const newNotes = [...prev.notes];
      newNotes[index] = value;
      return {
        ...prev,
        notes: newNotes,
      };
    });
  };

  const addNote = () => {
    setQuotationData((prev) => ({
      ...prev,
      notes: [...prev.notes, ""],
    }));
  };

  const removeNote = (index) => {
    setQuotationData((prev) => {
      const newNotes = [...prev.notes];
      newNotes.splice(index, 1);
      return {
        ...prev,
        notes: newNotes,
      };
    });
  };

  const handleAddItem = () => {
    const newId =
      Math.max(0, ...quotationData.items.map((item) => item.id)) + 1;
    setQuotationData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: newId,
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
    }));
  };

  const addSpecialOffer = () => {
    setQuotationData((prev) => ({
      ...prev,
      specialOffers: [...(prev.specialOffers || [""]), ""],
    }));
  };

  const removeSpecialOffer = (index) => {
    setQuotationData((prev) => {
      const newSpecialOffers = [...(prev.specialOffers || [])];
      newSpecialOffers.splice(index, 1);
      return {
        ...prev,
        specialOffers: newSpecialOffers.length > 0 ? newSpecialOffers : [""],
      };
    });
  };

  const handleSpecialOfferChange = (index, value) => {
    setQuotationData((prev) => {
      const newSpecialOffers = [...(prev.specialOffers || [])];

      while (newSpecialOffers.length <= index) {
        newSpecialOffers.push("");
      }

      newSpecialOffers[index] = value;
      return {
        ...prev,
        specialOffers: newSpecialOffers,
      };
    });
  };

  return {
    quotationData,
    setQuotationData,
    handleInputChange,
    handleItemChange,
    handleFlatDiscountChange,
    handleSpecialDiscountChange,
    specialDiscount,
    setSpecialDiscount,
    handleAddItem,
    handleNoteChange,
    addNote,
    removeNote,
    hiddenFields,
    toggleFieldVisibility,
    addSpecialOffer,
    removeSpecialOffer,
    handleSpecialOfferChange,
  };
};
