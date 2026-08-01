import React from "react";


// Komponen Switch Sederhana (Tailwind)
const ToggleSwitch = ({ label, checked, onChange, description }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100">
    <div className="flex flex-col">
      <span className="text-gray-900 font-medium">{label}</span>
      {description && (
        <span className="text-gray-500 text-sm">{description}</span>
      )}
    </div>
    <button
      onClick={() => {
        onChange(!checked)
      }}
      type="button"
      className={`${
        checked ? "bg-indigo-600" : "bg-gray-200"
      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
    >
      <span
        className={`${
          checked ? "translate-x-5" : "translate-x-0"
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  </div>
);


export default ToggleSwitch;