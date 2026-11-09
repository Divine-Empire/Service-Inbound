// Hide/Show Fields dropdown for the items table columns and totals rows.
export default function FieldVisibilityMenu({ setShowDropdown, showDropdown, fieldOptions, hiddenColumns, setHiddenColumns }) {
  return (
    <div className="relative">
      <button
        className="px-3 py-1 text-sm text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-1"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        Hide/Show Fields
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-56 bg-white rounded-md border border-gray-300 shadow-lg max-h-96 overflow-y-auto">
            <div className="p-2">
              {fieldOptions.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center px-2 py-2 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns?.[field.key]}
                    onChange={() =>
                      setHiddenColumns((prev) => ({
                        ...prev,
                        [field.key]: !prev[field.key],
                      }))
                    }
                    className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {field.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
