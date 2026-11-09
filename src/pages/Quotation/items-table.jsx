"use client";
import { useState } from "react";
import FieldVisibilityMenu from "./FieldVisibilityMenu";
import ItemRow from "./ItemRow";
import ItemsTableFooter from "./ItemsTableFooter";
import { Plus as PlusIcon } from "lucide-react";

const ItemsTable = ({
  quotationData,
  handleItemChange,
  handleAddItem,
  specialDiscount,
  setSpecialDiscount,
  productCodes,
  productNames,
  productData,
  setQuotationData,
  handleSpecialDiscountChange,
  isLoading,
  hiddenColumns,
  setHiddenColumns,
}) => {
  // Use props instead of local state
  const hideDisc = hiddenColumns?.hideDisc || false;
  const hideFlatDisc = hiddenColumns?.hideFlatDisc || false;
  const hideTotalFlatDisc = hiddenColumns?.hideTotalFlatDisc || false;
  const hideSpecialDiscount = hiddenColumns?.hideSpecialDiscount || false;

  const hideCode = hiddenColumns?.hideCode || false;
  const hideProductName = hiddenColumns?.hideProductName || false;
  const hideDescription = hiddenColumns?.hideDescription || false;
  const hideGST = hiddenColumns?.hideGST || false;
  const hideQty = hiddenColumns?.hideQty || false;
  const hideUnits = hiddenColumns?.hideUnits || false;
  const hideRate = hiddenColumns?.hideRate || false;
  const hideAmount = hiddenColumns?.hideAmount || false;

  const [showDropdown, setShowDropdown] = useState(false);

  const calculateColSpan = () => {
    let baseSpan = 11; // Start with max columns
    if (hideCode) baseSpan -= 1;
    if (hideProductName) baseSpan -= 1;
    if (hideDescription) baseSpan -= 1;
    if (hideGST) baseSpan -= 1;
    if (hideQty) baseSpan -= 1;
    if (hideUnits) baseSpan -= 1;
    if (hideRate) baseSpan -= 1;
    if (hideDisc) baseSpan -= 1;
    if (hideFlatDisc) baseSpan -= 1;
    if (hideAmount) baseSpan -= 1;
    return baseSpan.toString();
  };
  // Calculate taxable amount properly (subtotal - totalFlatDiscount)
  const taxableAmount = Math.max(
    0,
    quotationData.subtotal - quotationData.totalFlatDiscount
  );

  const fieldOptions = [
    { key: "hideCode", label: "Code" },
    { key: "hideProductName", label: "Product Name" },
    { key: "hideDescription", label: "Description" },
    { key: "hideGST", label: "GST %" },
    { key: "hideQty", label: "Qty." },
    { key: "hideUnits", label: "Units" },
    { key: "hideRate", label: "Rate" },
    { key: "hideDisc", label: "Disc %" },
    { key: "hideFlatDisc", label: "Flat Disc" },
    { key: "hideAmount", label: "Amount" },
    { key: "hideSubtotal", label: "Subtotal" },
    { key: "hideTotalQty", label: "Total Qty" },
    { key: "hideTotalFlatDisc", label: "Total Flat Discount" },
    { key: "hideTaxableAmount", label: "Taxable Amount" },
    { key: "hideIGST", label: "IGST" },
    { key: "hideCGST", label: "CGST" },
    { key: "hideSGST", label: "SGST" },
    { key: "hideSpecialDiscount", label: "Special Discount" },
    { key: "hideTotalDiscount", label: "Total Discount" },
    { key: "hideGrandTotal", label: "Grand Total" },
  ];

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Items</h3>

          <div className="flex gap-2 flex-wrap">
            {/* Dropdown for Hide/Show Fields */}
            <FieldVisibilityMenu
              setShowDropdown={setShowDropdown}
              showDropdown={showDropdown}
              fieldOptions={fieldOptions}
              hiddenColumns={hiddenColumns}
              setHiddenColumns={setHiddenColumns}
            />

            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              onClick={handleAddItem}
              disabled={isLoading}
            >
              <PlusIcon className="h-4 w-4 inline mr-1" /> Add Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  S No.
                </th>
                {!hideCode && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                )}
                {!hideProductName && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Product Name
                  </th>
                )}
                {!hideDescription && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                )}
                {!hideGST && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    GST %
                  </th>
                )}
                {!hideQty && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Qty.
                  </th>
                )}
                {!hideUnits && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Units
                  </th>
                )}
                {!hideRate && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Rate
                  </th>
                )}
                {!hideDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Disc %
                  </th>
                )}
                {!hideFlatDisc && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Flat Disc
                  </th>
                )}
                {!hideAmount && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                )}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotationData.items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                index={index}
                hideCode={hideCode}
                handleItemChange={handleItemChange}
                productData={productData}
                isLoading={isLoading}
                hideProductName={hideProductName}
                hideDescription={hideDescription}
                hideGST={hideGST}
                hideQty={hideQty}
                hideUnits={hideUnits}
                hideRate={hideRate}
                hideDisc={hideDisc}
                hideFlatDisc={hideFlatDisc}
                hideAmount={hideAmount}
                quotationData={quotationData}
                specialDiscount={specialDiscount}
                setQuotationData={setQuotationData}
              />
              ))}
            </tbody>
            <ItemsTableFooter
              hiddenColumns={hiddenColumns}
              calculateColSpan={calculateColSpan}
              quotationData={quotationData}
              hideTotalFlatDisc={hideTotalFlatDisc}
              taxableAmount={taxableAmount}
              hideSpecialDiscount={hideSpecialDiscount}
              specialDiscount={specialDiscount}
              setSpecialDiscount={setSpecialDiscount}
              handleSpecialDiscountChange={handleSpecialDiscountChange}
              isLoading={isLoading}
            />
          </table>
        </div>
        <datalist id="global-code-list">
          {productCodes.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
        <datalist id="global-name-list">
          {productNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
    </div>
  );
};

export default ItemsTable;
