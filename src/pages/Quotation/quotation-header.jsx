"use client"

const QuotationHeader = ({ image, isRevising, toggleRevising }) => {
  return (
    <div className="flex justify-between items-center mb-6">
      <img src={image || "/placeholder.svg?height=80&width=100"} alt="Logo" className="h-20 w-25 mr-3" />
      <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
        DIVINE EMPIRE INDIA PVT. LTD.
      </h1>
      <button
        className={`px-4 py-2 rounded-md ${isRevising ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
        onClick={toggleRevising}
      >
        {isRevising ? "Cancel Revise" : "Revise"}
      </button>
    </div>
  )
}

export default QuotationHeader
