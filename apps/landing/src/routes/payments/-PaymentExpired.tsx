import React from 'react'
import PaymentError from './-PaymentError'

function PaymentExpired({
    paymentStatus,
    errorMsg,
    }: {
    paymentStatus: "EXPIRED" | "ERROR";
    errorMsg?: string;
}) {
  return (
    <PaymentError paymentStatus={paymentStatus} errorMsg={errorMsg}/>
  )
}

export default PaymentExpired
