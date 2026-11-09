// Totals / discount / tax rows below the items.
export default function ItemsTableFooter({ hiddenColumns, calculateColSpan, quotationData, hideTotalFlatDisc, taxableAmount, hideSpecialDiscount, specialDiscount, setSpecialDiscount, handleSpecialDiscountChange, isLoading }) {
  return (
    <tfoot>
      {!hiddenColumns?.hideSubtotal && (
        <tr>
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Subtotal:
          </td>
          <td className="border p-2">
            ₹
            {typeof quotationData.subtotal === "number"
              ? quotationData.subtotal.toFixed(2)
              : "0.00"}
          </td>
          <td></td>
        </tr>
      )}

      {!hiddenColumns?.hideTotalQty && (
        <tr>
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Total Qty:
          </td>
          <td className="px-4 py-2">
            {quotationData.items.reduce(
              (sum, item) => sum + (Number(item.qty) || 0),
              0
            )}
          </td>
          <td></td>
        </tr>
      )}

      {!hideTotalFlatDisc && (
        <tr>
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Total Flat Discount:
          </td>
          <td className="p-2">
            ₹
            {typeof quotationData.totalFlatDiscount === "number"
              ? quotationData.totalFlatDiscount.toFixed(2)
              : "0.00"}
          </td>
          <td></td>
        </tr>
      )}

      {!hiddenColumns?.hideTaxableAmount && (
        <tr className="border">
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Taxable Amount:
          </td>
          <td className="px-4 py-2">₹{taxableAmount.toFixed(2)}</td>
          <td></td>
        </tr>
      )}

      {!hiddenColumns?.hideIGST && quotationData.isIGST ? (
        <tr className="border">
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            IGST ({quotationData.igstRate}%):
          </td>
          <td className="px-4 py-2">
            ₹{(quotationData.igstAmount || 0).toFixed(2)}
          </td>
          <td></td>
        </tr>
      ) : (
        <>
          {!hiddenColumns?.hideCGST && (
            <tr className="border">
              <td
                colSpan={calculateColSpan()}
                className="px-4 py-2 text-right font-medium"
              >
                CGST ({quotationData.cgstRate}%):
              </td>
              <td className="px-4 py-2">
                ₹{quotationData.cgstAmount.toFixed(2)}
              </td>
              <td></td>
            </tr>
          )}
          {!hiddenColumns?.hideSGST && (
            <tr className="border">
              <td
                colSpan={calculateColSpan()}
                className="px-4 py-2 text-right font-medium"
              >
                SGST ({quotationData.sgstRate}%):
              </td>
              <td className="px-4 py-2">
                ₹{quotationData.sgstAmount.toFixed(2)}
              </td>
              <td></td>
            </tr>
          )}
        </>
      )}

      {!hideSpecialDiscount && (
        <tr>
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Special Discount:
          </td>
          <td className="px-4 py-2">
            <input
              type="number"
              value={specialDiscount}
              onChange={(e) => {
                const value = e.target.value;
                setSpecialDiscount(value);
                handleSpecialDiscountChange(value);
              }}
              className="w-24 p-1 border border-gray-300 rounded-md"
              min="0"
              placeholder="0.00"
              disabled={isLoading}
            />
          </td>
          <td></td>
        </tr>
      )}

      {!hiddenColumns?.hideTotalDiscount && (
        <tr>
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right font-medium"
          >
            Total Discount:
          </td>
          <td className="px-4 py-2">
            ₹
            {(() => {
              const discountFromPercentage = quotationData.items.reduce(
                (sum, item) => {
                  const itemTotal = item.qty * item.rate;
                  return sum + itemTotal * (item.discount / 100);
                },
                0
              );
              const totalDiscount =
                discountFromPercentage +
                quotationData.totalFlatDiscount +
                (Number(specialDiscount) || 0);
              return totalDiscount.toFixed(2);
            })()}
          </td>
          <td></td>
        </tr>
      )}

      {!hiddenColumns?.hideGrandTotal && (
        <tr className="font-bold">
          <td
            colSpan={calculateColSpan()}
            className="px-4 py-2 text-right"
          >
            Grand Total:
          </td>
          <td className="px-4 py-2">
            ₹
            {(() => {
              const taxableAmt = Math.max(
                0,
                quotationData.subtotal - quotationData.totalFlatDiscount
              );
              let grandTotal = 0;

              if (quotationData.isIGST) {
                const igstAmt =
                  taxableAmt * (quotationData.igstRate / 100);
                grandTotal =
                  taxableAmt + igstAmt - (Number(specialDiscount) || 0);
              } else {
                const cgstAmt =
                  taxableAmt * (quotationData.cgstRate / 100);
                const sgstAmt =
                  taxableAmt * (quotationData.sgstRate / 100);
                grandTotal =
                  taxableAmt +
                  cgstAmt +
                  sgstAmt -
                  (Number(specialDiscount) || 0);
              }

              return Math.max(0, grandTotal).toFixed(2);
            })()}
          </td>
          <td></td>
        </tr>
      )}
    </tfoot>
  );
}
