import { Trash2 as TrashIcon } from "lucide-react";

// One editable line item of the quotation items table.
export default function ItemRow({ item, index, hideCode, handleItemChange, productData, isLoading, hideProductName, hideDescription, hideGST, hideQty, hideUnits, hideRate, hideDisc, hideFlatDisc, hideAmount, quotationData, specialDiscount, setQuotationData }) {
  return (
    <tr>
      <td className="px-4 py-2">{index + 1}</td>

      {!hideCode && (
        <td className="px-4 py-2">
          <div className="relative">
            <input
              type="text"
              value={item.code}
              onChange={(e) => {
                handleItemChange(item.id, "code", e.target.value);
                if (productData[e.target.value]) {
                  const productInfo = productData[e.target.value];
                  handleItemChange(
                    item.id,
                    "name",
                    productInfo.name
                  );
                  handleItemChange(
                    item.id,
                    "description",
                    productInfo.description
                  );
                  handleItemChange(
                    item.id,
                    "rate",
                    productInfo.rate
                  );
                }
              }}
              list="global-code-list"
              className="w-24 p-1 border border-gray-300 rounded-md"
              disabled={isLoading}
            />
          </div>
        </td>
      )}

      {!hideProductName && (
        <td className="px-4 py-2">
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={item.name}
              onChange={(e) => {
                handleItemChange(item.id, "name", e.target.value);
                if (productData[e.target.value]) {
                  const productInfo = productData[e.target.value];
                  handleItemChange(
                    item.id,
                    "code",
                    productInfo.code
                  );
                  handleItemChange(
                    item.id,
                    "description",
                    productInfo.description
                  );
                  handleItemChange(
                    item.id,
                    "rate",
                    productInfo.rate
                  );
                }
              }}
              list="global-name-list"
              className="p-1 border border-gray-300 rounded-md"
              style={{
                width: `${Math.max(200, item.name.length * 8)}px`,
              }}
              placeholder="Enter item name"
              disabled={isLoading}
              required
            />
          </div>
        </td>
      )}

      {!hideDescription && (
        <td className="px-4 py-2">
          <div className="relative min-w-[200px]">
            <textarea
              value={item.description || ""}
              onChange={(e) =>
                handleItemChange(
                  item.id,
                  "description",
                  e.target.value
                )
              }
              className="p-1 border border-gray-300 rounded-md resize-none overflow-hidden"
              style={{
                width: `${Math.max(
                  200,
                  (item.description || "").length * 8
                )}px`,
                height: "auto",
                minHeight: "32px",
              }}
              placeholder="Enter description"
              disabled={isLoading}
              rows="1"
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height =
                  e.target.scrollHeight + "px";
              }}
            />
          </div>
        </td>
      )}

      {!hideGST && (
        <td className="px-4 py-2">
          <select
            value={item.gst}
            onChange={(e) =>
              handleItemChange(
                item.id,
                "gst",
                Number.parseInt(e.target.value)
              )
            }
            className="w-20 p-1 border border-gray-300 rounded-md"
            disabled={isLoading}
          >
            <option value="0">0%</option>
            <option value="18">18%</option>
          </select>
        </td>
      )}

      {!hideQty && (
        <td className="px-4 py-2">
          <input
            type="number"
            value={item.qty}
            onChange={(e) =>
              handleItemChange(
                item.id,
                "qty",
                Number.parseInt(e.target.value) || 0
              )
            }
            className="w-16 p-1 border border-gray-300 rounded-md"
            placeholder="0"
            required
            disabled={isLoading}
          />
        </td>
      )}

      {!hideUnits && (
        <td className="px-4 py-2">
          <select
            value={item.units}
            onChange={(e) =>
              handleItemChange(item.id, "units", e.target.value)
            }
            className="w-20 p-1 border border-gray-300 rounded-md"
            disabled={isLoading}
          >
            <option value="Nos">Nos</option>
            <option value="Pcs">Pcs</option>
            <option value="Kg">Kg</option>
            <option value="Set">Set</option>
          </select>
        </td>
      )}

      {!hideRate && (
        <td className="px-4 py-2">
          <input
            type="number"
            value={item.rate}
            onChange={(e) =>
              handleItemChange(
                item.id,
                "rate",
                Number.parseFloat(e.target.value) || 0
              )
            }
            className="w-24 p-1 border border-gray-300 rounded-md"
            placeholder="0.00"
            disabled={isLoading}
            required
          />
        </td>
      )}

      {!hideDisc && (
        <td className="px-4 py-2">
          <input
            type="number"
            value={item.discount}
            onChange={(e) =>
              handleItemChange(
                item.id,
                "discount",
                Number.parseFloat(e.target.value) || 0
              )
            }
            className="w-20 p-1 border border-gray-300 rounded-md"
            placeholder="0%"
            min="0"
            max="100"
            disabled={isLoading}
          />
        </td>
      )}

      {!hideFlatDisc && (
        <td className="px-4 py-2">
          <input
            type="number"
            value={item.flatDiscount}
            onChange={(e) =>
              handleItemChange(
                item.id,
                "flatDiscount",
                Number.parseFloat(e.target.value) || 0
              )
            }
            className="w-24 p-1 border border-gray-300 rounded-md"
            placeholder="0.00"
            min="0"
            disabled={isLoading}
          />
        </td>
      )}

      {!hideAmount && (
        <td className="px-4 py-2">
          <input
            type="number"
            value={item.amount}
            className="w-24 p-1 border border-gray-300 rounded-md bg-gray-50"
            readOnly
          />
        </td>
      )}

      <td className="px-4 py-2">
        <button
          className="text-red-500 hover:text-red-700 p-1 rounded-md"
          onClick={() => {
            const newItems = quotationData.items.filter(
              (i) => i.id !== item.id
            );
            if (newItems.length === 0) return;

            const subtotal = newItems.reduce(
              (sum, i) => sum + i.amount,
              0
            );
            const subtotalAfterDiscount = Math.max(
              0,
              subtotal - quotationData.totalFlatDiscount
            );

            let cgstAmount = 0;
            let sgstAmount = 0;
            let igstAmount = 0;
            let total = 0;

            if (quotationData.isIGST) {
              igstAmount = Number(
                (
                  subtotalAfterDiscount *
                  (quotationData.igstRate / 100)
                ).toFixed(2)
              );
              total = Number(
                (
                  subtotalAfterDiscount +
                  igstAmount -
                  (Number(specialDiscount) || 0)
                ).toFixed(2)
              );
            } else {
              cgstAmount = Number(
                (
                  subtotalAfterDiscount *
                  (quotationData.cgstRate / 100)
                ).toFixed(2)
              );
              sgstAmount = Number(
                (
                  subtotalAfterDiscount *
                  (quotationData.sgstRate / 100)
                ).toFixed(2)
              );
              total = Number(
                (
                  subtotalAfterDiscount +
                  cgstAmount +
                  sgstAmount -
                  (Number(specialDiscount) || 0)
                ).toFixed(2)
              );
            }

            setQuotationData({
              ...quotationData,
              items: newItems,
              subtotal,
              cgstAmount,
              sgstAmount,
              igstAmount,
              total,
            });
          }}
          disabled={quotationData.items.length <= 1 || isLoading}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
