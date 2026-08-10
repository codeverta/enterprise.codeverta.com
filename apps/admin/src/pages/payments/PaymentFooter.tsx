import React from 'react'

  const PaymentFooter = () => (
    <div className="mt-12 text-center text-xs text-gray-400">
      &copy; Codeverta Enterprise System {new Date().getFullYear()}.
      {" "} | Custom website by{" "}
            <a
        target="_blank"
        rel="noreferrer"
        href="https://www.bikinwebsitejogja.com"
        className="text-blue-600 hover:underline"
        >
        codeverta.com
        </a>
      .
    </div>
  );

export default PaymentFooter
